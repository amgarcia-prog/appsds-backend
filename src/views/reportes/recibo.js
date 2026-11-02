// Recibo de donación en PDF (tamaño carta) y ZIP de recibos
const PDFDocument = require('pdfkit')
const archiver = require('archiver')
const { numLetras, capitalize } = require('../../utils/numLetras')

function generarReciboPDF(doc, ingreso, config, receptor, logo) {
  const M = 40
  const W = 515
  const fecha = new Date(ingreso.fecha + 'T12:00:00')
  const dia = String(fecha.getDate()).padStart(2,'0')
  const mes = String(fecha.getMonth()+1).padStart(2,'0')
  const anio = fecha.getFullYear()

  // ── Logo ──
  if (logo) doc.image(logo, M, 38, { width: 65, height: 65 })

  // ── Encabezado ──
  doc.fontSize(9).font('Helvetica-Bold')
    .text('Asociación Privada de Fieles Laicos', M+70, 42, { width: 330, align: 'center' })
  doc.fontSize(7.5).font('Helvetica-Bold')
    .text('"Donum Christi Comunidad Apostólica Servidores del Servidor hijos di Padre Pío"', M+70, 54, { width: 330, align: 'center' })
  doc.fontSize(9).font('Helvetica-Bold')
    .text('NIT. 900.049.867-5', M+70, 67, { width: 330, align: 'center' })

  // No. recibo (caja superior derecha)
  doc.rect(430, 40, 125, 24).stroke()
  doc.fontSize(9).font('Helvetica-Bold').text('No.', 435, 47)
  doc.fontSize(12).font('Helvetica-Bold').fillColor('red').text(ingreso.numero_recibo || '—', 460, 45, { width: 90, align: 'center' })
  doc.fillColor('black')

  // Caja fecha
  doc.rect(430, 68, 125, 36).stroke()
  doc.rect(430, 68, 125, 14).stroke()
  doc.fontSize(8).font('Helvetica-Bold').text('FECHA', 430, 70, { width: 125, align: 'center' })
  doc.rect(430, 82, 42, 22).stroke()
  doc.rect(472, 82, 42, 22).stroke()
  doc.rect(514, 82, 41, 22).stroke()
  doc.fontSize(7).font('Helvetica').text('DIA', 430, 84, { width: 42, align: 'center' })
    .text('MES', 472, 84, { width: 42, align: 'center' })
    .text('AÑO', 514, 84, { width: 41, align: 'center' })
  doc.fontSize(9).font('Helvetica-Bold')
    .text(dia, 430, 93, { width: 42, align: 'center' })
    .text(mes, 472, 93, { width: 42, align: 'center' })
    .text(String(anio), 514, 93, { width: 41, align: 'center' })

  // ── Sección benefactor ──
  const BY = 130
  doc.roundedRect(M, BY, W, 90, 4).stroke()
  doc.moveTo(M, BY+30).lineTo(M+W, BY+30).stroke()
  doc.moveTo(M, BY+60).lineTo(M+W, BY+60).stroke()
  doc.moveTo(M+310, BY).lineTo(M+310, BY+90).stroke()

  const nombre = ingreso.providente?.nombre || ingreso.providente_otro || '—'
  const cc = ingreso.providente?.numero_identificacion || ''
  const dir = ingreso.providente?.direccion || ''
  const tel = ingreso.providente?.telefono || ''
  const email = ingreso.providente?.correo || ''

  doc.fontSize(7).font('Helvetica-Bold').text('NOMBRE / RAZON SOCIAL', M+5, BY+4)
  doc.fontSize(9).font('Helvetica').text(nombre, M+5, BY+16)
  doc.fontSize(7).font('Helvetica-Bold').text('CÉDULA / NIT', M+315, BY+4)
  doc.fontSize(9).font('Helvetica').text(cc, M+315, BY+16, { width: 200, align: 'center' })
  doc.fontSize(7).font('Helvetica-Bold').text('DIRECCIÓN', M+5, BY+34)
  doc.fontSize(9).font('Helvetica').text(dir, M+5, BY+45)
  doc.fontSize(7).font('Helvetica-Bold').text('TELÉFONO', M+315, BY+34)
  doc.fontSize(9).font('Helvetica').text(tel, M+315, BY+48, { width: 200, align: 'center' })
  doc.fontSize(7).font('Helvetica-Bold').text('EMAIL', M+5, BY+64)
  doc.fontSize(9).font('Helvetica').text(email, M+5, BY+75)

  // ── Sección donación ──
  const DY = 235
  const esEspecie = ingreso.forma_donacion === 'especie'
  const esBanco   = ingreso.cuenta === 'banco'

  doc.fontSize(8).font('Helvetica-Bold').text('DONACIÓN EN:', M, DY+5)
  doc.fontSize(7).font('Helvetica')
  // checkboxes
  const cbX = M+5
  doc.rect(cbX, DY+18, 9, 9).stroke().text('ESPECIE',  cbX+12, DY+19)
  doc.rect(cbX, DY+31, 9, 9).stroke().text('EFECTIVO', cbX+12, DY+32)
  doc.rect(cbX, DY+44, 9, 9).stroke().text('BANCO',    cbX+12, DY+45)
  doc.fontSize(8).font('Helvetica-Bold')
  if (esEspecie) doc.text('X', cbX+1, DY+19)
  else if (esBanco) doc.text('X', cbX+1, DY+45)
  else doc.text('X', cbX+1, DY+32)

  // Valor y suma en letras
  doc.roundedRect(M+90, DY+10, 340, 45, 3).stroke()
  const valor = Number(ingreso.valor)
  const fmtVal = new Intl.NumberFormat('es-CO').format(valor)
  doc.fontSize(14).font('Helvetica-Bold').text(`$ ${fmtVal}`, M+95, DY+16, { width: 100 })
  doc.fontSize(8).font('Helvetica-Bold').text('LA SUMA DE', M+200, DY+16)
  doc.fontSize(8).font('Helvetica').text(capitalize(numLetras(valor)) + ' Pesos', M+200, DY+28, { width: 225 })

  // Concepto
  const CY = DY + 65
  doc.roundedRect(M, CY, W, 28, 3).stroke()
  doc.fontSize(8).font('Helvetica-Bold').text('CONCEPTO', M+5, CY+4)
  doc.fontSize(9).font('Helvetica').text(ingreso.concepto || '', M+80, CY+4)

  // ── Footer ──
  const FY = CY + 40
  doc.roundedRect(M, FY, 130, 40, 3).stroke()
  doc.fontSize(7).font('Helvetica-Bold').text('NOMBRE DE QUIEN RECIBE', M+5, FY+5)
  doc.fontSize(9).font('Helvetica').text(receptor || '', M+5, FY+18)

  doc.fontSize(7).font('Helvetica')
    .text(config.cuenta_bancaria || '', M+145, FY+2, { width: 220 })
    .text(`Oficina Carrera 20 No 62-37  Teléfono: 7551335`, M+145, FY+12, { width: 220 })
    .text('administracion@servidoresdelservidor.org', M+145, FY+22, { width: 220 })
    .fontSize(6.5).text('"Señor mi Dios, si amas al que da alegremente, suscita entonces en nuestros corazones la alegría de servirnos unos a otros mediante la caridad."', M+145, FY+30, { width: 220 })

  doc.fontSize(7).text('www.servidoresdelservidor.org', M+370, FY+20, { width: 185, align: 'center' })
}

