const express = require('express')
const evaluacion = require('../controllers/evaluacionController')

const router = express.Router()

// Sin guards: la evaluación tiene su propio login y recibe el id del evaluador en el cuerpo o la query
router.post('/api/evaluacion/login', evaluacion.iniciarSesion)
router.get('/api/evaluacion/pilares', evaluacion.listarPilares)
router.post('/api/evaluacion/guardar', evaluacion.guardar)
router.get('/api/evaluacion/ya-evaluo', evaluacion.yaEvaluo)
router.get('/api/evaluacion/resultados', evaluacion.resultados)

module.exports = router
