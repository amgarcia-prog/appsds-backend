const express = require('express')
const { exigirMiembroId, verificarPilarOrganizacional } = require('../middlewares/auth')
const pilar = require('../controllers/pilarController')

const router = express.Router()

// El controlador verifica que el miembro sea pilar
router.get('/api/pilar/registros', pilar.listarRegistros)

// Ciudades a cargo del propio pilar
router.get('/api/pilar/ciudades', exigirMiembroId([]), pilar.listarMisCiudades)
router.post('/api/pilar/ciudades', exigirMiembroId({ ok: false }), pilar.agregarMiCiudad)
router.delete('/api/pilar/ciudades/:ciudadId', exigirMiembroId({ ok: false }), pilar.eliminarMiCiudad)

// Pilar organizacional
router.get('/api/organizacional/pilares', verificarPilarOrganizacional, pilar.listarPilares)
router.put('/api/organizacional/pilar/:id/responsabilidades', verificarPilarOrganizacional, pilar.actualizarResponsabilidades)
router.get('/api/organizacional/pilar/:id/ciudades', verificarPilarOrganizacional, pilar.listarCiudadesDePilar)
router.post('/api/organizacional/pilar/:id/ciudades', verificarPilarOrganizacional, pilar.agregarCiudadAPilar)
router.delete('/api/organizacional/pilar/:pilarId/ciudades/:ciudadId', verificarPilarOrganizacional, pilar.eliminarCiudadDePilar)

module.exports = router