const nuevoDocumento = () => new PDFDocument({ size: 'LETTER', margin: 0 })

// Nombre del archivo: número de recibo o, si no tiene, el inicio del id
const numeroDeRecibo = (ingreso) => ingreso.numero_recibo || ingreso.id.substring(0, 8)

// Escribe el recibo directamente en un stream (por ejemplo, la respuesta HTTP)
function escribirRecibo(salida, ingreso, config, receptor, logo) {
  const doc = nuevoDocumento()
  doc.pipe(salida)
  generarReciboPDF(doc, ingreso, config, receptor, logo)
  doc.end()
}

// Genera el recibo completo en memoria
function reciboEnBuffer(ingreso, config, receptor, logo) {
  return new Promise((resolve, reject) => {
    const chunks = []
    const doc = nuevoDocumento()
    doc.on('data', c => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    generarReciboPDF(doc, ingreso, config, receptor, logo)
    doc.end()
  })
}

// ZIP con un recibo por ingreso, escrito en el stream de salida. Devuelve el archivo
// sin cerrar para que quien llama registre su manejo de errores y llame a finalize().
async function escribirZipDeRecibos(salida, ingresos, config, receptor, logo) {
  const archive = archiver('zip', { zlib: { level: 6 } })
  archive.pipe(salida)
  for (const ingreso of ingresos) {
    const pdf = await reciboEnBuffer(ingreso, config, receptor, logo)
    archive.append(pdf, { name: `recibo_${numeroDeRecibo(ingreso)}.pdf` })
  }
  return archive
}

module.exports = { numeroDeRecibo, escribirRecibo, reciboEnBuffer, escribirZipDeRecibos }
