const multer = require('multer')
const { LIMITE_ARCHIVO_MB } = require('../config/upload')

// Manejo central de errores. Express 5 envía aquí las promesas rechazadas de los handlers.
// Mismo criterio de status que Express: err.status / err.statusCode si es 4xx-5xx, si no 500.
function statusDeError(err) {
  const status = err.status || err.statusCode
  return Number.isInteger(status) && status >= 400 && status < 600 ? status : 500
}

function mensajeMulter(err) {
  if (err.code === 'LIMIT_FILE_SIZE') return `El archivo supera el tamaño máximo permitido (${LIMITE_ARCHIVO_MB} MB).`
  return 'No se pudo subir el archivo: ' + err.message
}

// Express reconoce el manejador de errores por sus cuatro parámetros
module.exports = (err, req, res, next) => {
  if (res.headersSent) return next(err)
  if (err instanceof multer.MulterError) return res.status(400).json({ ok: false, mensaje: mensajeMulter(err) })
  const status = statusDeError(err)
  if (status >= 500) console.error(`❌ Error no controlado en ${req.method} ${req.originalUrl}:`, err)
  res.status(status).json({ ok: false, mensaje: status >= 500 ? 'Error interno del servidor' : err.message })
}
