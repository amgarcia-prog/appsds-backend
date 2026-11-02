const supabase = require('../config/supabase')

const tabla = () => supabase.from('puntos_servicio')

// Puntos activos ordenados por nombre; filtra por ciudad salvo que ciudad sea undefined
function listarActivos(columnas, ciudad) {
  let consulta = tabla().select(columnas).eq('activo', true)
  if (ciudad !== undefined) consulta = consulta.ilike('ciudad', ciudad)
  return consulta.order('nombre')
}

const listarTodos = () => tabla().select('*').order('pais').order('ciudad').order('nombre')
const insertar = (datos) => tabla().insert(datos)
const actualizar = (id, datos) => tabla().update(datos).eq('id', id)
const eliminar = (id) => tabla().delete().eq('id', id)

module.exports = { listarActivos, listarTodos, insertar, actualizar, eliminar }
