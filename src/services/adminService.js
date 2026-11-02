// Administración general: registros, puntos de servicio y correo masivo
const registrosModel = require('../models/registrosModel')
const puntosServicioModel = require('../models/puntosServicioModel')
const correoModel = require('../models/correoModel')
const rolesService = require('./rolesService')
const { agregarHistorial } = require('./historialService')
const correos = require('../views/correos')
const env = require('../config/env')

const listarRegistros = () => registrosModel.listarTodos()

// Guarda los cambios tal como llegan; si cambia estado_proceso, queda en el historial
async function actualizarRegistro(id, cambios) {
  if (cambios.estado_proceso) {
    const { data: reg } = await registrosModel.obtenerPorId(id, 'estado_proceso')
    if (reg && reg.estado_proceso !== cambios.estado_proceso) {
      await agregarHistorial(id, reg.estado_proceso, cambios.estado_proceso, 'Administrador')
    }
  }
  return registrosModel.actualizar(id, cambios)
}

const eliminarRegistro = (id) => registrosModel.eliminar(id)

const establecerRolFinanciero = (id, asignar) => rolesService.establecerRol(id, 'responsable_financiero', asignar)

// Lista pública; sin ciudad devuelve los de todas las ciudades
const listarPuntosActivos = (ciudad) => puntosServicioModel.listarActivos('id, nombre, ciudad, pais', ciudad || undefined)

const listarPuntos = () => puntosServicioModel.listarTodos()
const crearPunto = (datos) => puntosServicioModel.insertar(datos)
const actualizarPunto = (id, datos) => puntosServicioModel.actualizar(id, datos)
const eliminarPunto = (id) => puntosServicioModel.eliminar(id)

// Puede enviar el admin (clave) o un pilar (su correo queda como respuesta).
// Resultado: 'no_autorizado' | 'no_es_pilar' | 'ok' (con replyTo)
async function autorizarCorreoMasivo(adminKey, miembroId) {
  if (!adminKey && !miembroId) return { resultado: 'no_autorizado' }
  let replyTo = null
  if (miembroId) {
    const { data: m } = await registrosModel.obtenerPorId(miembroId, 'estado_consagracion, correo_electronico')
    if (!m || m.estado_consagracion !== 'pilar') return { resultado: 'no_es_pilar' }
    if (m.correo_electronico) replyTo = m.correo_electronico
  } else if (adminKey !== env.ADMIN_KEY) {
    return { resultado: 'no_autorizado' }
  }
  return { resultado: 'ok', replyTo }
}

// Un correo por destinatario; los que lanzan error se cuentan aparte
async function enviarCorreoMasivo({ asunto, cuerpo, correos: destinatarios, replyTo }) {
  let enviados = 0, errores = 0
  for (const correo of destinatarios) {
    try {
      const emailData = {
        from: env.CORREO_INSTITUCIONAL || 'noreply@servidoresdelservidor.org',
        to: correo,
        subject: asunto,
        html: correos.masivo(cuerpo),
      }
      if (replyTo) emailData.reply_to = replyTo
      await correoModel.enviar(emailData)
      enviados++
    } catch { errores++ }
  }
  return { enviados, errores }
}

module.exports = {
  listarRegistros,
  actualizarRegistro,
  eliminarRegistro,
  establecerRolFinanciero,
  listarPuntosActivos,
  listarPuntos,
  crearPunto,
  actualizarPunto,
  eliminarPunto,
  autorizarCorreoMasivo,
  enviarCorreoMasivo,
}
