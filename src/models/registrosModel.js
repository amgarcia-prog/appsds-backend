const supabase = require('../config/supabase')

const tabla = () => supabase.from('registros')

function obtenerPorId(id, columnas) {
  return tabla().select(columnas).eq('id', id).single()
}

function actualizar(id, cambios) {
  return tabla().update(cambios).eq('id', id)
}

module.exports = { obtenerPorId, actualizar }
