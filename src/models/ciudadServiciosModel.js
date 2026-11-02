const supabase = require('../config/supabase')

const tabla = () => supabase.from('ciudad_servicios')

const listarPorCiudad = (ciudad) => tabla().select('*').ilike('ciudad', ciudad).order('orden').order('created_at')
const insertar = (datos) => tabla().insert(datos)
const actualizar = (id, ciudad, datos) => tabla().update(datos).eq('id', id).ilike('ciudad', ciudad)
const eliminar = (id, ciudad) => tabla().delete().eq('id', id).ilike('ciudad', ciudad)

module.exports = { listarPorCiudad, insertar, actualizar, eliminar }
