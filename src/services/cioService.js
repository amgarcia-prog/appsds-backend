const cioModel = require('../models/cioModel')

// Horas entre dos horas "HH:MM", redondeadas a dos decimales
function calcularHoras(horaInicio, horaFin) {
  const [h1, m1] = horaInicio.split(':').map(Number)
  const [h2, m2] = horaFin.split(':').map(Number)
  return Math.round(((h2 * 60 + m2) - (h1 * 60 + m1)) / 60 * 100) / 100
}

const listarClientes = () => cioModel.clientes.listar()
const crearCliente = ({ nit, nombre }) => cioModel.clientes.crear({ nit, nombre })
const actualizarCliente = (id, { nit, nombre }) => cioModel.clientes.actualizar(id, { nit, nombre })
const eliminarCliente = (id) => cioModel.clientes.eliminar(id)

const listarProyectos = (clienteId) => cioModel.proyectos.listarPorCliente(clienteId)
const crearProyecto = ({ cliente_id, concepto, fecha_inicio }) =>
  cioModel.proyectos.crear({ cliente_id, concepto, fecha_inicio: fecha_inicio || null })
const actualizarProyecto = (id, { concepto, fecha_inicio }) =>
  cioModel.proyectos.actualizar(id, { concepto, fecha_inicio: fecha_inicio || null })
const eliminarProyecto = (id) => cioModel.proyectos.eliminar(id)

const crearProducto = ({ proyecto_id, concepto, valor, horas_estimadas }) =>
  cioModel.productos.crear({ proyecto_id, concepto, valor: valor || 0, horas_estimadas: horas_estimadas || null })
const actualizarProducto = (id, { concepto, valor, horas_estimadas }) =>
  cioModel.productos.actualizar(id, { concepto, valor: valor || 0, horas_estimadas: horas_estimadas || null })
const eliminarProducto = (id) => cioModel.productos.eliminar(id)

const crearItem = ({ proyecto_id, fecha_facturacion, valor_facturado, descripcion }) =>
  cioModel.items.crear({ proyecto_id, fecha_facturacion, valor_facturado, descripcion })
const actualizarItem = (id, { fecha_facturacion, valor_facturado, descripcion }) =>
  cioModel.items.actualizar(id, { fecha_facturacion, valor_facturado, descripcion })
const eliminarItem = (id) => cioModel.items.eliminar(id)

function crearTiempo({ proyecto_id, producto_id, fecha, hora_inicio, hora_fin, con_quien, actividad }) {
  const horas = calcularHoras(hora_inicio, hora_fin)
  return cioModel.tiempos.crear({ proyecto_id, producto_id: producto_id || null, fecha, hora_inicio, hora_fin, horas, con_quien, actividad })
}

function actualizarTiempo(id, { producto_id, fecha, hora_inicio, hora_fin, con_quien, actividad }) {
  const horas = calcularHoras(hora_inicio, hora_fin)
  return cioModel.tiempos.actualizar(id, { producto_id: producto_id || null, fecha, hora_inicio, hora_fin, horas, con_quien, actividad })
}

const eliminarTiempo = (id) => cioModel.tiempos.eliminar(id)

module.exports = {
  listarClientes, crearCliente, actualizarCliente, eliminarCliente,
  listarProyectos, crearProyecto, actualizarProyecto, eliminarProyecto,
  crearProducto, actualizarProducto, eliminarProducto,
  crearItem, actualizarItem, eliminarItem,
  crearTiempo, actualizarTiempo, eliminarTiempo,
}
