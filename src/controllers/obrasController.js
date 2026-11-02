const obrasService = require('../services/obrasService')
const { responderEscritura } = require('../utils/respuestas')

async function crearPuntoServicio(req, res) {
  const { nombre } = req.body
  if (!nombre?.trim()) return res.status(400).json({ ok: false, mensaje: 'Falta el nombre' })
  const { resultado, error } = await obrasService.crearPuntoServicio(req.headers['x-miembro-id'], nombre)
  if (resultado === 'miembro_no_encontrado') return res.status(404).json({ ok: false, mensaje: 'Miembro no encontrado' })
  responderEscritura(res, { error })
}

async function eliminarPuntoServicio(req, res) {
  responderEscritura(res, await obrasService.eliminarPuntoServicio(req.params.id))
}

async function listarPuntosServicio(req, res) {
  const { ciudad } = req.query
  if (!ciudad) return res.status(400).json([])
  res.json(await obrasService.listarPuntosConConteo(ciudad))
}

async function listarMiembrosDePunto(req, res) {
  const { punto, ciudad } = req.query
  if (!punto || !ciudad) return res.status(400).json([])
  res.json(await obrasService.listarMiembrosDePunto(punto, ciudad))
}

async function buscarMiembro(req, res) {
  const { q, ciudad } = req.query
  if (!q || !ciudad) return res.json([])
  res.json(await obrasService.buscarMiembro(q, ciudad))
}

// Acciones sobre el punto de un miembro: todas exigen el nombre del punto
const conPunto = (accion) => async (req, res) => {
  const { punto } = req.body
  if (!punto) return res.status(400).json({ ok: false, mensaje: 'Falta el punto' })
  responderEscritura(res, await accion(req.params.id, punto))
}

module.exports = {
  crearPuntoServicio,
  eliminarPuntoServicio,
  listarPuntosServicio,
  listarMiembrosDePunto,
  buscarMiembro,
  adicionarCoordinador: conPunto(obrasService.adicionarCoordinador),
  quitarCoordinador: conPunto(obrasService.quitarCoordinador),
  agregarPunto: conPunto(obrasService.agregarPunto),
  quitarPunto: conPunto(obrasService.quitarPunto),
}
