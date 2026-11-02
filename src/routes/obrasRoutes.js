const express = require('express')
const { exigirMiembroId } = require('../middlewares/auth')
const obras = require('../controllers/obrasController')

const router = express.Router()

// Panel de obras: solo exige x-miembro-id
const conMiembro = exigirMiembroId({ ok: false })
const conMiembroLista = exigirMiembroId([])

router.post('/api/obras/puntos-servicio', conMiembro, obras.crearPuntoServicio)
router.delete('/api/obras/puntos-servicio/:id', conMiembro, obras.eliminarPuntoServicio)
router.get('/api/obras/puntos-servicio', conMiembroLista, obras.listarPuntosServicio)
router.get('/api/obras/miembros-punto', conMiembroLista, obras.listarMiembrosDePunto)
router.put('/api/obras/miembro/:id/adicionar-coordinador', conMiembro, obras.adicionarCoordinador)
router.put('/api/obras/miembro/:id/quitar-coordinador', conMiembro, obras.quitarCoordinador)
router.get('/api/obras/buscar-miembro', conMiembroLista, obras.buscarMiembro)
router.put('/api/obras/miembro/:id/agregar-punto', conMiembro, obras.agregarPunto)
router.put('/api/obras/miembro/:id/quitar-punto', conMiembro, obras.quitarPunto)

module.exports = router
