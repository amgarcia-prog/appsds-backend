const evaluacionService = require('../services/evaluacionService')
const { responderEscritura } = require('../utils/respuestas')

const RECHAZOS_LOGIN = {
  no_encontrado: [401, 'Usuario no encontrado'],
  clave_incorrecta: [401, 'Clave incorrecta'],
  no_es_pilar: [403, 'Solo los pilares pueden acceder a esta evaluación'],
}

async function iniciarSesion(req, res) {
  const { numero_identificacion, clave } = req.body
  if (!numero_identificacion || !clave) return res.status(400).json({ ok: false, mensaje: 'Faltan campos' })
  const { resultado, pilar } = await evaluacionService.iniciarSesion(numero_identificacion, clave)
  if (resultado !== 'ok') {
    const [status, mensaje] = RECHAZOS_LOGIN[resultado]
    return res.status(status).json({ ok: false, mensaje })
  }
  res.json({ ok: true, ...pilar })
}

async function listarPilares(req, res) {
  res.json(await evaluacionService.listarPilares())
}

async function guardar(req, res) {
  const { anio, evaluador_id, evaluaciones } = req.body
  if (!anio || !evaluador_id || !evaluaciones?.length) return res.status(400).json({ ok: false, mensaje: 'Faltan datos' })
  responderEscritura(res, await evaluacionService.guardar(anio, evaluador_id, evaluaciones))
}

async function yaEvaluo(req, res) {
  const { anio, evaluador_id } = req.query
  res.json({ ya_evaluo: await evaluacionService.yaEvaluo(anio, evaluador_id) })
}

async function resultados(req, res) {
  const { anio, id } = req.query
  const datos = await evaluacionService.obtenerResultados(anio, id)
  if (!datos) return res.status(403).json({ ok: false, mensaje: 'No tienes permiso para ver los resultados' })
  res.json(datos)
}

module.exports = { iniciarSesion, listarPilares, guardar, yaEvaluo, resultados }
