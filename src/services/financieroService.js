// Área financiera de una ciudad: benefactores, ingresos, egresos, saldos y consultas.
// Todas las operaciones reciben la ciudad del responsable (req.ciudadFinanciero).
const ingresosModel = require('../models/ingresosModel')
const egresosModel = require('../models/egresosModel')
const providentesModel = require('../models/providentesModel')
const reportesDonacionModel = require('../models/reportesDonacionModel')
const saldosInicialesModel = require('../models/saldosInicialesModel')
const puntosServicioModel = require('../models/puntosServicioModel')
const registrosModel = require('../models/registrosModel')
const rolesService = require('./rolesService')
const { rangoMes } = require('../utils/fechas')

const ROL = 'responsable_financiero'
const sumar = (filas) => (filas || []).reduce((s, r) => s + Number(r.valor), 0)

// '__otro__' es la opción "otro punto" del formulario: se guarda en punto_servicio_otro
const puntoServicio = (id) => (id === '__otro__' ? null : (id || null))

async function listarPuntosServicio(ciudad) {
  const { data } = await puntosServicioModel.listarActivos('id, nombre', ciudad)
  return data || []
}

// ── Providentes ──

async function listarProvidentes(ciudad, q) {
  const { data } = await providentesModel.listar(ciudad, q)
  return data || []
}

const crearProvidente = (ciudad, { numero_identificacion, nombre, telefono, direccion, correo }) =>
  providentesModel.insertar({ numero_identificacion, nombre, telefono, direccion, correo, ciudad })

const actualizarProvidente = (id, ciudad, { numero_identificacion, nombre, telefono, direccion, correo }) =>
  providentesModel.actualizar(id, ciudad, { numero_identificacion, nombre, telefono, direccion, correo })

const eliminarProvidente = (id, ciudad) => providentesModel.eliminar(id, ciudad)

// ── Ingresos y egresos ──

const rangoOpcional = (mes, anio) => (mes && anio ? rangoMes(mes, anio) : undefined)

async function listarIngresos(ciudad, mes, anio) {
  const { data } = await ingresosModel.listar(
    '*, providente:providente_id(nombre, correo), punto:punto_servicio_id(nombre), creador:registrado_por(primer_nombre, primer_apellido), editor:editado_por(primer_nombre, primer_apellido)',
    ciudad, rangoOpcional(mes, anio))
  return data || []
}

const datosIngreso = ({ fecha, providente_id, providente_otro, punto_servicio_id, punto_servicio_otro, tipo, concepto, mes_aporte, valor, comprobante_url, numero_recibo, forma_donacion, cuenta }) => ({
  fecha,
  providente_id: providente_id || null,
  providente_otro: providente_otro || null,
  punto_servicio_id: puntoServicio(punto_servicio_id),
  punto_servicio_otro: punto_servicio_otro || null,
  tipo,
  concepto,
  mes_aporte: mes_aporte || null,
  valor,
  comprobante_url: comprobante_url || null,
  numero_recibo: numero_recibo || null,
  forma_donacion: forma_donacion || 'dinero',
  cuenta: cuenta || 'banco',
})

const crearIngreso = (ciudad, registradoPor, datos) =>
  ingresosModel.insertar({ ...datosIngreso(datos), ciudad, registrado_por: registradoPor })

const actualizarIngreso = (id, ciudad, editor, datos) =>
  ingresosModel.actualizar(id, ciudad, { ...datosIngreso(datos), editado_por: editor })

const eliminarIngreso = (id, ciudad) => ingresosModel.eliminar(id, ciudad)
const marcarIngresoRevisado = (id, ciudad, revisado) => ingresosModel.actualizar(id, ciudad, { revisado })

async function listarEgresos(ciudad, mes, anio) {
  const { data } = await egresosModel.listar(
    '*, punto:punto_servicio_id(nombre), creador:registrado_por(primer_nombre, primer_apellido), editor:editado_por(primer_nombre, primer_apellido)',
    ciudad, rangoOpcional(mes, anio))
  return data || []
}

function datosEgreso({ fecha, punto_servicio_id, punto_servicio_otro, concepto, valor, documento_url, tipo, cuenta }) {
  const tipoFinal = tipo || 'egreso_servicio'
  return {
    fecha,
    punto_servicio_id: puntoServicio(punto_servicio_id),
    punto_servicio_otro: punto_servicio_otro || null,
    concepto,
    valor,
    documento_url: documento_url || null,
    tipo: tipoFinal,
    es_costo_financiero: tipoFinal === 'costo_financiero',
    cuenta: cuenta || 'banco',
  }
}

const crearEgreso = (ciudad, registradoPor, datos) =>
  egresosModel.insertar({ ...datosEgreso(datos), ciudad, registrado_por: registradoPor })

const actualizarEgreso = (id, ciudad, editor, datos) =>
  egresosModel.actualizar(id, ciudad, { ...datosEgreso(datos), editado_por: editor })

const eliminarEgreso = (id, ciudad) => egresosModel.eliminar(id, ciudad)
const marcarEgresoRevisado = (id, ciudad, revisado) => egresosModel.actualizar(id, ciudad, { revisado })

// ── Reportes de donación de la web pública ──

const crearReporteDonacion = ({ ciudad, nombre_donante, cedula, correo, telefono, direccion, valor, comprobante_url, concepto, comentario }) =>
  reportesDonacionModel.insertar({ ciudad, nombre_donante, cedula, correo, telefono, direccion: direccion || null, valor, comprobante_url, concepto, comentario: comentario || null })

async function listarReportesDonacion(ciudad) {
  const { data } = await reportesDonacionModel.listarPendientes(ciudad)
  return data || []
}

const marcarReporteAtendido = (id, ciudad) => reportesDonacionModel.marcarAtendido(id, ciudad)

