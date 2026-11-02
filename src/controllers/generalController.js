const generalService = require('../services/generalService')
const { responderEscritura } = require('../utils/respuestas')

function salud(req, res) {
  res.json({ ok: true, mensaje: 'Backend funcionando' })
}

async function subirArchivo(req, res) {
  if (!req.file) return res.status(400).json({ ok: false, mensaje: 'No se recibió archivo' })
  const { bucket, carpeta, nombre } = req.body
  const { error, url } = await generalService.subirArchivo(req.file, { bucket, carpeta, nombre })
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true, url })
}

async function eliminarArchivo(req, res) {
  const { bucket, path } = req.body
  if (!bucket || !path) return res.status(400).json({ ok: false, mensaje: 'Faltan bucket y path' })
  responderEscritura(res, await generalService.eliminarArchivo(bucket, path))
}

async function contacto(req, res) {
  const { nombre, email, asunto, mensaje } = req.body
  if (!nombre || !email || !mensaje) {
    return res.status(400).json({ ok: false, mensaje: 'Nombre, correo y mensaje son obligatorios' })
  }
  try {
    const resultado = await generalService.enviarContacto({ nombre, email, asunto, mensaje })
    if (resultado.error) return res.status(500).json({ ok: false, mensaje: resultado.error.message })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ ok: false, mensaje: 'No se pudo enviar el mensaje' })
  }
}

module.exports = { salud, subirArchivo, eliminarArchivo, contacto }
