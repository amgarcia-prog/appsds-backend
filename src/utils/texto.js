// Limpieza de texto para usar en rutas de Supabase Storage, que rechaza tildes y otros
// caracteres fuera de ASCII (ej. "Medellín" produce "Invalid key"). Conserva "/" para
// mantener subcarpetas intactas.
function limpiarRutaStorage(texto) {
  return String(texto)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9/_.-]/g, '-')
}

module.exports = { limpiarRutaStorage }
