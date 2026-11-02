const express = require('express')
const { exigirMiembroId, verificarAdmin } = require('../middlewares/auth')
const formacion = require('../controllers/formacionController')

const router = express.Router()

// Las escrituras solo exigen x-miembro-id (identifica al responsable en el historial)
const conResponsable = exigirMiembroId({ ok: false, mensaje: 'No autorizado' })

// Panel de formación (sin autenticación en las lecturas)
router.get('/api/formacion/pendientes', formacion.listarPendientes)
router.get('/api/formacion/aprobados-formacion', formacion.listarAprobadosFormacion)
router.get('/api/formacion/aprobados-consagracion', formacion.listarAprobadosConsagracion)
router.put('/api/formacion/consagrar-pacientes', conResponsable, formacion.consagrar)
router.get('/api/formacion/cumple-requisitos', formacion.listarCumpleRequisitos)
router.put('/api/formacion/concepto-consejo/:id', conResponsable, formacion.registrarConceptoConsejo)
router.put('/api/formacion/estado/:id', conResponsable, formacion.cambiarEstado)

// Junta directiva
router.get('/api/junta/pendientes', verificarAdmin, formacion.listarPendientesJunta)
router.put('/api/junta/decision/:id', verificarAdmin, formacion.registrarDecisionJunta)

module.exports = router
