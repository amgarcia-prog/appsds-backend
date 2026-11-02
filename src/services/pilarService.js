// Pilares: consulta de registros, ciudades a su cargo y gestión organizacional
const registrosModel = require('../models/registrosModel')
const pilarCiudadesModel = require('../models/pilarCiudadesModel')

// Resultado: 'no_encontrado' | 'no_es_pilar' (con estado) | 'ok' (con data y error de Supabase)
async function listarRegistros(miembroId) {
  const { data: m, error: errM } = await registrosModel.obtenerPorId(miembroId, 'estado_consagracion')
  if (errM || !m) return { resultado: 'no_encontrado' }
  if (m.estado_consagracion !== 'pilar') return { resultado: 'no_es_pilar', estado: m.estado_consagracion }
  const { data, error } = await registrosModel.listarTodos()
  return { resultado: 'ok', data, error }
}

async function listarCiudades(pilarId) {
  const { data } = await pilarCiudadesModel.listarPorPilar(pilarId)
  return data || []
}

const agregarCiudad = (pilarId, { pais, departamento, ciudad }) =>
  pilarCiudadesModel.insertar({ pilar_id: pilarId, pais, departamento, ciudad })

const eliminarCiudad = (ciudadId, pilarId) => pilarCiudadesModel.eliminar(ciudadId, pilarId)

async function listarPilares() {
  const { data } = await registrosModel.listarPilares(
    'id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, numero_identificacion, responsabilidades_pilar, ciudad_donde_sirve, pais_servicio')
  return data || []
}

const actualizarResponsabilidades = (id, responsabilidades) =>
  registrosModel.actualizar(id, { responsabilidades_pilar: responsabilidades })

module.exports = {
  listarRegistros,
  listarCiudades,
  agregarCiudad,
  eliminarCiudad,
  listarPilares,
  actualizarResponsabilidades,
}
