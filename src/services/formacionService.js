// Proceso de consagración (registros.estado_proceso). Cada etapa lo mueve un actor distinto:
//   miembro:   solicitud desde el perfil → pendiente_formacion
//   formación: cumple_requisitos / no_cumple_requisitos / formacion_aprobada / formacion_no_aprobada
//   consejo:   pendiente_aprobacion (avala) / no_avalado_consejo
//   junta:     aprobado_consagracion / no_aprobado_junta
//   ceremonia: consagrado_paciente / consagrado_servita
// Los endpoints no validan el estado de origen. Todo cambio queda en historial_proceso.
const registrosModel = require('../models/registrosModel')
const { agregarHistorial, nombreResponsable } = require('./historialService')

const ESTADOS_FORMACION = ['cumple_requisitos', 'no_cumple_requisitos', 'formacion_aprobada', 'formacion_no_aprobada']
const DECISIONES_JUNTA = ['aprobado_consagracion', 'no_aprobado_junta']

const COLUMNAS_ASPIRANTE = 'id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, numero_identificacion, fecha_nacimiento, fecha_inicio_servicio'
const COLUMNAS_SOLICITUD = `${COLUMNAS_ASPIRANTE}, fecha_consagracion_paciente, fecha_consagracion_servita, motivacion_paciente, motivacion_servita, ciudad_donde_sirve, estado_proceso, estado_consagracion`
const RECIENTES_PRIMERO = ['created_at', false]

const listarPendientes = (ciudad) => registrosModel.listarPorEstado({
  columnas: `${COLUMNAS_SOLICITUD}, foto_url, created_at`,
  estados: 'pendiente_formacion', ciudad, orden: RECIENTES_PRIMERO,
})

// Listos para formación (o para repetirla)
const listarCumpleRequisitos = (ciudad) => registrosModel.listarPorEstado({
  columnas: `${COLUMNAS_SOLICITUD}, concepto_formacion, historial_formacion, foto_url, created_at`,
  estados: ['cumple_requisitos', 'formacion_no_aprobada'], ciudad, orden: RECIENTES_PRIMERO,
})

// Listos para el concepto del consejo
const listarAprobadosFormacion = (ciudad) => registrosModel.listarPorEstado({
  columnas: `${COLUMNAS_SOLICITUD}, concepto_formacion, historial_formacion, concepto_consejo, fecha_reunion_consejo, foto_url, created_at`,
  estados: 'formacion_aprobada', ciudad, orden: RECIENTES_PRIMERO,
})

// Con decisión de la junta
const listarAprobadosConsagracion = (ciudad) => registrosModel.listarPorEstado({
  columnas: `${COLUMNAS_ASPIRANTE}, ciudad_donde_sirve, estado_proceso, estado_consagracion, created_at`,
  estados: DECISIONES_JUNTA, ciudad, orden: ['primer_apellido', true],
})

// Ceremonia: quien ya es paciente pasa a servita; los demás, a paciente.
// Devuelve cuántos registros fallaron.
async function consagrar(ids, fechaConsagracion, actaUrl, responsableId) {
  const responsable = await nombreResponsable(responsableId)
  let fallidos = 0
  for (const id of ids) {
    const { data: reg } = await registrosModel.obtenerPorId(id, 'estado_proceso, estado_consagracion')
    const esPaciente = reg?.estado_consagracion === 'paciente'
    const nuevoEstado = esPaciente ? 'consagrado_servita' : 'consagrado_paciente'
    const cambios = {
      estado_proceso: nuevoEstado,
      estado_consagracion: esPaciente ? 'servita' : 'paciente',
      [esPaciente ? 'fecha_consagracion_servita' : 'fecha_consagracion_paciente']: fechaConsagracion,
      fecha_estado: new Date().toISOString(),
    }
    if (actaUrl) cambios.acta_consagracion_url = actaUrl
    const { error } = await registrosModel.actualizar(id, cambios)
    if (error) { fallidos++; continue }
    await agregarHistorial(id, reg?.estado_proceso, nuevoEstado, responsable, `Ceremonia de consagración: ${fechaConsagracion}`)
  }
  return fallidos
}

async function registrarConceptoConsejo(id, responsableId, { concepto_consejo, fecha_reunion_consejo, avala }) {
  const decision = avala ? 'pendiente_aprobacion' : 'no_avalado_consejo'
  const { data: reg } = await registrosModel.obtenerPorId(id, 'estado_proceso, primer_nombre, primer_apellido')
  const responsable = await nombreResponsable(responsableId)
  const { error } = await registrosModel.actualizar(id, {
    concepto_consejo,
    fecha_reunion_consejo,
    estado_proceso: decision,
    fecha_estado: new Date().toISOString(),
  })
  if (error) return { error }
  await agregarHistorial(id, reg?.estado_proceso, decision, responsable, concepto_consejo)
  return { error: null }
}

// Si llega concepto de formación, también se agrega a historial_formacion
async function cambiarEstadoFormacion(id, responsableId, estado, conceptoFormacion) {
  const { data: reg } = await registrosModel.obtenerPorId(id, 'estado_proceso, historial_formacion, primer_nombre, primer_apellido')
  const responsable = await nombreResponsable(responsableId)

  const cambios = { estado_proceso: estado, fecha_estado: new Date().toISOString() }
  if (conceptoFormacion !== undefined) {
    cambios.concepto_formacion = conceptoFormacion
    const historialFormacion = reg?.historial_formacion || []
    historialFormacion.push({
      fecha: new Date().toISOString(),
      concepto: conceptoFormacion,
      resultado: estado === 'formacion_aprobada' ? 'Aprobada' : 'No aprobada',
      responsable,
    })
    cambios.historial_formacion = historialFormacion
  }

  const { error } = await registrosModel.actualizar(id, cambios)
  if (error) return { error }
  await agregarHistorial(id, reg?.estado_proceso, estado, responsable, conceptoFormacion || '')
  return { error: null }
}

// Pendientes de la junta en todas las ciudades, incluidos los no avalados por el consejo
const listarPendientesJunta = () => registrosModel.listarPorEstado({
  columnas: '*', estados: ['pendiente_aprobacion', 'no_avalado_consejo'], orden: ['ciudad_donde_sirve', true],
})

async function registrarDecisionJunta(id, { decision, notas, fecha_junta }) {
  const { data: reg } = await registrosModel.obtenerPorId(id, 'estado_proceso')
  const { error } = await registrosModel.actualizar(id, {
    estado_proceso: decision, fecha_estado: new Date().toISOString(), fecha_reunion_junta: fecha_junta,
  })
  if (error) return { error }
  await agregarHistorial(id, reg?.estado_proceso, decision, 'Junta directiva', notas || '')
  return { error: null }
}

module.exports = {
  ESTADOS_FORMACION,
  DECISIONES_JUNTA,
  listarPendientes,
  listarCumpleRequisitos,
  listarAprobadosFormacion,
  listarAprobadosConsagracion,
  consagrar,
  registrarConceptoConsejo,
  cambiarEstadoFormacion,
  listarPendientesJunta,
  registrarDecisionJunta,
}
