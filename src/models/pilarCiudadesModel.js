const supabase = require('../config/supabase')

const tabla = () => supabase.from('pilar_ciudades')

const listarPorPilar = (pilarId) => tabla().select('*').eq('pilar_id', pilarId).order('pais').order('ciudad')
const insertar = (datos) => tabla().insert(datos)
const eliminar = (id, pilarId) => tabla().delete().eq('id', id).eq('pilar_id', pilarId)

module.exports = { listarPorPilar, insertar, eliminar }
