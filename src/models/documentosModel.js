// Documentos de ingreso que se adjuntan al correo de bienvenida (carpeta pdfs/ en la raíz)
const fs = require('fs')
const path = require('path')

const CARPETA = path.join(__dirname, '..', '..', 'pdfs')

const DOCUMENTOS_INGRESO = [
  ['codigoconducta.pdf', 'Codigo_de_Conducta_SDS.pdf'],
  ['manualbuentrato.pdf', 'Manual_del_Buen_Trato_SDS.pdf'],
]

// Adjuntos para Resend; omite los archivos que no existan
function adjuntosDeIngreso() {
  const adjuntos = []
  for (const [archivo, nombreAdjunto] of DOCUMENTOS_INGRESO) {
    const ruta = path.join(CARPETA, archivo)
    if (fs.existsSync(ruta)) {
      adjuntos.push({ filename: nombreAdjunto, content: fs.readFileSync(ruta).toString('base64') })
    }
  }
  return adjuntos
}

module.exports = { adjuntosDeIngreso }
