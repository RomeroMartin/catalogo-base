// Autenticación. TODA la app usa onAuth() y nunca supabase.auth.onAuthStateChange directo.
import { supabase } from '../supabase-client.js';

// Regla anti-deadlock: dentro del callback de onAuthStateChange NO se puede hacer
// `await` de otra llamada a Supabase. Por eso el callback del usuario se difiere con setTimeout.
export function onAuth(cb) {
  const { data } = supabase.auth.onAuthStateChange((evento, sesion) => {
    setTimeout(() => cb(evento, sesion), 0);
  });
  return data.subscription;
}

export async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}

export async function signUp({ nombre, email, telefono, password }) {
  return supabase.auth.signUp({
    email, password,
    options: { data: { nombre, telefono }, emailRedirectTo: `${location.origin}/cuenta.html` },
  });
}

export const signIn = ({ email, password }) => supabase.auth.signInWithPassword({ email, password });
export const signOut = () => supabase.auth.signOut();
export const resetPassword = (email) =>
  supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/cuenta.html` });
export const updatePassword = (password) => supabase.auth.updateUser({ password });

// ¿El usuario logueado es admin? (la seguridad real es RLS; esto es solo para mostrar/ocultar cosas)
export async function isAdmin(usuario) {
  const user = usuario ?? (await getUser());
  if (!user) return false;
  const { data, error } = await supabase.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
  return !error && !!data;
}

const ERRORES = {
  invalid_credentials: 'Email o contraseña incorrectos.',
  user_already_exists: 'Ya existe una cuenta con ese email. Probá ingresar.',
  email_exists: 'Ya existe una cuenta con ese email. Probá ingresar.',
  weak_password: 'La contraseña es muy débil. Usá al menos 8 caracteres.',
  over_request_rate_limit: 'Hiciste demasiados intentos. Esperá unos minutos y probá de nuevo.',
  over_email_send_rate_limit: 'Se enviaron demasiados emails. Esperá unos minutos y probá de nuevo.',
  email_not_confirmed: 'Todavía no confirmaste tu email. Revisá tu bandeja de entrada.',
  same_password: 'La nueva contraseña tiene que ser distinta de la actual.',
  validation_failed: 'Revisá los datos ingresados.',
  signup_disabled: 'El registro está deshabilitado por el momento.',
};

export function mapAuthError(error) {
  if (!error) return '';
  return ERRORES[error.code] || 'No pudimos completar la operación. Probá de nuevo en un momento.';
}
