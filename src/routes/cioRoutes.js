const express = require('express')
const { verificarCIO } = require('../middlewares/auth')
const cio = require('../controllers/cioController')

const router = express.Router()

router.get('/api/cio/clientes', verificarCIO, cio.listarClientes)
router.post('/api/cio/clientes', verificarCIO, cio.crearCliente)
router.put('/api/cio/clientes/:id', verificarCIO, cio.actualizarCliente)
router.delete('/api/cio/clientes/:id', verificarCIO, cio.eliminarCliente)

router.get('/api/cio/proyectos/:clienteId', verificarCIO, cio.listarProyectos)
router.post('/api/cio/proyectos', verificarCIO, cio.crearProyecto)
router.put('/api/cio/proyectos/:id', verificarCIO, cio.actualizarProyecto)
router.delete('/api/cio/proyectos/:id', verificarCIO, cio.eliminarProyecto)

router.post('/api/cio/productos', verificarCIO, cio.crearProducto)
router.put('/api/cio/productos/:id', verificarCIO, cio.actualizarProducto)
router.delete('/api/cio/productos/:id', verificarCIO, cio.eliminarProducto)

router.post('/api/cio/items', verificarCIO, cio.crearItem)
router.put('/api/cio/items/:id', verificarCIO, cio.actualizarItem)
router.delete('/api/cio/items/:id', verificarCIO, cio.eliminarItem)

router.post('/api/cio/tiempo', verificarCIO, cio.crearTiempo)
router.put('/api/cio/tiempo/:id', verificarCIO, cio.actualizarTiempo)
router.delete('/api/cio/tiempo/:id', verificarCIO, cio.eliminarTiempo)

module.exports = router
