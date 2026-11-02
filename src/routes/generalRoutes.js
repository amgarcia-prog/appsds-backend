const express = require('express')
const upload = require('../config/upload')
const { verificarAdmin } = require('../middlewares/auth')
const general = require('../controllers/generalController')

const router = express.Router()

router.get('/api/health', general.salud)
router.post('/api/upload', upload.single('archivo'), general.subirArchivo)
router.delete('/api/admin/storage', verificarAdmin, general.eliminarArchivo)
router.post('/api/contacto', general.contacto)

module.exports = router
