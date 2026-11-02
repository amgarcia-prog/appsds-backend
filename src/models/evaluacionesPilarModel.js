const supabase = require('../config/supabase')

const tabla = () => supabase.from('evaluaciones_pilar')

const guardar = (filas) => tabla().upsert(filas, { onConflict: 'anio,evaluador_id,evaluado_id' })
const buscarDeEvaluador = (anio, evaluadorId) => tabla().select('id').eq('anio', anio).eq('evaluador_id', evaluadorId).limit(1)
const listarResultados = (anio) => tabla()
  .select('evaluado_id, es_autoevaluacion, p1_reuniones, p2_compromisos, p3_seguimiento, evaluado:evaluado_id(primer_nombre, segundo_nombre, primer_apellido)')
  .eq('anio', anio)

module.exports = { guardar, buscarDeEvaluador, listarResultados }
