const formacionService = require('../services/formacionService')
const { responderEscritura } = require('../utils/respuestas')

// Listados por ciudad: 400 sin ciudad, 500 con [] si falla la consulta
const listadoPorCiudad = (listar) => async (req, res) => {
  const { ciudad } = req.query
  if (!ciudad) return res.status(400).json([])
  const { data, error } = await listar(ciudad)
  if (error) return res.status(500).json([])
  res.json(data)
}

async function consagrar(req, res) {
  const { ids, fecha_consagracion, acta_url } = req.body
  if (!ids || !ids.length || !fecha_consagracion)
    return res.status(400).json({ ok: false, mensaje: 'Faltan datos' })
  const fallidos = await formacionService.consagrar(ids, fecha_consagracion, acta_url, req.headers['x-miembro-id'])
  if (fallidos) return res.status(500).json({ ok: false, mensaje: `Fallaron ${fallidos} registros` })
  res.json({ ok: true })
}

async function registrarConceptoConsejo(req, res) {
  const { concepto_consejo, fecha_reunion_consejo, avala } = req.body
  if (!concepto_consejo || !fecha_reunion_consejo || avala === undefined)
    return res.status(400).json({ ok: false, mensaje: 'Faltan datos' })
  const resultado = await formacionService.registrarConceptoConsejo(
    req.params.id, req.headers['x-miembro-id'], { concepto_consejo, fecha_reunion_consejo, avala })
  responderEscritura(res, resultado)
}

async function cambiarEstado(req, res) {
  const { estado, concepto_formacion } = req.body
  if (!formacionService.ESTADOS_FORMACION.includes(estado)) return res.status(400).json({ ok: false, mensaje: 'Estado no permitido' })
  const resultado = await formacionService.cambiarEstadoFormacion(req.params.id, req.headers['x-miembro-id'], estado, concepto_formacion)
  responderEscritura(res, resultado)
}

async function listarPendientesJunta(req, res) {
  const { data, error } = await formacionService.listarPendientesJunta()
  if (error) return res.status(500).json([])
  res.json(data)
}

async function registrarDecisionJunta(req, res) {
  const { decision, notas, fecha_junta } = req.body
  if (!formacionService.DECISIONES_JUNTA.includes(decision))
    return res.status(400).json({ ok: false, mensaje: 'Decisión no válida' })
  if (!fecha_junta)
    return res.status(400).json({ ok: false, mensaje: 'La fecha de reunión de la junta es obligatoria' })
  responderEscritura(res, await formacionService.registrarDecisionJunta(req.params.id, { decision, notas, fecha_junta }))
}

module.exports = {
  listarPendientes: listadoPorCiudad(formacionService.listarPendientes),
  listarCumpleRequisitos: listadoPorCiudad(formacionService.listarCumpleRequisitos),
  listarAprobadosFormacion: listadoPorCiudad(formacionService.listarAprobadosFormacion),
  listarAprobadosConsagracion: listadoPorCiudad(formacionService.listarAprobadosConsagracion),
  consagrar,
  registrarConceptoConsejo,
  cambiarEstado,
  listarPendientesJunta,
  registrarDecisionJunta,
}
