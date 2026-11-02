// Datos de los reportes mensuales del área financiera (Excel y PDF de imágenes)
const ingresosModel = require('../models/ingresosModel')
const egresosModel = require('../models/egresosModel')
const imagenesModel = require('../models/imagenesModel')
const { saldoAnterior, intercalarPorFecha } = require('./financieroService')

const nombreDe = (r) => r.providente?.nombre || r.providente_otro || ''

// Aportes de consagrados ordenados por nombre del benefactor
async function aportesConsagrados(ciudad, desde, hasta) {
  const { data } = await ingresosModel.listarDeTipoEnRango('*, providente:providente_id(nombre)', ciudad, 'aporte_consagrado', desde, hasta, 'providente_id')
  return (data || []).sort((a, b) => nombreDe(a).localeCompare(nombreDe(b)))
}

async function donaciones(ciudad, desde, hasta) {
  const { data } = await ingresosModel.listarDeTipoEnRango(
    '*, providente:providente_id(nombre, telefono), punto:punto_servicio_id(nombre)', ciudad, 'donacion_servicio', desde, hasta, 'numero_recibo')
  const registros = data || []
  return {
    especie: registros.filter(r => r.forma_donacion === 'especie'),
    dinero: registros.filter(r => r.forma_donacion !== 'especie'),
  }
}

// Columnas de ingresos y egresos que necesita cada reporte de movimiento
const COLUMNAS_MOVIMIENTO = {
  banco: ['*, providente:providente_id(nombre), punto:punto_servicio_id(nombre)', '*, punto:punto_servicio_id(nombre)'],
  caja_menor: ['*', '*'],
  consumo_caja_menor: ['*', '*, punto:punto_servicio_id(nombre)'],
}

// Saldo al inicio del mes y movimientos del mes intercalados por fecha
async function movimientoDeCuenta(ciudad, cuenta, desde, hasta) {
  const [columnasIngresos, columnasEgresos] = COLUMNAS_MOVIMIENTO[cuenta]
  const [anterior, { data: ingresos }, { data: egresos }] = await Promise.all([
    saldoAnterior(ciudad, cuenta, desde),
    ingresosModel.movimientosDeCuenta(columnasIngresos, ciudad, cuenta, desde, hasta),
    egresosModel.movimientosDeCuenta(columnasEgresos, ciudad, cuenta, desde, hasta),
  ])
  return { saldoAnterior: anterior, movimientos: intercalarPorFecha(ingresos, egresos) }
}

const COLUMNAS_INGRESO_CON_IMAGEN = 'id, fecha, concepto, valor, numero_recibo, comprobante_url, providente_otro, tipo, providente:providente_id(nombre)'
const COLUMNAS_EGRESO_CON_IMAGEN = {
  banco: 'id, fecha, concepto, valor, documento_url',
  otras: 'id, fecha, concepto, valor, documento_url, punto_servicio_otro, punto:punto_servicio_id(nombre)',
}

// Movimientos del mes que tienen imagen, con las imágenes descargadas una por una.
// Sin movimientos no descarga nada.
async function imagenesDeCuenta(ciudad, cuenta, desde, hasta) {
  const [{ data: ingresos }, { data: egresos }] = await Promise.all([
    ingresosModel.conSoporteEnRango(COLUMNAS_INGRESO_CON_IMAGEN, ciudad, cuenta, desde, hasta),
    egresosModel.conSoporteEnRango(cuenta === 'banco' ? COLUMNAS_EGRESO_CON_IMAGEN.banco : COLUMNAS_EGRESO_CON_IMAGEN.otras, ciudad, cuenta, desde, hasta),
  ])

  const movimientos = [
    ...(ingresos || []).map(r => ({ ...r, _tipo: 'Ingreso', documento_url: r.comprobante_url })),
    ...(egresos || []).map(r => ({ ...r, _tipo: 'Egreso' })),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha))

  if (cuenta === 'banco') {
    console.log(`Imágenes banco ${desde}/${hasta}: ingresos=${(ingresos || []).length} egresos=${(egresos || []).length} con_img=${movimientos.length}`)
  }

  const imagenes = []
  for (const mov of movimientos) imagenes.push(await imagenesModel.descargar(mov.documento_url))
  return { movimientos, imagenes }
}

module.exports = { aportesConsagrados, donaciones, movimientoDeCuenta, imagenesDeCuenta }
