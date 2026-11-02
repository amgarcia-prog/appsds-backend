const pilarService = require('../services/pilarService')
const { responderEscritura } = require('../utils/respuestas')

async function listarRegistros(req, res) {
  const miembroId = req.headers['x-miembro-id']
  if (!miembroId) return res.status(401).json({ error: 'sin id' })
  const { resultado, estado, data, error } = await pilarService.listarRegistros(miembroId)
  if (resultado === 'no_encontrado') return res.status(403).json({ error: 'miembro no encontrado', miembroId })
  if (resultado === 'no_es_pilar') return res.status(403).json({ error: 'no es pilar', estado })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
}

// Ciudades del propio pilar (x-miembro-id)
async function listarMisCiudades(req, res) {
  res.json(await pilarService.listarCiudades(req.headers['x-miembro-id']))
}

async function agregarMiCiudad(req, res) {
  responderEscritura(res, await pilarService.agregarCiudad(req.headers['x-miembro-id'], req.body))
}

async function eliminarMiCiudad(req, res) {
  responderEscritura(res, await pilarService.eliminarCiudad(req.params.ciudadId, req.headers['x-miembro-id']))
}

// Gestión organizacional de cualquier pilar
async function listarPilares(req, res) {
  res.json(await pilarService.listarPilares())
}

async function actualizarResponsabilidades(req, res) {
  const { responsabilidades } = req.body
  if (!Array.isArray(responsabilidades)) return res.status(400).json({ ok: false, mensaje: 'Formato inválido' })
  responderEscritura(res, await pilarService.actualizarResponsabilidades(req.params.id, responsabilidades))
}

async function listarCiudadesDePilar(req, res) {
  res.json(await pilarService.listarCiudades(req.params.id))
}

async function agregarCiudadAPilar(req, res) {
  responderEscritura(res, await pilarService.agregarCiudad(req.params.id, req.body))
}

async function eliminarCiudadDePilar(req, res) {
  responderEscritura(res, await pilarService.eliminarCiudad(req.params.ciudadId, req.params.pilarId))
}

module.exports = {
  listarRegistros,
  listarMisCiudades,
  agregarMiCiudad,
  eliminarMiCiudad,
  listarPilares,
  actualizarResponsabilidades,
  listarCiudadesDePilar,
  agregarCiudadAPilar,
  eliminarCiudadDePilar,
}
