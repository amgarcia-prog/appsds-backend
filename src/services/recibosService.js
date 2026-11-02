// Recibos de donación: numeración, PDF y envío por correo al benefactor
const ingresosModel = require('../models/ingresosModel')
const configCiudadModel = require('../models/configCiudadModel')
const registrosModel = require('../models/registrosModel')
const imagenesModel = require('../models/imagenesModel')
const correoModel = require('../models/correoModel')
const correos = require('../views/correos')
const recibo = require('../views/reportes/recibo')
const { REMITENTE } = require('../config/env')

const nombreReceptor = (user) => (user ? `${user.primer_nombre} ${user.primer_apellido}` : '')

// El siguiente número es el mayor numero_recibo numérico de la ciudad + 1; null si aún no hay ninguno
async function proximoNumero(ciudad) {
  const { data } = await ingresosModel.numerosDeRecibo(ciudad)
  const max = (data || []).reduce((m, r) => {
    const n = parseInt(r.numero_recibo)
    return isNaN(n) ? m : Math.max(m, n)
  }, 0)
  return max > 0 ? max + 1 : null
}

// Ingreso con los datos del benefactor, la cuenta de la ciudad, quien recibe y el logo.
// null si el ingreso no existe en la ciudad.
async function datosRecibo(id, ciudad, miembroId) {
  const { data: ingreso, error } = await ingresosModel.obtenerDeCiudad(id, ciudad,
    '*, providente:providente_id(nombre, numero_identificacion, telefono, direccion, correo)')
  if (error || !ingreso) return null
  const [{ data: cfg }, { data: user }, logo] = await Promise.all([
    configCiudadModel.obtener(ciudad),
    registrosModel.obtenerPorId(miembroId, 'primer_nombre, primer_apellido'),
    imagenesModel.obtenerLogo(),
  ])
  return { ingreso, config: cfg || {}, receptor: nombreReceptor(user), logo }
}

async function datosRecibosDelMes(ciudad, miembroId, desde, hasta) {
  const [{ data: ingresos }, { data: cfg }, { data: user }, logo] = await Promise.all([
    ingresosModel.listarEnRango('*, providente:providente_id(nombre, numero_identificacion, telefono, direccion, correo)', ciudad, desde, hasta, 'numero_recibo'),
    configCiudadModel.obtener(ciudad),
    registrosModel.obtenerPorId(miembroId, 'primer_nombre, primer_apellido'),
    imagenesModel.obtenerLogo(),
  ])
  return { ingresos: ingresos || [], config: cfg || {}, receptor: nombreReceptor(user), logo }
}

// Envía el recibo en PDF al correo del benefactor; las respuestas van a quien lo envía.
// Resultado: 'no_encontrado' | 'sin_correo' | 'ok' (con el correo). Lanza si falla el PDF o Resend.
async function enviarRecibo(id, ciudad, miembroId) {
  const { data: ingreso } = await ingresosModel.obtenerDeCiudad(id, ciudad,
    '*, providente:providente_id(nombre, correo, numero_identificacion, telefono, direccion)')
  if (!ingreso) return { resultado: 'no_encontrado' }

  const correo = ingreso.providente?.correo
  if (!correo) return { resultado: 'sin_correo' }

  const [{ data: cfg }, { data: user }, logo] = await Promise.all([
    configCiudadModel.obtener(ciudad),
    registrosModel.obtenerPorId(miembroId, 'primer_nombre, primer_apellido, correo_electronico'),
    imagenesModel.obtenerLogo(),
  ])
  const pdf = await recibo.reciboEnBuffer(ingreso, cfg || {}, nombreReceptor(user), logo)

  const nombre = ingreso.providente?.nombre || ingreso.providente_otro || 'Benefactor'
  const numRecibo = recibo.numeroDeRecibo(ingreso)
  const mensaje = {
    from: REMITENTE,
    to: correo,
    subject: `Recibo de donación No. ${numRecibo} — Gracias por tu generosidad`,
    html: correos.reciboDonacion(nombre, numRecibo),
    attachments: [{ filename: `recibo_${numRecibo}.pdf`, content: pdf.toString('base64') }],
  }
  if (user?.correo_electronico) mensaje.reply_to = user.correo_electronico
  await correoModel.enviar(mensaje)

  return { resultado: 'ok', correo }
}

module.exports = { proximoNumero, datosRecibo, datosRecibosDelMes, enviarRecibo }