// ── Saldos ──

// Saldo de una cuenta antes de una fecha: saldo inicial + ingresos − egresos anteriores
async function saldoAnterior(ciudad, cuenta, desde) {
  const [{ data: saldoData }, { data: ingHist }, { data: egrHist }] = await Promise.all([
    saldosInicialesModel.obtener(ciudad, cuenta),
    ingresosModel.valores(ciudad, cuenta, desde),
    egresosModel.valores(ciudad, cuenta, desde),
  ])
  return Number(saldoData?.saldo || 0) + sumar(ingHist) - sumar(egrHist)
}

// Ingresos y egresos intercalados por fecha, marcados con _tipo
const intercalarPorFecha = (ingresos, egresos) => [
  ...(ingresos || []).map(r => ({ ...r, _tipo: 'ingreso' })),
  ...(egresos || []).map(r => ({ ...r, _tipo: 'egreso' })),
].sort((a, b) => a.fecha.localeCompare(b.fecha))

async function obtenerSaldoInicial(ciudad, cuenta) {
  const { data } = await saldosInicialesModel.obtener(ciudad, cuenta)
  return data?.saldo || 0
}

const guardarSaldoInicial = (ciudad, cuenta, saldo) => saldosInicialesModel.guardar(ciudad, cuenta, saldo)

async function totalesCuenta(ciudad, cuenta, hasta) {
  const [{ data: ing }, { data: egr }] = await Promise.all([
    ingresosModel.valores(ciudad, cuenta, hasta),
    egresosModel.valores(ciudad, cuenta, hasta),
  ])
  return { totalIngresos: sumar(ing), totalEgresos: sumar(egr) }
}

// ── Consultas ──

const aportesDeBenefactor = (ciudad, providenteId, anio) => ingresosModel.aportesConsagrados(ciudad, providenteId, anio)

// Extracto del banco entre dos fechas con el saldo corrido
async function movimientoBanco(ciudad, desde, hasta) {
  const [anterior, { data: ingresos }, { data: egresos }] = await Promise.all([
    saldoAnterior(ciudad, 'banco', desde),
    ingresosModel.movimientosDeCuenta('*, providente:providente_id(nombre), punto:punto_servicio_id(nombre)', ciudad, 'banco', desde, hasta),
    egresosModel.movimientosDeCuenta('*, punto:punto_servicio_id(nombre)', ciudad, 'banco', desde, hasta),
  ])

  let saldo = anterior
  const movimientos = intercalarPorFecha(ingresos, egresos).map(r => {
    const esIngreso = r._tipo === 'ingreso'
    saldo += esIngreso ? Number(r.valor) : -Number(r.valor)
    return {
      id: r.id,
      fecha: r.fecha,
      comprobante: r.numero_recibo || '',
      benefactor: esIngreso ? (r.providente?.nombre || r.providente_otro || '') : '',
      servicio: r.punto?.nombre || r.punto_servicio_otro || '',
      concepto: r.concepto || '',
      ingreso: esIngreso ? Number(r.valor) : null,
      egreso: esIngreso ? null : Number(r.valor),
      saldo,
    }
  })

  return { saldoAnterior: anterior, movimientos }
}

async function buscarPorConcepto(ciudad, desde, hasta, q) {
  const [{ data: ingresos }, { data: egresos }] = await Promise.all([
    ingresosModel.buscarPorConcepto('id, fecha, concepto, valor, cuenta, providente:providente_id(nombre), providente_otro', ciudad, desde, hasta, q),
    egresosModel.buscarPorConcepto('id, fecha, concepto, valor, cuenta', ciudad, desde, hasta, q),
  ])
  return [
    ...(ingresos || []).map(r => ({ ...r, _tipo: 'ingreso', benefactor: r.providente?.nombre || r.providente_otro || '' })),
    ...(egresos || []).map(r => ({ ...r, _tipo: 'egreso', benefactor: '' })),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha))
}

const donacionesEnEspecie = (ciudad, desde, hasta) => ingresosModel.movimientosDeCuenta(
  'id, fecha, concepto, valor, providente:providente_id(nombre), providente_otro, punto:punto_servicio_id(nombre), punto_servicio_otro',
  ciudad, 'especie', desde, hasta)

// ── Equipo financiero ──

async function listarEquipo(ciudad) {
  const { data } = await registrosModel.listarPorCiudad('id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, numero_identificacion, roles', ciudad)
  return (data || []).filter(r => (r.roles || []).includes(ROL))
}

async function buscarServidor(ciudad, q) {
  const { data } = await registrosModel.buscarPorTexto({
    columnas: 'id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, numero_identificacion, roles',
    q,
    ciudad,
    campos: ['primer_apellido', 'primer_nombre', 'numero_identificacion'],
    limite: 8,
  })
  return data || []
}

const asignarRol = (id) => rolesService.asignarRol(id, ROL)
const quitarRol = (id) => rolesService.quitarRol(id, ROL)

module.exports = {
  listarPuntosServicio,
  listarProvidentes, crearProvidente, actualizarProvidente, eliminarProvidente,
  listarIngresos, crearIngreso, actualizarIngreso, eliminarIngreso, marcarIngresoRevisado,
  listarEgresos, crearEgreso, actualizarEgreso, eliminarEgreso, marcarEgresoRevisado,
  crearReporteDonacion, listarReportesDonacion, marcarReporteAtendido,
  saldoAnterior, intercalarPorFecha, obtenerSaldoInicial, guardarSaldoInicial, totalesCuenta,
  aportesDeBenefactor, movimientoBanco, buscarPorConcepto, donacionesEnEspecie,
  listarEquipo, buscarServidor, asignarRol, quitarRol,
}
