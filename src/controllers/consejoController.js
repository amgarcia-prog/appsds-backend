const consejoService = require('../services/consejoService')
const { responderEscritura } = require('../utils/respuestas')

async function listarMiembros(req, res) {
  const { ciudad } = req.query
  if (!ciudad) return res.status(400).json([])
  res.json(await consejoService.listarMiembros(ciudad))
}

async function actualizarResponsabilidades(req, res) {
  const { responsabilidades } = req.body
  if (!Array.isArray(responsabilidades)) return res.status(400).json({ ok: false, mensaje: 'Formato inválido' })
  responderEscritura(res, await consejoService.actualizarResponsabilidades(req.params.id, responsabilidades))
}

async function listarMiembrosParaAdmin(req, res) {
  const { ciudad } = req.query
  if (!ciudad) return res.status(400).json([])
  res.json(await consejoService.listarMiembrosParaAdmin(ciudad))
}

async function buscarCandidatos(req, res) {
  const { q, ciudad } = req.query
  if (!q || !ciudad) return res.json([])
  res.json(await consejoService.buscarCandidatos(q, ciudad))
}

async function agregarAlConsejo(req, res) {
  responderEscritura(res, await consejoService.agregarAlConsejo(req.params.id))
}

async function eliminarDelConsejo(req, res) {
  responderEscritura(res, await consejoService.eliminarDelConsejo(req.params.id))
}

async function quitarCoordinador(req, res) {
  const { rol } = req.body
  responderEscritura(res, await consejoService.quitarResponsabilidad(req.params.id, rol))
}

// tipo: 'principal' | 'suplente'
async function asignarCoordinador(req, res) {
  const { tipo, ciudadActual } = req.body
  responderEscritura(res, await consejoService.asignarCoordinador(req.params.id, tipo, ciudadActual))
}

module.exports = {
  listarMiembros,
  actualizarResponsabilidades,
  listarMiembrosParaAdmin,
  buscarCandidatos,
  agregarAlConsejo,
  eliminarDelConsejo,
  quitarCoordinador,
  asignarCoordinador,
}
