const multer = require('multer')

const LIMITE_ARCHIVO_MB = 50

// Los archivos quedan en memoria y se suben a Supabase Storage
module.exports = multer({ storage: multer.memoryStorage(), limits: { fileSize: LIMITE_ARCHIVO_MB * 1024 * 1024 } })
module.exports.LIMITE_ARCHIVO_MB = LIMITE_ARCHIVO_MB
