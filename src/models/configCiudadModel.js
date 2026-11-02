const supabase = require('../config/supabase')

// Datos de la ciudad que aparecen en los recibos
const obtener = (ciudad) => supabase.from('config_ciudad').select('cuenta_bancaria').eq('ciudad', ciudad).single()

module.exports = { obtener }
