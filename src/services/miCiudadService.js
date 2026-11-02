// Contenido público de cada ciudad (historia y servicios), editado por comunicaciones del consejo
const ciudadContenidoModel = require('../models/ciudadContenidoModel')
const ciudadServiciosModel = require('../models/ciudadServiciosModel')

const fotos = (lista) => (Array.isArray(lista) ? lista : [])

async function obtenerContenido(ciudad) {
  const { data } = await ciudadContenidoModel.obtenerPorCiudad(ciudad)
  return data || { ciudad, subtitulo: '', historia: '', historia_fotos: [] }
}

function guardarContenido(ciudad, actualizadoPor, { subtitulo, historia, historia_fotos }) {
  return ciudadContenidoModel.guardar({
    ciudad,
    subtitulo: subtitulo || null,
    historia: historia || null,
    historia_fotos: fotos(historia_fotos),
    actualizado_por: actualizadoPor,
    updated_at: new Date().toISOString(),
  })
}

async function listarServicios(ciudad) {
  const { data } = await ciudadServiciosModel.listarPorCiudad(ciudad)
  return data || []
}

const datosServicio = ({ punto_servicio_id, nombre, horario, descripcion, direccion, telefono, fotos: lista }) => ({
  punto_servicio_id: punto_servicio_id || null,
  nombre, horario: horario || null, descripcion: descripcion || null,
  direccion: direccion || null, telefono: telefono || null,
  fotos: fotos(lista),
})

const crearServicio = (ciudad, datos) => ciudadServiciosModel.insertar({ ciudad, ...datosServicio(datos) })
const actualizarServicio = (id, ciudad, datos) => ciudadServiciosModel.actualizar(id, ciudad, datosServicio(datos))
const eliminarServicio = (id, ciudad) => ciudadServiciosModel.eliminar(id, ciudad)

// Lectura pública para la página web
async function obtenerCiudadPublica(nombre) {
  const [{ data: contenido }, { data: servicios }] = await Promise.all([
    ciudadContenidoModel.obtenerPorCiudad(nombre, 'subtitulo, historia, historia_fotos'),
    ciudadServiciosModel.listarPorCiudad(nombre),
  ])
  return { contenido: contenido || null, servicios: servicios || [] }
}

module.exports = {
  obtenerContenido,
  guardarContenido,
  listarServicios,
  crearServicio,
  actualizarServicio,
  eliminarServicio,
  obtenerCiudadPublica,
}
