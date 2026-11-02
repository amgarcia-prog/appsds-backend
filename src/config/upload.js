const multer = require('multer')

// Los archivos quedan en memoria y se suben a Supabase Storage
module.exports = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } })
