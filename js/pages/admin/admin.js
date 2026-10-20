// Panel de administración. En la Fase 3 solo arranca el esqueleto; el panel llega en la Fase 8.
import { initLayout } from '../../components/layout.js';
import { getStore, applyBranding } from '../../lib/store.js';

initLayout();
try {
  applyBranding(await getStore());
} catch (err) {
  console.error('No se pudo cargar la configuración de la tienda', err);
}
