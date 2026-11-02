const express = require('express')
const { exigirMiembroId, verificarAdmin } = require('../middlewares/auth')
const consejo = require('../controllers/consejoController')

const router = express.Router()

// Desde el panel del consejo: solo exige x-miembro-id
router.get('/api/consejo/miembros', exigirMiembroId([]), consejo.listarMiembros)
router.put('/api/consejo/miembro/:id/responsabilidades', exigirMiembroId({ ok: false }), consejo.actualizarResponsabilidades)

// Administración del consejo
router.get('/api/admin/consejo/miembros', verificarAdmin, consejo.listarMiembrosParaAdmin)
router.get('/api/admin/consejo/buscar-miembro', verificarAdmin, consejo.buscarCandidatos)
router.put('/api/admin/consejo/miembro/:id/agregar', verificarAdmin, consejo.agregarAlConsejo)
router.put('/api/admin/consejo/miembro/:id/eliminar', verificarAdmin, consejo.eliminarDelConsejo)
router.put('/api/admin/consejo/miembro/:id/quitar-coordinador', verificarAdmin, consejo.quitarCoordinador)
router.put('/api/admin/consejo/miembro/:id/coordinador', verificarAdmin, consejo.asignarCoordinador)

module.exports = router
