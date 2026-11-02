const recibosService = require('../services/recibosService')
const recibo = require('../views/reportes/recibo')
const { rangoMes } = require('../utils/fechas')

async function enviar(req, res) {
  try {
    const { resultado, correo } = await recibosService.enviarRecibo(req.params.id, req.ciudadFinanciero, req.headers['x-miembro-id'])
    if (resultado === 'no_encontrado') return res.status(404).json({ ok: false, mensaje: 'Ingreso no encontrado' })
    if (resultado === 'sin_correo') return res.status(400).json({ ok: false, mensaje: 'El benefactor no tiene correo registrado' })
    res.json({ ok: true, mensaje: `Recibo enviado a ${correo}` })
  } catch (err) {
    console.error('Error enviando recibo:', err)
    res.status(500).json({ ok: false, mensaje: err.message })
  }
}

async function proximoNumero(req, res) {
  res.json({ proximo: await recibosService.proximoNumero(req.ciudadFinanciero) })
}

async function descargar(req, res) {
  const datos = await recibosService.datosRecibo(req.params.id, req.ciudadFinanciero, req.headers['x-miembro-id'])
  if (!datos) return res.status(404).json({ error: 'Ingreso no encontrado' })
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="recibo_${recibo.numeroDeRecibo(datos.ingreso)}.pdf"`)
  recibo.escribirRecibo(res, datos.ingreso, datos.config, datos.receptor, datos.logo)
}

// ZIP con los recibos de todos los ingresos del mes
async function descargarDelMes(req, res) {
  try {
    const { mes, anio } = req.query
    if (!mes || !anio) return res.status(400).json({ error: 'Mes y año requeridos' })
    const { desde, hasta, nombreMes } = rangoMes(mes, anio)
    const { ingresos, config, receptor, logo } = await recibosService.datosRecibosDelMes(req.ciudadFinanciero, req.headers['x-miembro-id'], desde, hasta)

    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="recibos_${nombreMes}_${anio}.zip"`)
    const archivo = await recibo.escribirZipDeRecibos(res, ingresos, config, receptor, logo)
    archivo.on('error', err => { console.error('ZIP error:', err); if (!res.headersSent) res.status(500).json({ error: err.message }) })
    archivo.finalize()
  } catch (err) {
    console.error('Error ZIP recibos:', err)
    if (!res.headersSent) res.status(500).json({ error: err.message })
  }
}

module.exports = { enviar, proximoNumero, descargar, descargarDelMes }
