// ▓ MOTOR — igual para todos los clientes; no se edita por un pedido de diseño (ver docs/GUIA-TECNICA-CORE.md)
// Generador mínimo de archivos Excel (.xlsx) en el navegador, sin librerías ni build.
// Un .xlsx es un ZIP con archivos XML: acá se arma ese ZIP (sin comprimir) a mano.
// El resultado es una hoja con una TABLA de Excel (encabezado con filtros, filas alternadas,
// primera fila fija y columnas con el ancho justo). Los textos van como texto, nunca como fórmulas.
//
// construirXLSX({ hoja, tabla, columnas: [{ titulo, tipo }], filas: [[...]] }) → Uint8Array
//   tipo: 'texto' (por defecto) | 'numero' | 'moneda' ($ #.##0) | 'fecha' (dd/mm/aaaa hh:mm) | 'dia' (dd/mm/aaaa)
//   Las fechas se pasan como texto ISO (como vienen de la base) y se muestran en hora local.

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const CABECERA = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
// Estilos (posición en cellXfs de styles.xml)
const ESTILO = { texto: 0, numero: 0, moneda: 1, fecha: 2, dia: 3 };

// ── Utilidades ──
const escXML = (v) => String(v ?? '')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '') // caracteres que XML no admite
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// 0 → A, 25 → Z, 26 → AA
function letraColumna(i) {
  let n = i + 1, s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

// Fecha ISO → número de serie de Excel, en hora local (días desde 1899-12-30)
function serieExcel(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return (d.getTime() - d.getTimezoneOffset() * 60000) / 86400000 + 25569;
}

// ── ZIP sin compresión ──
const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = TABLA_CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function armarZip(archivos) { // archivos: [{ nombre, contenido: string }]
  const enc = new TextEncoder();
  const ahora = new Date();
  const dosFecha = ((ahora.getFullYear() - 1980) << 9) | ((ahora.getMonth() + 1) << 5) | ahora.getDate();
  const dosHora = (ahora.getHours() << 11) | (ahora.getMinutes() << 5) | (ahora.getSeconds() >> 1);
  const partes = [], central = [];
  let offset = 0;
  for (const a of archivos) {
    const nombre = enc.encode(a.nombre), datos = enc.encode(a.contenido), crc = crc32(datos);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034B50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true); // UTF-8
    local.setUint16(8, 0, true); local.setUint16(10, dosHora, true); local.setUint16(12, dosFecha, true);
    local.setUint32(14, crc, true); local.setUint32(18, datos.length, true); local.setUint32(22, datos.length, true);
    local.setUint16(26, nombre.length, true); local.setUint16(28, 0, true);
    partes.push(new Uint8Array(local.buffer), nombre, datos);

    const reg = new DataView(new ArrayBuffer(46));
    reg.setUint32(0, 0x02014B50, true); reg.setUint16(4, 20, true); reg.setUint16(6, 20, true); reg.setUint16(8, 0x0800, true);
    reg.setUint16(10, 0, true); reg.setUint16(12, dosHora, true); reg.setUint16(14, dosFecha, true);
    reg.setUint32(16, crc, true); reg.setUint32(20, datos.length, true); reg.setUint32(24, datos.length, true);
    reg.setUint16(28, nombre.length, true); reg.setUint32(42, offset, true);
    central.push(new Uint8Array(reg.buffer), nombre);
    offset += 30 + nombre.length + datos.length;
  }
  const tamCentral = central.reduce((n, p) => n + p.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054B50, true); fin.setUint16(8, archivos.length, true); fin.setUint16(10, archivos.length, true);
  fin.setUint32(12, tamCentral, true); fin.setUint32(16, offset, true);
  const todo = [...partes, ...central, new Uint8Array(fin.buffer)];
  const salida = new Uint8Array(todo.reduce((n, p) => n + p.length, 0));
  let pos = 0;
  for (const p of todo) { salida.set(p, pos); pos += p.length; }
  return salida;
}

