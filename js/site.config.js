// ===== SE EDITA UNA VEZ POR CLIENTE =====
// Todo lo que se ve en este archivo es público (va en el navegador).
// NUNCA pegar acá la clave "service_role" / "secret".
export const SITE = {
  supabaseUrl: 'https://pnxplpmyeozclhhpjfsq.supabase.co', // CLIENTE
  supabaseAnonKey: 'sb_publishable_-8PoyN2CDrhCkZgtTuVqgQ_L4OmkgLa', // CLIENTE (anon / publishable)
  formspreeId: '',          // opcional; vacío = no se muestra el formulario de contacto
  locale: 'es-AR',
  moneda: 'ARS',
  carritoKey: 'cb_cart_v1', // localStorage; subir la versión si cambia el formato del carrito
  credito: { texto: 'Sitio por Martin Romero Studio', url: 'https://www.martinromerostudio.com.ar' }, // CLIENTE (o vacío)
};
