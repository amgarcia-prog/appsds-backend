const adminService = require('../services/adminService')
const { responderEscritura } = require('../utils/respuestas')

async function listarRegistros(req, res) {
  const { data, error } = await adminService.listarRegistros()
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json(data)
}

async function actualizarRegistro(req, res) {
  responderEscritura(res, await adminService.actualizarRegistro(req.params.id, req.body))
}

async function eliminarRegistro(req, res) {
  responderEscritura(res, await adminService.eliminarRegistro(req.params.id))
}

async function establecerRolFinanciero(req, res) {
  const { asignar } = req.body
  responderEscritura(res, await adminService.establecerRolFinanciero(req.params.id, asignar))
}

async function listarPuntosActivos(req, res) {
  const { data, error } = await adminService.listarPuntosActivos(req.query.ciudad)
  if (error) return res.status(500).json([])
  res.json(data)
}

async function listarPuntos(req, res) {
  const { data, error } = await adminService.listarPuntos()
  if (error) return res.status(500).json([])
  res.json(data)
}

async function crearPunto(req, res) {
  responderEscritura(res, await adminService.crearPunto(req.body))
}

async function actualizarPunto(req, res) {
  responderEscritura(res, await adminService.actualizarPunto(req.params.id, req.body))
}

async function eliminarPunto(req, res) {
  responderEscritura(res, await adminService.eliminarPunto(req.params.id))
}

const RECHAZOS_CORREO_MASIVO = {
  no_autorizado: [401, 'No autorizado'],
  no_es_pilar: [403, 'Solo los pilares pueden enviar correos masivos'],
}

async function enviarCorreoMasivo(req, res) {
  const { resultado, replyTo } = await adminService.autorizarCorreoMasivo(req.headers['x-admin-key'], req.headers['x-miembro-id'])
  if (resultado !== 'ok') {
    const [status, mensaje] = RECHAZOS_CORREO_MASIVO[resultado]
    return res.status(status).json({ ok: false, mensaje })
  }
  const { asunto, cuerpo, correos } = req.body
  if (!asunto || !cuerpo || !Array.isArray(correos) || correos.length === 0)
    return res.status(400).json({ ok: false, mensaje: 'Faltan datos' })
  const { enviados, errores } = await adminService.enviarCorreoMasivo({ asunto, cuerpo, correos, replyTo })
  res.json({ ok: true, enviados, errores })
}

module.exports = {
  listarRegistros,
  actualizarRegistro,
  eliminarRegistro,
  establecerRolFinanciero,
  listarPuntosActivos,
  listarPuntos,
  crearPunto,
  actualizarPunto,
  eliminarPunto,
  enviarCorreoMasivo,
}
