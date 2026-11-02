const miembroService = require('../services/miembroService')
const { responderEscritura } = require('../utils/respuestas')

// x-miembro-id identifica al miembro en todas estas rutas

async function obtenerPerfil(req, res) {
  const datos = await miembroService.obtenerPerfil(req.headers['x-miembro-id'])
  if (!datos) return res.status(404).json({ ok: false })
  res.json({ ok: true, datos })
}

async function actualizarPerfil(req, res) {
  const cambios = miembroService.cambiosDePerfil(req.body)
  if (Object.keys(cambios).length === 0)
    return res.status(400).json({ ok: false, mensaje: 'No hay campos para actualizar' })
  responderEscritura(res, await miembroService.actualizarPerfil(req.headers['x-miembro-id'], cambios))
}

async function cambiarClave(req, res) {
  const { claveActual, claveNueva } = req.body
  if (!claveActual || !claveNueva) return res.status(400).json({ ok: false, mensaje: 'Faltan datos' })
  if (claveNueva.length < 6) return res.status(400).json({ ok: false, mensaje: 'La clave nueva debe tener al menos 6 caracteres' })
  const { resultado, error } = await miembroService.cambiarClave(req.headers['x-miembro-id'], claveActual, claveNueva)
  if (resultado === 'no_encontrado') return res.status(404).json({ ok: false, mensaje: 'No encontrado' })
  if (resultado === 'clave_incorrecta') return res.status(401).json({ ok: false, mensaje: 'La clave actual es incorrecta' })
  responderEscritura(res, { error })
}

async function solicitarConsagracion(req, res) {
  const { motivacion, otra_comunidad } = req.body
  if (!motivacion?.trim()) return res.status(400).json({ ok: false, mensaje: 'La motivación es obligatoria' })
  const { resultado, error } = await miembroService.solicitarConsagracion(req.headers['x-miembro-id'], motivacion, otra_comunidad)
  if (resultado === 'no_encontrado') return res.status(404).json({ ok: false, mensaje: 'No encontrado' })
  responderEscritura(res, { error })
}

async function listarCumpleanos(req, res) {
  const { desde, hasta, ciudad } = req.query
  if (!desde || !hasta || !ciudad) return res.status(400).json({ ok: false, mensaje: 'Faltan parámetros' })
  res.json(await miembroService.listarCumpleanos(desde, hasta, ciudad))
}

module.exports = { obtenerPerfil, actualizarPerfil, cambiarClave, solicitarConsagracion, listarCumpleanos }
