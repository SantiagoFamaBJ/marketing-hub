// Acceso con PIN de 4 dígitos.
// Supabase exige contraseñas de 6+ caracteres, así que un PIN de 4 dígitos se completa
// con un texto fijo antes de enviarse. Cualquier otra cosa (contraseña normal) se envía tal cual.
const SUFIJO_PIN = '-DentalMedrano-Hub'

export const esPin = (raw: string) => /^\d{4}$/.test(raw)
export const credencial = (raw: string) => (esPin(raw) ? raw + SUFIJO_PIN : raw)
export const claveValida = (raw: string) => esPin(raw) || raw.length >= 8
