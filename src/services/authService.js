// Registro de miembros, inicio de sesión y recuperación de clave.
// Las claves se guardan y comparan en texto plano, como en el sistema original.
const crypto = require('crypto')
const registrosModel = require('../models/registrosModel')
const pilarCiudadesModel = require('../models/pilarCiudadesModel')
const documentosModel = require('../models/documentosModel')
const correoModel = require('../models/correoModel')
const rolesService = require('./rolesService')
const correos = require('../views/correos')
const env = require('../config/env')

async function existeCedula(numero) {
  const { data } = await registrosModel.obtenerPorIdentificacion(numero, 'id')
  return !!data
}

// Estado inicial del proceso según la condición declarada en el registro
function estadoProcesoInicial(estadoConsagracion) {
  if (estadoConsagracion === 'paciente') return 'consagrado_paciente'
  if (estadoConsagracion === 'servita') return 'consagrado_servita'
  if (estadoConsagracion === 'pilar') return 'consagrado_pilar'
  if (estadoConsagracion === 'laborioso_no_consagrar') return 'laborioso_no_consagrar'
  return 'pendiente_formacion'
}

// Formulario de registro (camelCase) → fila de registros
const filaDeRegistro = (datos, ip) => ({
  acepta_datos: datos.aceptaDatos,
  timestamp_acepta_datos: datos.timestampAceptaDatos || null,
  version_politica: datos.versionPolitica || null,
  hash_politica: datos.hashPolitica || null,
  fecha_nacimiento: datos.fechaNacimiento || null,
  tipo_identificacion: datos.tipoIdentificacion,
  numero_identificacion: datos.numeroIdentificacion,
  sexo: datos.sexo,
  primer_nombre: datos.primerNombre,
  segundo_nombre: datos.segundoNombre,
  primer_apellido: datos.primerApellido,
  segundo_apellido: datos.segundoApellido,
  estado_civil: datos.estadoCivil,
  telefono_movil: datos.telefonoMovil,
  telefono_fijo: datos.telefonoFijo,
  otro_telefono: datos.otroTelefono,
  correo_electronico: datos.correoElectronico,
  pais_residencia: datos.paisResidencia,
  departamento_servicio: datos.departamentoServicio,
  ciudad_servicio: datos.ciudadServicio,
  direccion_residencia: datos.direccionResidencia,
  nivel_academico: datos.nivelAcademico,
  profesion: datos.profesion,
  ocupacion: datos.ocupacion,
  tipo_sangre: datos.tipoSangre,
  eps_servicio: datos.epsServicio,
  indicaciones_medicas: datos.indicacionesMedicas,
  como_llego_comunidad: datos.comoLlegoComunitad,
  pais_servicio: datos.paisServicio,
  departamento_ciudad_servicio: datos.departamentoDondeSirve,
  ciudad_donde_sirve: datos.ciudadDondeSirve,
  puntos_servicio: datos.puntosServicio,
  es_coordinador: datos.esCoordinador,
  puntos_coordina: datos.puntosCoordina,
  pertenece_consejo: datos.perteneceConsejo,
  fecha_inicio_consejo: datos.fechaInicioConsejo || null,
  responsabilidades_consejo: datos.responsabilidadesConsejo,
  estado_consagracion: datos.estadoConsagracion,
  fecha_inicio_servicio: datos.fechaInicioServicio || null,
  motivacion_paciente: datos.porQueConsagrarse,
  fecha_consagracion_paciente: datos.fechaConsagracion || null,
  fecha_inicio_encargo: datos.fechaInicioEncargo || null,
  pertenece_otra_comunidad: datos.perteneceOtraComunidad,
  responsabilidades_pilar: datos.responsabilidadesPilar,
  acepta_contrato: datos.aceptaContrato,
  timestamp_contrato: datos.timestampContrato || new Date().toISOString(),
  version_contrato: datos.versionContrato || 'v1.0-2026',
  hash_contrato: datos.hashContrato || null,
  ip_registro: ip,
  foto_url: datos.fotoUrl || null,
  clave: datos.clave || null,
  estado_proceso: estadoProcesoInicial(datos.estadoConsagracion),
  fecha_estado: new Date().toISOString(),
})

