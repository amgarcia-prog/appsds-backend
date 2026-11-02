const express = require('express')
const { exigirMiembroId } = require('../middlewares/auth')
const miembro = require('../controllers/miembroController')

const router = express.Router()

router.get('/api/miembro/perfil', exigirMiembroId({ ok: false }), miembro.obtenerPerfil)
router.put('/api/miembro/perfil', exigirMiembroId({ ok: false }), miembro.actualizarPerfil)
router.put('/api/miembro/cambiar-clave', exigirMiembroId({ ok: false, mensaje: 'No autorizado' }), miembro.cambiarClave)
router.post('/api/miembro/solicitar-consagracion', exigirMiembroId({ ok: false, mensaje: 'No autorizado' }), miembro.solicitarConsagracion)

// Sin autenticación
router.get('/api/miembro/cumpleanos', miembro.listarCumpleanos)

module.exports = router
