// Benefactores (providentes) de cada ciudad
const supabase = require('../config/supabase')

const tabla = () => supabase.from('providentes')

function listar(ciudad, q) {
  let consulta = tabla().select('*').eq('ciudad', ciudad).order('nombre')
  if (q) consulta = consulta.ilike('nombre', `%${q}%`)
  return consulta
}

const insertar = (datos) => tabla().insert(datos).select().single()
const actualizar = (id, ciudad, datos) => tabla().update(datos).eq('id', id).eq('ciudad', ciudad)
const eliminar = (id, ciudad) => tabla().delete().eq('id', id).eq('ciudad', ciudad)

module.exports = { listar, insertar, actualizar, eliminar }
