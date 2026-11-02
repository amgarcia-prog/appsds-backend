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

function listar(columnas) {
  return tabla().select(columnas)
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
  listar,
  listarPorCiudad,
  listarPilares,
  buscarPorTexto,
}
