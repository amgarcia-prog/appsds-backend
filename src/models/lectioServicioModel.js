const supabase = require('../config/supabase')

const tabla = () => supabase.from('lectio_servicio')

const listar = () => tabla().select('*').order('created_at', { ascending: false })
const insertar = (datos) => tabla().insert(datos)
const actualizar = (id, datos) => tabla().update(datos).eq('id', id)
const eliminar = (id) => tabla().delete().eq('id', id)

module.exports = { listar, insertar, actualizar, eliminar }
