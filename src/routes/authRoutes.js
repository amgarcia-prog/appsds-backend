const express = require('express')
const auth = require('../controllers/authController')

const router = express.Router()

router.get('/api/verificar-cedula', auth.verificarCedula)
router.post('/api/registro', auth.registrar)
router.post('/api/login', auth.iniciarSesion)
router.post('/api/olvide-clave', auth.olvideClave)
router.post('/api/restablecer-clave', auth.restablecerClave)

module.exports = router
