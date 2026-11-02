// Panel de obras y servicios: puntos de servicio de la ciudad y sus miembros y coordinadores.
// Los puntos se asignan por nombre en registros.puntos_servicio y registros.puntos_coordina.
const registrosModel = require('../models/registrosModel')
const puntosServicioModel = require('../models/puntosServicioModel')

// Resultado: 'miembro_no_encontrado' o 'ok' (con el error de Supabase si lo hubo)
async function crearPuntoServicio(miembroId, nombre) {
  const { data: miembro } = await registrosModel.obtenerPorId(miembroId, 'ciudad_donde_sirve, pais_servicio, departamento_ciudad_servicio')
  if (!miembro) return { resultado: 'miembro_no_encontrado' }
  const { error } = await puntosServicioModel.insertar({
    nombre: nombre.trim(),
    ciudad: miembro.ciudad_donde_sirve,
    pais: miembro.pais_servicio || 'Colombia',
    departamento: miembro.departamento_ciudad_servicio || null,
    activo: true,
  })
  return { resultado: 'ok', error }
}

const eliminarPuntoServicio = (id) => puntosServicioModel.eliminar(id)

// Puntos activos de la ciudad con cuántos miembros sirven en cada uno
async function listarPuntosConConteo(ciudad) {
  const { data: puntos } = await puntosServicioModel.listarActivos('id, nombre', ciudad)
  if (!puntos) return []
  const { data: miembros } = await registrosModel.listarPorCiudad('puntos_servicio', ciudad)
  const conteos = {}
  for (const m of miembros || []) {
    for (const p of m.puntos_servicio || []) {
      conteos[p] = (conteos[p] || 0) + 1
    }
  }
  return puntos.map(p => ({ ...p, total_miembros: conteos[p.nombre] || 0 }))
}

async function listarMiembrosDePunto(punto, ciudad) {
  const { data } = await registrosModel.listarPorCiudad(
    'id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, numero_identificacion, estado_consagracion, es_coordinador, puntos_coordina, puntos_servicio', ciudad)
  return (data || [])
    .filter(m => (m.puntos_servicio || []).includes(punto))
    .sort((a, b) => (a.primer_apellido || '').localeCompare(b.primer_apellido || ''))
}

async function buscarMiembro(q, ciudad) {
  const { data } = await registrosModel.buscarPorTexto({
    columnas: 'id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, numero_identificacion, estado_consagracion, puntos_servicio',
    q,
    ciudad,
    campos: ['primer_apellido', 'segundo_apellido', 'primer_nombre', 'numero_identificacion'],
    limite: 10,
  })
  return data || []
}

async function adicionarCoordinador(id, punto) {
  const { data: reg } = await registrosModel.obtenerPorId(id, 'puntos_coordina')
  const actual = reg?.puntos_coordina || []
  if (actual.includes(punto)) return { error: null }
  return registrosModel.actualizar(id, { puntos_coordina: [...actual, punto], es_coordinador: 'Sí' })
}

async function quitarCoordinador(id, punto) {
  const { data: reg } = await registrosModel.obtenerPorId(id, 'puntos_coordina')
  const nuevos = (reg?.puntos_coordina || []).filter(p => p !== punto)
  return registrosModel.actualizar(id, { puntos_coordina: nuevos, es_coordinador: nuevos.length > 0 ? 'Sí' : 'No' })
}

async function agregarPunto(id, punto) {
  const { data: reg } = await registrosModel.obtenerPorId(id, 'puntos_servicio')
  const actual = reg?.puntos_servicio || []
  if (actual.includes(punto)) return { error: null }
  return registrosModel.actualizar(id, { puntos_servicio: [...actual, punto] })
}

async function quitarPunto(id, punto) {
  const { data: reg } = await registrosModel.obtenerPorId(id, 'puntos_servicio')
  const actual = reg?.puntos_servicio || []
  return registrosModel.actualizar(id, { puntos_servicio: actual.filter(p => p !== punto) })
}

module.exports = {
  crearPuntoServicio,
  eliminarPuntoServicio,
  listarPuntosConConteo,
  listarMiembrosDePunto,
  buscarMiembro,
  adicionarCoordinador,
  quitarCoordinador,
  agregarPunto,
  quitarPunto,
}
