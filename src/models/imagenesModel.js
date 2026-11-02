// Descarga de imágenes externas: el logo de los recibos y los comprobantes guardados en Storage
const https = require('https')
const http = require('http')
const { LOGO_URL } = require('../config/env')

// El logo se descarga una vez por proceso
let logoBuffer = null

async function obtenerLogo() {
  if (logoBuffer) return logoBuffer
  try {
    logoBuffer = await new Promise((resolve, reject) => {
      https.get(LOGO_URL, (r) => {
        const chunks = []
        r.on('data', c => chunks.push(c))
        r.on('end', () => resolve(Buffer.concat(chunks)))
        r.on('error', reject)
      }).on('error', reject)
    })
    return logoBuffer
  } catch (e) {
    console.error('Error descargando logo:', e.message)
    return null
  }
}

// Sigue redirecciones; devuelve null si falla o tarda más de 10 s
function descargar(url) {
  return new Promise((resolve) => {
    try {
      const mod = url.startsWith('https') ? https : http
      const req = mod.get(url, (r) => {
        if (r.statusCode === 301 || r.statusCode === 302) {
          descargar(r.headers.location).then(resolve)
          return
        }
        const chunks = []
        r.on('data', c => chunks.push(c))
        r.on('end', () => resolve(Buffer.concat(chunks)))
        r.on('error', () => resolve(null))
      })
      req.on('error', () => resolve(null))
      req.setTimeout(10000, () => { req.destroy(); resolve(null) })
    } catch (e) { resolve(null) }
  })
}

module.exports = { obtenerLogo, descargar }
