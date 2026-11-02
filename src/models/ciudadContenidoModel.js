const supabase = require('../config/supabase')

const tabla = () => supabase.from('ciudad_contenido')

const obtenerPorCiudad = (ciudad, columnas = '*') => tabla().select(columnas).ilike('ciudad', ciudad).single()
const guardar = (datos) => tabla().upsert(datos, { onConflict: 'ciudad' })

module.exports = { obtenerPorCiudad, guardar }
