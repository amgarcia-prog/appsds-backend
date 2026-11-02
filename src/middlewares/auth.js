// Guards de autorización. La identidad del miembro llega en x-miembro-id sin verificar;
// las claves de admin y CIO son valores fijos (ver config/env.js).
const { ADMIN_KEY, CIO_KEY } = require('../config/env')
const roles = require('../services/rolesService')

const verificarAdmin = (req, res, next) => {
  if (req.headers['x-admin-key'] !== ADMIN_KEY) {
    return res.status(401).json({ ok: false, mensaje: 'No autorizado' })
  }
  next()
}

const verificarCIO = (req, res, next) => {
  if (req.headers['x-cio-key'] !== CIO_KEY) return res.status(401).json({ error: 'No autorizado' })
  next()
}

// Pilar de comunicaciones o miembro con el rol; también acepta la clave de admin
const verificarComunicaciones = async (req, res, next) => {
  if (req.headers['x-admin-key'] === ADMIN_KEY) return next()
  const id = req.headers['x-miembro-id']
  if (!id) return res.status(401).json({ ok: false, mensaje: 'No autorizado' })
  const { data } = await roles.cargarMiembro(id, 'roles, estado_consagracion, responsabilidades_pilar')
  if (!data) return res.status(401).json({ ok: false, mensaje: 'No autorizado' })
  if (!roles.esResponsableComunicaciones(data)) return res.status(403).json({ ok: false, mensaje: 'Solo responsables de comunicaciones' })
  next()
}

// Comunicaciones del consejo de una ciudad; deja la ciudad en req.ciudadComunicaciones
const verificarComunicacionesConsejo = async (req, res, next) => {
  const id = req.headers['x-miembro-id']
  if (!id) return res.status(401).json({ ok: false, mensaje: 'No autorizado' })
  const { data } = await roles.cargarMiembro(id, 'roles, responsabilidades_consejo, ciudad_donde_sirve')
  if (!data) return res.status(401).json({ ok: false, mensaje: 'No autorizado' })
  if (!roles.esResponsableComunicacionesCiudad(data)) return res.status(403).json({ ok: false, mensaje: 'Solo responsables de comunicaciones del consejo' })
  req.ciudadComunicaciones = data.ciudad_donde_sirve
  next()
}

const verificarPilarOrganizacional = async (req, res, next) => {
  const id = req.headers['x-miembro-id']
  if (!id) return res.status(401).json({ error: 'No autorizado' })
  const { data } = await roles.cargarMiembro(id, 'estado_consagracion, responsabilidades_pilar')
  if (!data || !roles.esPilarOrganizacional(data))
    return res.status(403).json({ error: 'Solo pilares con rol Organizacional' })
  next()
}

// Responsable financiero; deja la ciudad en req.ciudadFinanciero
const verificarFinanciero = async (req, res, next) => {
  const id = req.headers['x-miembro-id']
  if (!id) return res.status(401).json({ error: 'No autorizado' })
  const { data } = await roles.cargarMiembro(id, 'roles, responsabilidades_consejo, ciudad_donde_sirve')
  if (!data) return res.status(401).json({ error: 'No autorizado' })
  if (!roles.esResponsableFinanciero(data)) return res.status(403).json({ error: 'Solo responsables financieros' })
  req.ciudadFinanciero = data.ciudad_donde_sirve
  next()
}

module.exports = {
  verificarAdmin,
  verificarCIO,
  verificarComunicaciones,
  verificarComunicacionesConsejo,
  verificarPilarOrganizacional,
  verificarFinanciero,
}
