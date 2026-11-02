const comunicacionesService = require('../services/comunicacionesService')
const { responderEscritura } = require('../utils/respuestas')

async function listarPublicaciones(req, res) {
  const { data, error } = await comunicacionesService.listarPublicaciones()
  if (error) return res.status(500).json([])
  res.json(data)
}

const validarPublicacion = ({ titulo, extracto }) => (titulo && extracto)

async function crearPublicacion(req, res) {
  if (!validarPublicacion(req.body)) return res.status(400).json({ ok: false, mensaje: 'Título y extracto son obligatorios' })
  responderEscritura(res, await comunicacionesService.crearPublicacion(req.body))
}

async function actualizarPublicacion(req, res) {
  if (!validarPublicacion(req.body)) return res.status(400).json({ ok: false, mensaje: 'Título y extracto son obligatorios' })
  responderEscritura(res, await comunicacionesService.actualizarPublicacion(req.params.id, req.body))
}

async function eliminarPublicacion(req, res) {
  responderEscritura(res, await comunicacionesService.eliminarPublicacion(req.params.id))
}

async function listarLectio(req, res) {
  const { data, error } = await comunicacionesService.listarLectio()
  if (error) return res.status(500).json([])
  res.json(data)
}

const validarLectio = ({ titulo, archivo_url }) => (titulo && archivo_url)

async function crearLectio(req, res) {
  if (!validarLectio(req.body)) return res.status(400).json({ ok: false, mensaje: 'Título y archivo son obligatorios' })
  responderEscritura(res, await comunicacionesService.crearLectio(req.body))
}

async function actualizarLectio(req, res) {
  if (!validarLectio(req.body)) return res.status(400).json({ ok: false, mensaje: 'Título y archivo son obligatorios' })
  responderEscritura(res, await comunicacionesService.actualizarLectio(req.params.id, req.body))
}

async function eliminarLectio(req, res) {
  responderEscritura(res, await comunicacionesService.eliminarLectio(req.params.id))
}

async function listarEquipo(req, res) {
  res.json(await comunicacionesService.listarEquipo())
}

async function buscarServidor(req, res) {
  const { q } = req.query
  if (!q) return res.json([])
  res.json(await comunicacionesService.buscarServidor(q))
}

async function asignarRol(req, res) {
  responderEscritura(res, await comunicacionesService.asignarRol(req.params.id))
}

async function quitarRol(req, res) {
  responderEscritura(res, await comunicacionesService.quitarRol(req.params.id))
}

module.exports = {
  listarPublicaciones,
  crearPublicacion,
  actualizarPublicacion,
  eliminarPublicacion,
  listarLectio,
  crearLectio,
  actualizarLectio,
  eliminarLectio,
  listarEquipo,
  buscarServidor,
  asignarRol,
  quitarRol,
}
