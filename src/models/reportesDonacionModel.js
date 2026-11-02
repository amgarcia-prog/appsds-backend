// Donaciones reportadas desde la página web pública, pendientes de registrar
const supabase = require('../config/supabase')

const tabla = () => supabase.from('reportes_donacion')

const insertar = (datos) => tabla().insert(datos)
const listarPendientes = (ciudad) => tabla().select('*').eq('ciudad', ciudad).eq('atendido', false).order('created_at', { ascending: false })
const marcarAtendido = (id, ciudad) => tabla().update({ atendido: true }).eq('id', id).eq('ciudad', ciudad)

module.exports = { insertar, listarPendientes, marcarAtendido }
