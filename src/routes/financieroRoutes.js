const express = require('express')
const { verificarFinanciero } = require('../middlewares/auth')
const financiero = require('../controllers/financieroController')
const recibos = require('../controllers/recibosController')
const reportes = require('../controllers/reportesController')

const router = express.Router()

// Todo el módulo exige responsable financiero, salvo el reporte de donación de la web pública
router.get('/api/financiero/puntos-servicio', verificarFinanciero, financiero.listarPuntosServicio)

router.get('/api/financiero/providentes', verificarFinanciero, financiero.listarProvidentes)
router.post('/api/financiero/providentes', verificarFinanciero, financiero.crearProvidente)
router.put('/api/financiero/providentes/:id', verificarFinanciero, financiero.actualizarProvidente)
router.delete('/api/financiero/providentes/:id', verificarFinanciero, financiero.eliminarProvidente)

router.get('/api/financiero/ingresos', verificarFinanciero, financiero.listarIngresos)
router.post('/api/financiero/ingresos', verificarFinanciero, financiero.crearIngreso)
router.put('/api/financiero/ingresos/:id', verificarFinanciero, financiero.actualizarIngreso)
router.delete('/api/financiero/ingresos/:id', verificarFinanciero, financiero.eliminarIngreso)
router.patch('/api/financiero/ingresos/:id/revisado', verificarFinanciero, financiero.marcarIngresoRevisado)
router.patch('/api/financiero/egresos/:id/revisado', verificarFinanciero, financiero.marcarEgresoRevisado)

router.post('/api/financiero/reportes-donacion', financiero.crearReporteDonacion)
router.get('/api/financiero/reportes-donacion', verificarFinanciero, financiero.listarReportesDonacion)
router.patch('/api/financiero/reportes-donacion/:id/atendido', verificarFinanciero, financiero.marcarReporteAtendido)

router.get('/api/financiero/egresos', verificarFinanciero, financiero.listarEgresos)
router.post('/api/financiero/egresos', verificarFinanciero, financiero.crearEgreso)
router.put('/api/financiero/egresos/:id', verificarFinanciero, financiero.actualizarEgreso)
router.delete('/api/financiero/egresos/:id', verificarFinanciero, financiero.eliminarEgreso)

router.get('/api/financiero/consulta/aportes-benefactor', verificarFinanciero, financiero.aportesDeBenefactor)
router.get('/api/financiero/consulta/movimiento-banco', verificarFinanciero, financiero.movimientoBanco)
router.get('/api/financiero/consulta/busqueda-concepto', verificarFinanciero, financiero.buscarPorConcepto)
router.get('/api/financiero/consulta/donaciones-especie', verificarFinanciero, financiero.donacionesEnEspecie)

router.post('/api/financiero/enviar-recibo/:id', verificarFinanciero, recibos.enviar)
router.get('/api/financiero/proximo-recibo', verificarFinanciero, recibos.proximoNumero)
router.get('/api/financiero/recibo/:id', verificarFinanciero, recibos.descargar)
router.get('/api/financiero/reporte/recibos-mes', verificarFinanciero, recibos.descargarDelMes)

router.get('/api/financiero/reporte/aportes-consagrados', verificarFinanciero, reportes.aportesConsagrados)
router.get('/api/financiero/reporte/donaciones', verificarFinanciero, reportes.donaciones)
router.get('/api/financiero/reporte/movimiento-banco', verificarFinanciero, reportes.movimientoBanco)
router.get('/api/financiero/reporte/movimiento-caja-menor', verificarFinanciero, reportes.movimientoCajaMenor)
router.get('/api/financiero/reporte/consumo-caja-menor', verificarFinanciero, reportes.consumoCajaMenor)
router.get('/api/financiero/reporte/imagenes-banco', verificarFinanciero, reportes.imagenesBanco)
router.get('/api/financiero/reporte/imagenes-caja-menor', verificarFinanciero, reportes.imagenesCajaMenor)
router.get('/api/financiero/reporte/imagenes-consumo-caja-menor', verificarFinanciero, reportes.imagenesConsumoCajaMenor)
router.get('/api/financiero/reporte/imagenes-especie', verificarFinanciero, reportes.imagenesEspecie)

router.get('/api/financiero/saldo-inicial', verificarFinanciero, financiero.obtenerSaldoInicial)
router.put('/api/financiero/saldo-inicial', verificarFinanciero, financiero.guardarSaldoInicial)
router.get('/api/financiero/totales-cuenta', verificarFinanciero, financiero.totalesCuenta)

router.get('/api/financiero/equipo', verificarFinanciero, financiero.listarEquipo)
router.get('/api/financiero/buscar-servidor', verificarFinanciero, financiero.buscarServidor)
router.put('/api/financiero/asignar-rol/:id', verificarFinanciero, financiero.asignarRol)
router.put('/api/financiero/quitar-rol/:id', verificarFinanciero, financiero.quitarRol)

module.exports = router
