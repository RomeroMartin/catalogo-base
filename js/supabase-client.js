// Único cliente de Supabase de todo el sitio: los demás módulos importan `supabase` de acá.
// La versión de la librería está FIJADA a propósito (nunca @2 ni @latest).
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm';
import { SITE } from './site.config.js';

export const supabase = createClient(SITE.supabaseUrl, SITE.supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
