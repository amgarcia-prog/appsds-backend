const express = require('express')
const { verificarComunicaciones } = require('../middlewares/auth')
const comunicaciones = require('../controllers/comunicacionesController')

const router = express.Router()

// Publicaciones (noticias del Home)
router.get('/api/publicaciones', comunicaciones.listarPublicaciones)
router.post('/api/admin/publicaciones', verificarComunicaciones, comunicaciones.crearPublicacion)
router.put('/api/admin/publicaciones/:id', verificarComunicaciones, comunicaciones.actualizarPublicacion)
router.delete('/api/admin/publicaciones/:id', verificarComunicaciones, comunicaciones.eliminarPublicacion)

// Lectio del Servicio
router.get('/api/lectio-servicio', comunicaciones.listarLectio)
router.post('/api/comunicaciones/lectio-servicio', verificarComunicaciones, comunicaciones.crearLectio)
router.put('/api/comunicaciones/lectio-servicio/:id', verificarComunicaciones, comunicaciones.actualizarLectio)
router.delete('/api/comunicaciones/lectio-servicio/:id', verificarComunicaciones, comunicaciones.eliminarLectio)

// Equipo de comunicaciones
router.get('/api/comunicaciones/equipo', verificarComunicaciones, comunicaciones.listarEquipo)
router.get('/api/comunicaciones/buscar-servidor', verificarComunicaciones, comunicaciones.buscarServidor)
router.put('/api/comunicaciones/asignar-rol/:id', verificarComunicaciones, comunicaciones.asignarRol)
router.put('/api/comunicaciones/quitar-rol/:id', verificarComunicaciones, comunicaciones.quitarRol)

module.exports = router
