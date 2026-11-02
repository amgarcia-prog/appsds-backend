const express = require('express')
const { verificarComunicacionesConsejo } = require('../middlewares/auth')
const miCiudad = require('../controllers/miCiudadController')

const router = express.Router()

router.get('/api/mi-ciudad/contenido', verificarComunicacionesConsejo, miCiudad.obtenerContenido)
router.put('/api/mi-ciudad/contenido', verificarComunicacionesConsejo, miCiudad.guardarContenido)
router.get('/api/mi-ciudad/servicios', verificarComunicacionesConsejo, miCiudad.listarServicios)
router.post('/api/mi-ciudad/servicios', verificarComunicacionesConsejo, miCiudad.crearServicio)
router.put('/api/mi-ciudad/servicios/:id', verificarComunicacionesConsejo, miCiudad.actualizarServicio)
router.delete('/api/mi-ciudad/servicios/:id', verificarComunicacionesConsejo, miCiudad.eliminarServicio)

// Lectura pública para la página web (sin autenticación)
router.get('/api/ciudad-publica/:nombre', miCiudad.obtenerCiudadPublica)

module.exports = router
