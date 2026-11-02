// Consejo de cada ciudad: miembros, responsabilidades y coordinadores
const registrosModel = require('../models/registrosModel')

const COLUMNAS_CONSEJERO = 'id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, numero_identificacion, responsabilidades_consejo, fecha_inicio_consejo, estado_consagracion'

async function listarMiembros(ciudad) {
  const { data } = await registrosModel.listarConsejo(COLUMNAS_CONSEJERO, ciudad)
  return data || []
}

// Igual que listarMiembros, más el campo pertenece_consejo (vista de admin)
async function listarMiembrosParaAdmin(ciudad) {
  const { data } = await registrosModel.listarConsejo(`${COLUMNAS_CONSEJERO}, pertenece_consejo`, ciudad)
  return data || []
}

const actualizarResponsabilidades = (id, responsabilidades) =>
  registrosModel.actualizar(id, { responsabilidades_consejo: responsabilidades })

// Miembros de la ciudad que aún no son del consejo
async function buscarCandidatos(q, ciudad) {
  const { data } = await registrosModel.buscarPorTexto({
    columnas: 'id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, numero_identificacion, estado_consagracion, pertenece_consejo',
    q,
    ciudad,
    campos: ['primer_nombre', 'primer_apellido', 'segundo_apellido', 'numero_identificacion'],
    fueraDelConsejo: true,
    limite: 10,
  })
  return data || []
}

const agregarAlConsejo = (id) => registrosModel.actualizar(id, {
  pertenece_consejo: 'Si pertenezco',
  responsabilidades_consejo: [],
  fecha_inicio_consejo: new Date().toISOString().split('T')[0],
})

// Sale del consejo y pierde sus responsabilidades
const eliminarDelConsejo = (id) => registrosModel.actualizar(id, {
  pertenece_consejo: 'No pertenezco',
  responsabilidades_consejo: [],
  fecha_inicio_consejo: null,
})

async function quitarResponsabilidad(id, rol) {
  const { data: miembro } = await registrosModel.obtenerPorId(id, 'responsabilidades_consejo')
  const resps = (miembro?.responsabilidades_consejo || []).filter(r => r !== rol)
  return registrosModel.actualizar(id, { responsabilidades_consejo: resps })
}

// Solo puede haber un coordinador principal y uno suplente por ciudad:
// se le quita el rol a quien lo tenga y se le asigna al nuevo
async function asignarCoordinador(id, tipo, ciudad) {
  const rol = tipo === 'principal' ? 'Coordinador principal del consejo' : 'Coordinador suplente del consejo'

  const { data: actuales } = await registrosModel.listarConsejo('id, responsabilidades_consejo', ciudad, { ordenar: false })
  if (actuales) {
    for (const m of actuales) {
      const resps = m.responsabilidades_consejo || []
      if (resps.includes(rol) && m.id !== parseInt(id)) {
        await registrosModel.actualizar(m.id, { responsabilidades_consejo: resps.filter(r => r !== rol) })
      }
    }
  }

  const { data: nuevo } = await registrosModel.obtenerPorId(id, 'responsabilidades_consejo')
  const respsNuevo = (nuevo?.responsabilidades_consejo || []).filter(r => r !== rol)
  respsNuevo.push(rol)
  return registrosModel.actualizar(id, { responsabilidades_consejo: respsNuevo })
}

module.exports = {
  listarMiembros,
  listarMiembrosParaAdmin,
  actualizarResponsabilidades,
  buscarCandidatos,
  agregarAlConsejo,
  eliminarDelConsejo,
  quitarResponsabilidad,
  asignarCoordinador,
}
