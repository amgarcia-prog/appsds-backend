// Reglas de permisos. Un rol puede venir del arreglo registros.roles o de las
// etiquetas en español de responsabilidades_consejo / responsabilidades_pilar.
const registrosModel = require('../models/registrosModel')

const incluye = (lista, valor) => (lista || []).includes(valor)

function cargarMiembro(id, columnas) {
  return registrosModel.obtenerPorId(id, columnas)
}

const esResponsableComunicaciones = (m) =>
  incluye(m.roles, 'responsable_comunicaciones') ||
  (m.estado_consagracion === 'pilar' && incluye(m.responsabilidades_pilar, 'Comunicaciones'))

const esResponsableComunicacionesCiudad = (m) =>
  incluye(m.roles, 'responsable_comunicaciones_ciudad') || incluye(m.responsabilidades_consejo, 'Comunicaciones')

const esResponsableFinanciero = (m) =>
  incluye(m.roles, 'responsable_financiero') || incluye(m.responsabilidades_consejo, 'Financiero')

const esPilarOrganizacional = (m) =>
  m.estado_consagracion === 'pilar' && incluye(m.responsabilidades_pilar, 'Organizacional')

// Etiqueta de responsabilidad del consejo → rol que entrega el login
const ROLES_POR_RESPONSABILIDAD_CONSEJO = [
  ['Formación y consagraciones', 'responsable_formacion'],
  ['Obras y servicios', 'responsable_obras'],
  ['Coordinador principal del consejo', 'coordinador_consejo'],
  ['Financiero', 'responsable_financiero'],
  ['Comunicaciones', 'responsable_comunicaciones_ciudad'],
]

// Roles guardados más los derivados de las responsabilidades, sin repetir
function rolesDeMiembro(m) {
  const roles = [...(m.roles || [])]
  const resps = m.responsabilidades_consejo || []
  for (const [responsabilidad, rol] of ROLES_POR_RESPONSABILIDAD_CONSEJO) {
    if (resps.includes(responsabilidad) && !roles.includes(rol)) roles.push(rol)
  }
  if (m.estado_consagracion === 'pilar' && incluye(m.responsabilidades_pilar, 'Comunicaciones') && !roles.includes('responsable_comunicaciones')) {
    roles.push('responsable_comunicaciones')
  }
  return roles
}

// Agrega el rol si no lo tiene; si ya lo tiene no escribe nada
async function asignarRol(id, rol) {
  const { data: reg } = await registrosModel.obtenerPorId(id, 'roles')
  const roles = reg?.roles || []
  if (roles.includes(rol)) return { error: null }
  return registrosModel.actualizar(id, { roles: [...roles, rol] })
}

async function quitarRol(id, rol) {
  const { data: reg } = await registrosModel.obtenerPorId(id, 'roles')
  const roles = (reg?.roles || []).filter(r => r !== rol)
  return registrosModel.actualizar(id, { roles })
}

// Asigna o quita el rol y siempre guarda la lista resultante
async function establecerRol(id, rol, asignar) {
  const { data: reg } = await registrosModel.obtenerPorId(id, 'roles')
  let roles = reg?.roles || []
  if (asignar) { if (!roles.includes(rol)) roles = [...roles, rol] }
  else { roles = roles.filter(r => r !== rol) }
  return registrosModel.actualizar(id, { roles })
}

module.exports = {
  cargarMiembro,
  asignarRol,
  quitarRol,
  establecerRol,
  esResponsableComunicaciones,
  esResponsableComunicacionesCiudad,
  esResponsableFinanciero,
  esPilarOrganizacional,
  rolesDeMiembro,
}
