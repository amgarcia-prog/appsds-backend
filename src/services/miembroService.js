// Datos propios del miembro y su solicitud de consagración
const registrosModel = require('../models/registrosModel')
const { agregarHistorial } = require('./historialService')

// Campos que el miembro puede editar de su perfil (secciones 1-4, sin cédula)
const CAMPOS_PERFIL = [
  'primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido',
  'fecha_nacimiento', 'fecha_fallecimiento', 'tipo_identificacion', 'sexo', 'estado_civil', 'tipo_sangre',
  'foto_url',
  'correo_electronico', 'telefono_movil', 'telefono_fijo', 'otro_telefono',
  'pais_residencia', 'departamento_servicio', 'ciudad_servicio', 'direccion_residencia',
  'nivel_academico', 'profesion', 'ocupacion',
  'tipo_sangre', 'eps_servicio', 'indicaciones_medicas',
]

// Perfil completo sin la clave; null si no existe
async function obtenerPerfil(id) {
  const { data, error } = await registrosModel.obtenerPorId(id, '*')
  if (error || !data) return null
  const { clave, ...resto } = data
  return resto
}

// Solo los campos permitidos que vengan en el cuerpo
function cambiosDePerfil(cuerpo) {
  const cambios = {}
  for (const campo of CAMPOS_PERFIL) {
    if (cuerpo[campo] !== undefined) cambios[campo] = cuerpo[campo]
  }
  return cambios
}

const actualizarPerfil = (id, cambios) => registrosModel.actualizar(id, cambios)

// Resultado: 'no_encontrado' | 'clave_incorrecta' | 'ok' (con el error de Supabase si lo hubo)
async function cambiarClave(id, claveActual, claveNueva) {
  const { data: reg } = await registrosModel.obtenerPorId(id, 'clave')
  if (!reg) return { resultado: 'no_encontrado' }
  if (reg.clave !== claveActual) return { resultado: 'clave_incorrecta' }
  const { error } = await registrosModel.actualizar(id, { clave: claveNueva })
  return { resultado: 'ok', error }
}

// Vuelve a pendiente_formacion; la motivación va al campo del siguiente nivel.
// Resultado: 'no_encontrado' | 'ok' (con el error de Supabase si lo hubo)
async function solicitarConsagracion(id, motivacion, otraComunidad) {
  const { data: reg } = await registrosModel.obtenerPorId(id, 'estado_proceso, estado_consagracion, primer_nombre, primer_apellido')
  if (!reg) return { resultado: 'no_encontrado' }
  const campoMotivacion = reg.estado_consagracion === 'paciente' ? 'motivacion_servita' : 'motivacion_paciente'
  const cambios = {
    estado_proceso: 'pendiente_formacion',
    [campoMotivacion]: motivacion.trim(),
    fecha_estado: new Date().toISOString(),
  }
  if (otraComunidad) cambios.otra_comunidad = otraComunidad
  const { error } = await registrosModel.actualizar(id, cambios)
  if (error) return { resultado: 'ok', error }
  await agregarHistorial(id, reg.estado_proceso, 'pendiente_formacion', `${reg.primer_nombre} ${reg.primer_apellido}`, 'Solicitud de consagración enviada desde el perfil')
  return { resultado: 'ok', error: null }
}

// Mes y día como número comparable (MMDD) de una fecha AAAA-MM-DD
function mesDia(fecha) {
  const [, m, d] = fecha.split('-').map(Number)
  return m * 100 + d
}

// Cumpleaños entre dos fechas (solo cuentan mes y día; el rango puede cruzar el fin de año)
async function listarCumpleanos(desde, hasta, ciudad) {
  const [desdeM, desdeD] = desde.split('-').slice(1).map(Number)
  const [hastaM, hastaD] = hasta.split('-').slice(1).map(Number)
  const { data } = await registrosModel.listarConFechaNacimiento(
    'id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, fecha_nacimiento, estado_consagracion, foto_url', ciudad)
  const ini = desdeM * 100 + desdeD
  const fin = hastaM * 100 + hastaD
  const filtrados = (data || []).filter(r => {
    if (!r.fecha_nacimiento) return false
    const cumple = mesDia(r.fecha_nacimiento)
    return ini <= fin ? cumple >= ini && cumple <= fin : cumple >= ini || cumple <= fin
  })
  return filtrados.sort((a, b) => mesDia(a.fecha_nacimiento) - mesDia(b.fecha_nacimiento))
}

module.exports = {
  obtenerPerfil,
  cambiosDePerfil,
  actualizarPerfil,
  cambiarClave,
  solicitarConsagracion,
  listarCumpleanos,
}
