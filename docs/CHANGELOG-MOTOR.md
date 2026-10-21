# Historial del motor

Cada sitio de cliente se arma a partir de una versión del motor. Anotar acá qué cambia entre versiones permite decidir qué mejoras llevar a un cliente que ya está publicado. Cambios que **tocan la base de datos** se marcan con 🗄️ (hay que correr SQL en el Supabase del cliente).

## 1.0 — 2026-10-21 (demo terminado)
- Base de datos con RLS, `crear_pedido` (precios y stock del servidor), triggers de stock y vistas de reportes 🗄️.
- Carrito persistente con dueño por cuenta, rehidratación y sincronización con la cuenta.
- Pedido como invitado por WhatsApp y pedido guardado para clientes con cuenta.
- Cuentas: registro, login, recuperar contraseña, perfil e historial de pedidos.
- Panel: resumen, productos con fotos (compresión WebP en el navegador), stock, pedidos, clientes, categorías y configuración; exportación a Excel como tabla.
- Seguridad: CSP estricta, escape de texto, sin secretos en el repo. Accesibilidad AA y Lighthouse móvil 92 / 100 / 100 / 100.
- Separación en capas: motor (`js/lib/`), panel, sitio; checkout dividido en `lib/pedido.js` (lógica) y `components/checkout-ui.js` (diseño).
- Verificación automática: `tests/verificar-sitio.mjs`.