// ── Contenido del libro ──
export function construirXLSX({ hoja = 'Datos', tabla = 'Datos', columnas, filas }) {
  const nombreHoja = String(hoja).replace(/[\[\]:*?/\\]/g, ' ').trim().slice(0, 31) || 'Datos';
  let nombreTabla = String(tabla).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9_]/g, '_');
  if (!/^[A-Za-z_]/.test(nombreTabla)) nombreTabla = `T_${nombreTabla}`;
  const titulos = columnas.map((c) => String(c.titulo));
  if (new Set(titulos.map((t) => t.toLowerCase())).size !== titulos.length) throw new Error('Los títulos de las columnas tienen que ser distintos');

  // Textos compartidos (cada texto distinto se guarda una sola vez)
  const textos = [], indice = new Map();
  const idTexto = (t) => { if (!indice.has(t)) { indice.set(t, textos.length); textos.push(t); } return indice.get(t); };

  const anchos = titulos.map((t) => t.length + 4);
  const celdasFila = (valores, nFila) => columnas.map((col, i) => {
    const v = valores[i];
    if (v === null || v === undefined || v === '') return '';
    const ref = `${letraColumna(i)}${nFila}`;
    const tipo = col.tipo || 'texto';
    if (tipo === 'numero' || tipo === 'moneda') {
      const n = Number(v);
      if (!Number.isFinite(n)) return '';
      anchos[i] = Math.max(anchos[i], tipo === 'moneda' ? 14 : String(n).length + 2);
      return `<c r="${ref}" s="${ESTILO[tipo]}"><v>${n}</v></c>`;
    }
    if (tipo === 'fecha' || tipo === 'dia') {
      const serie = serieExcel(v);
      if (serie === null) return '';
      anchos[i] = Math.max(anchos[i], tipo === 'fecha' ? 18 : 12);
      return `<c r="${ref}" s="${ESTILO[tipo]}"><v>${serie}</v></c>`;
    }
    const texto = String(v);
    anchos[i] = Math.max(anchos[i], Math.min(texto.length + 2, 50));
    return `<c r="${ref}" t="s"><v>${idTexto(texto)}</v></c>`;
  }).join('');

  const encabezado = columnas.map((_, i) => `<c r="${letraColumna(i)}1" t="s"><v>${idTexto(titulos[i])}</v></c>`).join('');
  const cuerpo = filas.map((f, r) => `<row r="${r + 2}">${celdasFila(f, r + 2)}</row>`).join('');
  const ultima = `${letraColumna(columnas.length - 1)}${filas.length + 1}`;
  const rango = `A1:${ultima}`;

  const hojaXML = `${CABECERA}<worksheet xmlns="${NS}" xmlns:r="${NS_R}">`
    + `<dimension ref="${rango}"/>`
    + '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>'
    + '<sheetFormatPr defaultRowHeight="15"/>'
    + `<cols>${anchos.map((a, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.min(Math.max(a, 10), 55)}" customWidth="1"/>`).join('')}</cols>`
    + `<sheetData><row r="1">${encabezado}</row>${cuerpo}</sheetData>`
    + '<tableParts count="1"><tablePart r:id="rId1"/></tableParts></worksheet>';

  const tablaXML = `${CABECERA}<table xmlns="${NS}" id="1" name="${nombreTabla}" displayName="${nombreTabla}" ref="${rango}" totalsRowShown="0">`
    + `<autoFilter ref="${rango}"/>`
    + `<tableColumns count="${columnas.length}">${titulos.map((t, i) => `<tableColumn id="${i + 1}" name="${escXML(t)}"/>`).join('')}</tableColumns>`
    + '<tableStyleInfo name="TableStyleMedium2" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/></table>';

  const textosXML = `${CABECERA}<sst xmlns="${NS}" count="${textos.length}" uniqueCount="${textos.length}">`
    + textos.map((t) => `<si><t xml:space="preserve">${escXML(t)}</t></si>`).join('') + '</sst>';

  const estilosXML = `${CABECERA}<styleSheet xmlns="${NS}">`
    + '<numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;$&quot;\\ #,##0"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy\\ hh:mm"/></numFmts>'
    + '<fonts count="1"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>'
    + '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
    + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    + '<cellXfs count="4">'
    + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
    + '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
    + '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
    + '<xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
    + '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
    + '<dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/></styleSheet>';

  const tiposContenido = `${CABECERA}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
    + '<Override PartName="/xl/tables/table1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>'
    + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    + '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>';

  const relsRaiz = `${CABECERA}<Relationships xmlns="${NS_REL}"><Relationship Id="rId1" Type="${NS_R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const libroXML = `${CABECERA}<workbook xmlns="${NS}" xmlns:r="${NS_R}"><sheets><sheet name="${escXML(nombreHoja)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const relsLibro = `${CABECERA}<Relationships xmlns="${NS_REL}">`
    + `<Relationship Id="rId1" Type="${NS_R}/worksheet" Target="worksheets/sheet1.xml"/>`
    + `<Relationship Id="rId2" Type="${NS_R}/styles" Target="styles.xml"/>`
    + `<Relationship Id="rId3" Type="${NS_R}/sharedStrings" Target="sharedStrings.xml"/></Relationships>`;
  const relsHoja = `${CABECERA}<Relationships xmlns="${NS_REL}"><Relationship Id="rId1" Type="${NS_R}/table" Target="../tables/table1.xml"/></Relationships>`;

  return armarZip([
    { nombre: '[Content_Types].xml', contenido: tiposContenido },
    { nombre: '_rels/.rels', contenido: relsRaiz },
    { nombre: 'xl/workbook.xml', contenido: libroXML },
    { nombre: 'xl/_rels/workbook.xml.rels', contenido: relsLibro },
    { nombre: 'xl/worksheets/sheet1.xml', contenido: hojaXML },
    { nombre: 'xl/worksheets/_rels/sheet1.xml.rels', contenido: relsHoja },
    { nombre: 'xl/tables/table1.xml', contenido: tablaXML },
    { nombre: 'xl/styles.xml', contenido: estilosXML },
    { nombre: 'xl/sharedStrings.xml', contenido: textosXML },
  ]);
}

// Arma el archivo y lo descarga con el nombre indicado.
export function descargarXLSX(nombreArchivo, definicion) {
  const bytes = construirXLSX(definicion);
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nombreArchivo;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
