const supabase = require('../config/supabase')

const tabla = () => supabase.from('registros')

function obtenerPorId(id, columnas) {
  return tabla().select(columnas).eq('id', id).single()
}

function obtenerPorIdentificacion(numero, columnas) {
  return tabla().select(columnas).eq('numero_identificacion', numero).single()
}

function actualizar(id, cambios) {
  return tabla().update(cambios).eq('id', id)
}

function eliminar(id) {
  return tabla().delete().eq('id', id)
}

function listar(columnas) {
  return tabla().select(columnas)
}

// Todos los registros con todas sus columnas, los más recientes primero
function listarTodos() {
  return tabla().select('*').order('created_at', { ascending: false })
}

// Miembros del consejo de una ciudad
function listarConsejo(columnas, ciudad, { ordenar = true } = {}) {
  const consulta = tabla().select(columnas).eq('pertenece_consejo', 'Si pertenezco').ilike('ciudad_donde_sirve', ciudad)
  return ordenar ? consulta.order('primer_apellido') : consulta
}

function listarPorCiudad(columnas, ciudad) {
  return tabla().select(columnas).ilike('ciudad_donde_sirve', ciudad)
}

function listarPilares(columnas) {
  return tabla().select(columnas).eq('estado_consagracion', 'pilar').order('primer_apellido')
}

// Búsqueda por texto en varios campos (ilike), opcionalmente dentro de una ciudad
function buscarPorTexto({ columnas, q, campos, ciudad, fueraDelConsejo, limite }) {
  let consulta = tabla().select(columnas)
  if (ciudad !== undefined) consulta = consulta.ilike('ciudad_donde_sirve', ciudad)
  consulta = consulta.or(campos.map(c => `${c}.ilike.%${q}%`).join(','))
  if (fueraDelConsejo) consulta = consulta.neq('pertenece_consejo', 'Si pertenezco')
  return consulta.limit(limite)
}

module.exports = {
  obtenerPorId,
  obtenerPorIdentificacion,
  actualizar,
  eliminar,
  listar,
  listarTodos,
  listarConsejo,
  listarPorCiudad,
  listarPilares,
  buscarPorTexto,
}
