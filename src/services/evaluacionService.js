// Evaluación anual entre pilares
const registrosModel = require('../models/registrosModel')
const evaluacionesPilarModel = require('../models/evaluacionesPilarModel')

const RESPONSABILIDADES_CON_RESULTADOS = ['Servidor General', 'Servidor General Suplente', 'Organizacional']

// Resultado: 'no_encontrado' | 'clave_incorrecta' | 'no_es_pilar' | 'ok' (con el pilar)
async function iniciarSesion(numeroIdentificacion, clave) {
  const { data, error } = await registrosModel.obtenerPorIdentificacion(
    numeroIdentificacion, 'id, primer_nombre, primer_apellido, estado_consagracion, responsabilidades_pilar, clave')
  if (error || !data) return { resultado: 'no_encontrado' }
  if (data.clave !== clave) return { resultado: 'clave_incorrecta' }
  if (data.estado_consagracion !== 'pilar') return { resultado: 'no_es_pilar' }
  return {
    resultado: 'ok',
    pilar: { id: data.id, nombre: `${data.primer_nombre} ${data.primer_apellido}`, responsabilidades_pilar: data.responsabilidades_pilar },
  }
}

async function listarPilares() {
  const { data } = await registrosModel.listarPilares('id, primer_nombre, segundo_nombre, primer_apellido')
  return data || []
}

function guardar(anio, evaluadorId, evaluaciones) {
  const filas = evaluaciones.map(e => ({
    anio, evaluador_id: evaluadorId, evaluado_id: e.evaluado_id,
    es_autoevaluacion: e.es_autoevaluacion || false,
    p1_reuniones: e.p1, p2_compromisos: e.p2, p3_seguimiento: e.p3,
  }))
  return evaluacionesPilarModel.guardar(filas)
}

async function yaEvaluo(anio, evaluadorId) {
  const { data } = await evaluacionesPilarModel.buscarDeEvaluador(anio, evaluadorId)
  return data && data.length > 0
}

// responsabilidades_pilar puede venir como arreglo, texto JSON o texto simple
function normalizarResponsabilidades(valor) {
  let rp = valor || []
  if (typeof rp === 'string') { try { rp = JSON.parse(rp) } catch { rp = [rp] } }
  return Array.isArray(rp) ? rp : [rp]
}

// Devuelve null si el miembro no puede ver los resultados
async function obtenerResultados(anio, miembroId) {
  const { data: reg } = await registrosModel.obtenerPorId(miembroId, 'responsabilidades_pilar')
  const responsabilidades = normalizarResponsabilidades(reg?.responsabilidades_pilar)
  console.log('responsabilidades_pilar:', responsabilidades)
  if (!reg || !responsabilidades.some(x => RESPONSABILIDADES_CON_RESULTADOS.includes(x))) return null
  const { data } = await evaluacionesPilarModel.listarResultados(anio)
  return data || []
}

module.exports = { iniciarSesion, listarPilares, guardar, yaEvaluo, obtenerResultados }
