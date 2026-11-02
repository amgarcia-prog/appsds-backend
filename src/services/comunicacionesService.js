const publicacionesModel = require('../models/publicacionesModel')
const lectioServicioModel = require('../models/lectioServicioModel')
const registrosModel = require('../models/registrosModel')
const rolesService = require('./rolesService')

const ROL = 'responsable_comunicaciones'
const COLUMNAS_SERVIDOR = 'id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, numero_identificacion, roles'

const datosPublicacion = ({ titulo, extracto, imagen_url, enlace }) =>
  ({ titulo, extracto, imagen_url: imagen_url || null, enlace: enlace || null })

const listarPublicaciones = () => publicacionesModel.listarRecientes()
const crearPublicacion = (datos) => publicacionesModel.insertar(datosPublicacion(datos))
const actualizarPublicacion = (id, datos) => publicacionesModel.actualizar(id, datosPublicacion(datos))
const eliminarPublicacion = (id) => publicacionesModel.eliminar(id)

const listarLectio = () => lectioServicioModel.listar()
const crearLectio = ({ titulo, archivo_url }) => lectioServicioModel.insertar({ titulo, archivo_url })
const actualizarLectio = (id, { titulo, archivo_url }) => lectioServicioModel.actualizar(id, { titulo, archivo_url })
const eliminarLectio = (id) => lectioServicioModel.eliminar(id)

// Servidores que tienen el rol de comunicaciones
async function listarEquipo() {
  const { data } = await registrosModel.listar(COLUMNAS_SERVIDOR)
  return (data || []).filter(r => (r.roles || []).includes(ROL))
}

async function buscarServidor(q) {
  const { data } = await registrosModel.buscarPorTexto({
    columnas: COLUMNAS_SERVIDOR,
    q,
    campos: ['primer_apellido', 'primer_nombre', 'numero_identificacion'],
    limite: 8,
  })
  return data || []
}

const asignarRol = (id) => rolesService.asignarRol(id, ROL)
const quitarRol = (id) => rolesService.quitarRol(id, ROL)

module.exports = {
  listarPublicaciones,
  crearPublicacion,
  actualizarPublicacion,
  eliminarPublicacion,
  listarLectio,
  crearLectio,
  actualizarLectio,
  eliminarLectio,
  listarEquipo,
  buscarServidor,
  asignarRol,
  quitarRol,
}
