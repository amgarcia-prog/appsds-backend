const miCiudadService = require('../services/miCiudadService')
const { responderEscritura } = require('../utils/respuestas')

// req.ciudadComunicaciones lo deja verificarComunicacionesConsejo

async function obtenerContenido(req, res) {
  res.json(await miCiudadService.obtenerContenido(req.ciudadComunicaciones))
}

async function guardarContenido(req, res) {
  const { subtitulo, historia, historia_fotos } = req.body
  const resultado = await miCiudadService.guardarContenido(
    req.ciudadComunicaciones, req.headers['x-miembro-id'], { subtitulo, historia, historia_fotos })
  responderEscritura(res, resultado)
}

async function listarServicios(req, res) {
  res.json(await miCiudadService.listarServicios(req.ciudadComunicaciones))
}

async function crearServicio(req, res) {
  if (!req.body.nombre) return res.status(400).json({ ok: false, mensaje: 'El nombre es obligatorio' })
  responderEscritura(res, await miCiudadService.crearServicio(req.ciudadComunicaciones, req.body))
}

async function actualizarServicio(req, res) {
  if (!req.body.nombre) return res.status(400).json({ ok: false, mensaje: 'El nombre es obligatorio' })
  responderEscritura(res, await miCiudadService.actualizarServicio(req.params.id, req.ciudadComunicaciones, req.body))
}

async function eliminarServicio(req, res) {
  responderEscritura(res, await miCiudadService.eliminarServicio(req.params.id, req.ciudadComunicaciones))
}

async function obtenerCiudadPublica(req, res) {
  res.json(await miCiudadService.obtenerCiudadPublica(req.params.nombre))
}

module.exports = {
  obtenerContenido,
  guardarContenido,
  listarServicios,
  crearServicio,
  actualizarServicio,
  eliminarServicio,
  obtenerCiudadPublica,
}
