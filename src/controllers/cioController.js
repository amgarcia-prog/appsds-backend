const cioService = require('../services/cioService')
const { responderEscritura, responderCreacion } = require('../utils/respuestas')

// Las lecturas del CIO responden { error } cuando fallan; las escrituras, { ok, mensaje }
function responderLectura(res, { data, error }) {
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
}

module.exports = {
  listarClientes: async (req, res) => responderLectura(res, await cioService.listarClientes()),
  crearCliente: async (req, res) => responderCreacion(res, await cioService.crearCliente(req.body)),
  actualizarCliente: async (req, res) => responderEscritura(res, await cioService.actualizarCliente(req.params.id, req.body)),
  eliminarCliente: async (req, res) => responderEscritura(res, await cioService.eliminarCliente(req.params.id)),

  listarProyectos: async (req, res) => responderLectura(res, await cioService.listarProyectos(req.params.clienteId)),
  crearProyecto: async (req, res) => responderCreacion(res, await cioService.crearProyecto(req.body)),
  actualizarProyecto: async (req, res) => responderEscritura(res, await cioService.actualizarProyecto(req.params.id, req.body)),
  eliminarProyecto: async (req, res) => responderEscritura(res, await cioService.eliminarProyecto(req.params.id)),

  crearProducto: async (req, res) => responderCreacion(res, await cioService.crearProducto(req.body)),
  actualizarProducto: async (req, res) => responderEscritura(res, await cioService.actualizarProducto(req.params.id, req.body)),
  eliminarProducto: async (req, res) => responderEscritura(res, await cioService.eliminarProducto(req.params.id)),

  crearItem: async (req, res) => responderCreacion(res, await cioService.crearItem(req.body)),
  actualizarItem: async (req, res) => responderEscritura(res, await cioService.actualizarItem(req.params.id, req.body)),
  eliminarItem: async (req, res) => responderEscritura(res, await cioService.eliminarItem(req.params.id)),

  crearTiempo: async (req, res) => responderCreacion(res, await cioService.crearTiempo(req.body)),
  actualizarTiempo: async (req, res) => responderEscritura(res, await cioService.actualizarTiempo(req.params.id, req.body)),
  eliminarTiempo: async (req, res) => responderEscritura(res, await cioService.eliminarTiempo(req.params.id)),
}
