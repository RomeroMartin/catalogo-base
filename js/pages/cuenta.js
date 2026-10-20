// Cuenta del cliente. En la Fase 3 solo arranca el esqueleto; login y perfil llegan en las Fases 4 y 7.
import { initLayout } from '../components/layout.js';
import { getStore, applyBranding } from '../lib/store.js';

initLayout();
try {
  applyBranding(await getStore());
} catch (err) {
  console.error('No se pudo cargar la configuración de la tienda', err);
}
