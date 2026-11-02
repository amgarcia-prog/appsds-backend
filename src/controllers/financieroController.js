// req.ciudadFinanciero lo deja verificarFinanciero; x-miembro-id identifica a quien registra o edita
const financieroService = require('../services/financieroService')
const { responderEscritura, responderCreacion } = require('../utils/respuestas')

const ciudad = (req) => req.ciudadFinanciero
const miembro = (req) => req.headers['x-miembro-id']

// Las consultas responden { error } cuando fallan
function responderConsulta(res, { data, error }) {
  if (error) return res.status(500).json({ error: error.message })
  res.json(data || [])
}

async function listarPuntosServicio(req, res) {
  res.json(await financieroService.listarPuntosServicio(ciudad(req)))
}

// ── Providentes ──

async function listarProvidentes(req, res) {
  res.json(await financieroService.listarProvidentes(ciudad(req), req.query.q))
}

async function crearProvidente(req, res) {
  const { numero_identificacion, nombre } = req.body
  if (!numero_identificacion || !nombre) return res.status(400).json({ ok: false, mensaje: 'Cédula y nombre son requeridos' })
  responderCreacion(res, await financieroService.crearProvidente(ciudad(req), req.body))
}

async function actualizarProvidente(req, res) {
  responderEscritura(res, await financieroService.actualizarProvidente(req.params.id, ciudad(req), req.body))
}

async function eliminarProvidente(req, res) {
  responderEscritura(res, await financieroService.eliminarProvidente(req.params.id, ciudad(req)))
}

// ── Ingresos ──

async function listarIngresos(req, res) {
  const { mes, anio } = req.query
  res.json(await financieroService.listarIngresos(ciudad(req), mes, anio))
}

async function crearIngreso(req, res) {
  const { fecha, tipo, concepto, valor } = req.body
  if (!fecha || !tipo || !concepto || !valor) return res.status(400).json({ ok: false, mensaje: 'Faltan campos requeridos' })
  responderCreacion(res, await financieroService.crearIngreso(ciudad(req), miembro(req), req.body))
}

async function actualizarIngreso(req, res) {
  responderEscritura(res, await financieroService.actualizarIngreso(req.params.id, ciudad(req), miembro(req), req.body))
}

async function eliminarIngreso(req, res) {
  responderEscritura(res, await financieroService.eliminarIngreso(req.params.id, ciudad(req)))
}

async function marcarIngresoRevisado(req, res) {
  const { revisado } = req.body
  responderEscritura(res, await financieroService.marcarIngresoRevisado(req.params.id, ciudad(req), revisado))
}

// ── Egresos ──

async function listarEgresos(req, res) {
  const { mes, anio } = req.query
  res.json(await financieroService.listarEgresos(ciudad(req), mes, anio))
}

async function crearEgreso(req, res) {
  const { fecha, concepto, valor } = req.body
  if (!fecha || !concepto || !valor) return res.status(400).json({ ok: false, mensaje: 'Faltan campos requeridos' })
  responderCreacion(res, await financieroService.crearEgreso(ciudad(req), miembro(req), req.body))
}

async function actualizarEgreso(req, res) {
  responderEscritura(res, await financieroService.actualizarEgreso(req.params.id, ciudad(req), miembro(req), req.body))
}

async function eliminarEgreso(req, res) {
  responderEscritura(res, await financieroService.eliminarEgreso(req.params.id, ciudad(req)))
}

async function marcarEgresoRevisado(req, res) {
  const { revisado } = req.body
  responderEscritura(res, await financieroService.marcarEgresoRevisado(req.params.id, ciudad(req), revisado))
}

// ── Reportes de donación ──

// Público: la ciudad llega en el cuerpo
async function crearReporteDonacion(req, res) {
  const { ciudad: ciudadReporte, nombre_donante, cedula, correo, telefono, valor, comprobante_url, concepto } = req.body
  if (!ciudadReporte || !nombre_donante || !cedula || !correo || !telefono || !valor || !comprobante_url || !concepto) {
    return res.status(400).json({ ok: false, mensaje: 'Faltan campos requeridos' })
  }
  responderEscritura(res, await financieroService.crearReporteDonacion(req.body))
}

async function listarReportesDonacion(req, res) {
  res.json(await financieroService.listarReportesDonacion(ciudad(req)))
}

async function marcarReporteAtendido(req, res) {
  responderEscritura(res, await financieroService.marcarReporteAtendido(req.params.id, ciudad(req)))
}

// ── Consultas ──

async function aportesDeBenefactor(req, res) {
  const { providente_id, anio } = req.query
  responderConsulta(res, await financieroService.aportesDeBenefactor(ciudad(req), providente_id, anio))
}

async function movimientoBanco(req, res) {
  const { desde, hasta } = req.query
  if (!desde || !hasta) return res.status(400).json({ error: 'Fechas requeridas' })
  res.json(await financieroService.movimientoBanco(ciudad(req), desde, hasta))
}

async function buscarPorConcepto(req, res) {
  const { desde, hasta, q } = req.query
  if (!desde || !hasta || !q) return res.status(400).json({ error: 'Parámetros requeridos' })
  res.json(await financieroService.buscarPorConcepto(ciudad(req), desde, hasta, q))
}

async function donacionesEnEspecie(req, res) {
  const { desde, hasta } = req.query
  if (!desde || !hasta) return res.status(400).json({ error: 'Fechas requeridas' })
  responderConsulta(res, await financieroService.donacionesEnEspecie(ciudad(req), desde, hasta))
}

// ── Saldos ──

async function obtenerSaldoInicial(req, res) {
  res.json({ saldo: await financieroService.obtenerSaldoInicial(ciudad(req), req.query.cuenta) })
}

async function guardarSaldoInicial(req, res) {
  const { cuenta, saldo } = req.body
  responderEscritura(res, await financieroService.guardarSaldoInicial(ciudad(req), cuenta, saldo))
}

async function totalesCuenta(req, res) {
  const { cuenta, hasta } = req.query
  res.json(await financieroService.totalesCuenta(ciudad(req), cuenta, hasta))
}

// ── Equipo financiero ──

async function listarEquipo(req, res) {
  res.json(await financieroService.listarEquipo(ciudad(req)))
}

async function buscarServidor(req, res) {
  const { q } = req.query
  if (!q) return res.json([])
  res.json(await financieroService.buscarServidor(ciudad(req), q))
}

async function asignarRol(req, res) {
  responderEscritura(res, await financieroService.asignarRol(req.params.id))
}

async function quitarRol(req, res) {
  responderEscritura(res, await financieroService.quitarRol(req.params.id))
}

module.exports = {
  listarPuntosServicio,
  listarProvidentes, crearProvidente, actualizarProvidente, eliminarProvidente,
  listarIngresos, crearIngreso, actualizarIngreso, eliminarIngreso, marcarIngresoRevisado,
  listarEgresos, crearEgreso, actualizarEgreso, eliminarEgreso, marcarEgresoRevisado,
  crearReporteDonacion, listarReportesDonacion, marcarReporteAtendido,
  aportesDeBenefactor, movimientoBanco, buscarPorConcepto, donacionesEnEspecie,
  obtenerSaldoInicial, guardarSaldoInicial, totalesCuenta,
  listarEquipo, buscarServidor, asignarRol, quitarRol,
}
