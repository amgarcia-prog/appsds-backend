const express = require('express')
const { verificarAdmin } = require('../middlewares/auth')
const admin = require('../controllers/adminController')

const router = express.Router()

router.get('/api/admin/registros', verificarAdmin, admin.listarRegistros)
router.put('/api/admin/registros/:id', verificarAdmin, admin.actualizarRegistro)
router.delete('/api/admin/registros/:id', verificarAdmin, admin.eliminarRegistro)
router.put('/api/admin/registros/:id/rol-financiero', verificarAdmin, admin.establecerRolFinanciero)

// Lista pública de puntos de servicio activos
router.get('/api/puntos-servicio', admin.listarPuntosActivos)

// Admin o pilar; la autorización la resuelve el controlador
router.post('/api/admin/enviar-correo-masivo', admin.enviarCorreoMasivo)

router.get('/api/admin/puntos-servicio', verificarAdmin, admin.listarPuntos)
router.post('/api/admin/puntos-servicio', verificarAdmin, admin.crearPunto)
router.put('/api/admin/puntos-servicio/:id', verificarAdmin, admin.actualizarPunto)
router.delete('/api/admin/puntos-servicio/:id', verificarAdmin, admin.eliminarPunto)

module.exports = router
