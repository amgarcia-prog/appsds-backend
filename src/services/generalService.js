const storageModel = require('../models/storageModel')
const correoModel = require('../models/correoModel')
const correos = require('../views/correos')
const { REMITENTE, CORREO_ADMINISTRACION } = require('../config/env')

// Sube el archivo a <carpeta>/<nombre>; con nombre propio sobrescribe, si no usa la fecha actual
async function subirArchivo(archivo, { bucket, carpeta, nombre }) {
  const ext = archivo.originalname.split('.').pop()
  const ruta = nombre ? `${carpeta}/${nombre}` : `${carpeta}/${Date.now()}.${ext}`
  const { error } = await storageModel.subir(bucket, ruta, archivo.buffer, {
    contentType: archivo.mimetype,
    upsert: !!nombre,
  })
  if (error) return { error }
  return { url: storageModel.urlPublica(bucket, ruta) }
}

const eliminarArchivo = (bucket, ruta) => storageModel.eliminar(bucket, ruta)

// Formulario de contacto de la web pública, enviado a administración
function enviarContacto({ nombre, email, asunto, mensaje }) {
  return correoModel.enviar({
    from: REMITENTE,
    to: [CORREO_ADMINISTRACION],
    reply_to: email,
    subject: asunto ? `Contacto web: ${asunto}` : 'Nuevo mensaje desde la página web',
    html: correos.contacto({ nombre, email, asunto, mensaje }),
  })
}

module.exports = { subirArchivo, eliminarArchivo, enviarContacto }