// Guarda el registro y, si es pilar, sus ciudades a cargo.
// Resultado: 'duplicado' | 'error_guardado' (con el error) | 'ok' (con el nombre completo)
async function registrar(datos, ip) {
  const nombreCompleto = [datos.primerNombre, datos.segundoNombre, datos.primerApellido, datos.segundoApellido]
    .filter(Boolean).join(' ')

  const { data: existente } = await registrosModel.obtenerPorIdentificacion(datos.numeroIdentificacion, 'id')
  if (existente) return { resultado: 'duplicado' }

  const { error } = await registrosModel.insertar(filaDeRegistro(datos, ip))
  if (error) return { resultado: 'error_guardado', error }

  if (datos.estadoConsagracion === 'pilar' && Array.isArray(datos.ciudadesResponsable) && datos.ciudadesResponsable.length > 0) {
    const { data: nuevoRegistro } = await registrosModel.obtenerPorIdentificacion(datos.numeroIdentificacion, 'id')
    if (nuevoRegistro) {
      await pilarCiudadesModel.insertar(datos.ciudadesResponsable.map(c => ({
        pilar_id: nuevoRegistro.id, pais: c.pais, departamento: c.departamento || null, ciudad: c.ciudad,
      })))
    }
  }

  return { resultado: 'ok', nombreCompleto }
}

// Lanza si Resend no responde
function enviarBienvenida(correo, nombreCompleto) {
  return correoModel.enviar({
    from: env.REMITENTE,
    to: [correo],
    bcc: [env.CORREO_INSTITUCIONAL],
    subject: '¡Bienvenido(a) a Servidores del Servidor! - Documentos de ingreso',
    html: correos.bienvenida(nombreCompleto),
    attachments: documentosModel.adjuntosDeIngreso(),
  })
}

// Resultado: 'no_encontrado' | 'sin_clave' | 'clave_incorrecta' | 'ok' (con el miembro y sus roles)
async function iniciarSesion(numeroIdentificacion, clave) {
  const { data, error } = await registrosModel.obtenerPorIdentificacion(numeroIdentificacion,
    'id, primer_nombre, primer_apellido, numero_identificacion, clave, responsabilidades_consejo, responsabilidades_pilar, ciudad_donde_sirve, estado_consagracion, roles')
  if (error || !data) return { resultado: 'no_encontrado' }
  if (!data.clave) return { resultado: 'sin_clave' }
  if (data.clave !== clave) return { resultado: 'clave_incorrecta' }
  return {
    resultado: 'ok',
    miembro: {
      id: data.id,
      nombre: `${data.primer_nombre} ${data.primer_apellido}`,
      numeroIdentificacion: data.numero_identificacion,
      ciudad: data.ciudad_donde_sirve,
      estado_consagracion: data.estado_consagracion,
      responsabilidades_consejo: data.responsabilidades_consejo,
      responsabilidades_pilar: data.responsabilidades_pilar,
      roles: rolesService.rolesDeMiembro(data),
    },
  }
}

const VIGENCIA_ENLACE_MS = 60 * 60 * 1000

// Genera un token de una hora y envía el enlace por correo.
// Resultado: 'no_encontrado' | 'sin_correo' | 'error_token' | 'error_correo' | 'ok' (con el correo)
async function solicitarRecuperacion(numeroIdentificacion) {
  const { data } = await registrosModel.obtenerPorIdentificacion(numeroIdentificacion, 'id, primer_nombre, primer_apellido, correo_electronico')
  if (!data) return { resultado: 'no_encontrado' }
  if (!data.correo_electronico) return { resultado: 'sin_correo' }

  const token = crypto.randomBytes(32).toString('hex')
  const expira = new Date(Date.now() + VIGENCIA_ENLACE_MS).toISOString()
  const { error } = await registrosModel.actualizar(data.id, { reset_token: token, reset_token_expira: expira })
  if (error) return { resultado: 'error_token' }

  const enlace = `${env.FRONTEND_URL}/restablecer-clave?token=${token}`
  try {
    await correoModel.enviar({
      from: env.REMITENTE,
      to: [data.correo_electronico],
      subject: 'Recupera tu clave de acceso',
      html: correos.recuperacionClave(`${data.primer_nombre} ${data.primer_apellido}`, enlace),
    })
  } catch (err) {
    console.error('❌ Error enviando correo de recuperación:', err)
    return { resultado: 'error_correo' }
  }
  return { resultado: 'ok', correo: data.correo_electronico }
}

// Resultado: 'token_invalido' | 'token_vencido' | 'error_guardado' | 'ok'
async function restablecerClave(token, claveNueva) {
  const { data } = await registrosModel.obtenerPorTokenDeRecuperacion(token, 'id, reset_token_expira')
  if (!data) return { resultado: 'token_invalido' }
  if (new Date(data.reset_token_expira) < new Date()) return { resultado: 'token_vencido' }
  const { error } = await registrosModel.actualizar(data.id, { clave: claveNueva, reset_token: null, reset_token_expira: null })
  if (error) return { resultado: 'error_guardado' }
  return { resultado: 'ok' }
}

module.exports = {
  existeCedula,
  registrar,
  enviarBienvenida,
  iniciarSesion,
  solicitarRecuperacion,
  restablecerClave,
}
