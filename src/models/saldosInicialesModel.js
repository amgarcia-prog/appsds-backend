// Saldo de arranque de cada cuenta de una ciudad
const supabase = require('../config/supabase')

const tabla = () => supabase.from('saldos_iniciales')

const obtener = (ciudad, cuenta) => tabla().select('saldo').eq('ciudad', ciudad).eq('cuenta', cuenta).single()
const guardar = (ciudad, cuenta, saldo) => tabla().upsert({ ciudad, cuenta, saldo }, { onConflict: 'ciudad,cuenta' })

module.exports = { obtener, guardar }
