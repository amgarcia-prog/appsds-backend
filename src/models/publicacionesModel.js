const supabase = require('../config/supabase')

const tabla = () => supabase.from('publicaciones')

const listarRecientes = () => tabla().select('*').order('created_at', { ascending: false }).limit(12)
const insertar = (datos) => tabla().insert(datos)
const actualizar = (id, datos) => tabla().update(datos).eq('id', id)
const eliminar = (id) => tabla().delete().eq('id', id)

module.exports = { listarRecientes, insertar, actualizar, eliminar }
