const authService = require('../services/authService')

async function verificarCedula(req, res) {
  const { numero } = req.query
  if (!numero) return res.json({ existe: false })
  res.json({ existe: await authService.existeCedula(numero) })
}

async function registrar(req, res) {
  const datos = req.body
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress

  const { resultado, error, nombreCompleto } = await authService.registrar(datos, ip)
  if (resultado === 'duplicado') {
    return res.status(400).json({ ok: false, mensaje: 'Ya existe un registro con este número de identificación.' })
  }
  if (resultado === 'error_guardado') {
    console.error('❌ Error guardando en base de datos:', error)
    return res.status(500).json({ ok: false, mensaje: 'Error al guardar el registro.' })
  }
  console.log(`✅ Registro guardado: ${nombreCompleto}`)

  try {
    await authService.enviarBienvenida(datos.correoElectronico, nombreCompleto)
    console.log(`✅ Correo enviado a ${datos.correoElectronico}`)
    res.json({ ok: true, mensaje: 'Registro guardado y correo enviado correctamente.' })
  } catch (err) {
    console.error('❌ Error enviando correo:', err)
    res.status(500).json({ ok: false, mensaje: 'Error al enviar el correo.' })
  }
}

const RECHAZOS_LOGIN = {
  no_encontrado: 'Número de identificación no encontrado.',
  sin_clave: 'Tu usuario aún no tiene clave asignada. Contacta al administrador.',
  clave_incorrecta: 'Clave incorrecta.',
}

async function iniciarSesion(req, res) {
  const { numeroIdentificacion, clave } = req.body
  if (!numeroIdentificacion || !clave) {
    return res.status(400).json({ ok: false, mensaje: 'Ingresa tu número de identificación y clave.' })
  }
  const { resultado, miembro } = await authService.iniciarSesion(numeroIdentificacion, clave)
  if (resultado !== 'ok') return res.status(401).json({ ok: false, mensaje: RECHAZOS_LOGIN[resultado] })
  res.json({ ok: true, miembro })
}

const RECHAZOS_RECUPERACION = {
  no_encontrado: [404, 'Número de identificación no encontrado.'],
  sin_correo: [400, 'Tu registro no tiene correo electrónico guardado. Contacta al administrador de tu ciudad.'],
  error_token: [500, 'No se pudo generar el enlace. Intenta de nuevo.'],
  error_correo: [500, 'No se pudo enviar el correo. Intenta de nuevo.'],
}

async function olvideClave(req, res) {
  const { numeroIdentificacion } = req.body
  if (!numeroIdentificacion) return res.status(400).json({ ok: false, mensaje: 'Ingresa tu número de identificación.' })
  const { resultado, correo } = await authService.solicitarRecuperacion(numeroIdentificacion)
  if (resultado !== 'ok') {
    const [status, mensaje] = RECHAZOS_RECUPERACION[resultado]
    return res.status(status).json({ ok: false, mensaje })
  }
  res.json({ ok: true, mensaje: `Te enviamos un enlace a ${correo} para crear una nueva clave.` })
}

const RECHAZOS_RESTABLECER = {
  token_invalido: [400, 'Este enlace no es válido. Solicita uno nuevo.'],
  token_vencido: [400, 'Este enlace venció. Solicita uno nuevo.'],
  error_guardado: [500, 'No se pudo actualizar la clave.'],
}

async function restablecerClave(req, res) {
  const { token, claveNueva } = req.body
  if (!token || !claveNueva) return res.status(400).json({ ok: false, mensaje: 'Faltan datos.' })
  if (claveNueva.length < 6) return res.status(400).json({ ok: false, mensaje: 'La clave debe tener mínimo 6 caracteres.' })
  const { resultado } = await authService.restablecerClave(token, claveNueva)
  if (resultado !== 'ok') {
    const [status, mensaje] = RECHAZOS_RESTABLECER[resultado]
    return res.status(status).json({ ok: false, mensaje })
  }
  res.json({ ok: true, mensaje: 'Tu clave se actualizó correctamente.' })
}

module.exports = { verificarCedula, registrar, iniciarSesion, olvideClave, restablecerClave }
