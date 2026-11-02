// PDF con una página por movimiento: sus datos y la imagen del comprobante.
// Las imágenes llegan ya descargadas (null si no se pudo).
const PDFDocument = require('pdfkit')

const formatoPesos = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })

// Título, tipo, fecha, valor y número de recibo; devuelve el ancho útil
function encabezadoPagina(doc, mov, titulo) {
  const W = doc.page.width - 80
  doc.fontSize(11).font('Helvetica-Bold')
    .text(titulo, 40, 40, { width: W, align: 'center' })
  doc.moveTo(40, 58).lineTo(40 + W, 58).lineWidth(0.5).stroke()
  doc.fontSize(9).font('Helvetica-Bold').text('Tipo:', 40, 68).font('Helvetica').text(mov._tipo, 80, 68)
  doc.fontSize(9).font('Helvetica-Bold').text('Fecha:', 40, 82).font('Helvetica').text(mov.fecha, 85, 82)
  doc.fontSize(9).font('Helvetica-Bold').text('Valor:', 200, 82).font('Helvetica').text(formatoPesos.format(Number(mov.valor)), 240, 82)
  if (mov.numero_recibo) { doc.fontSize(9).font('Helvetica-Bold').text('Recibo:', 350, 82).font('Helvetica').text(`#${mov.numero_recibo}`, 395, 82) }
  return W
}

function imagenNoDisponible(doc, y) {
  doc.fontSize(9).font('Helvetica').fillColor('gray').text('(Imagen no disponible)', 40, y)
  doc.fillColor('black')
}

// Imagen ajustada al resto de la página. Si no se descargó, el aviso va en y = 133.
function dibujarImagen(doc, imagen, W, y) {
  if (!imagen) return imagenNoDisponible(doc, 133)
  const maxH = doc.page.height - y - 40
  try {
    doc.image(imagen, 40, y, { width: W, height: maxH, fit: [W, maxH], align: 'center', valign: 'top' })
  } catch (e) {
    imagenNoDisponible(doc, y)
  }
}

const nombreBenefactor = (mov) => mov.providente?.nombre || mov.providente_otro || ''

// Banco: concepto y benefactor en posiciones fijas
function paginaBanco(doc, mov, imagen, titulo) {
  const W = encabezadoPagina(doc, mov, titulo)
  if (mov.concepto) { doc.fontSize(9).font('Helvetica-Bold').text('Concepto:', 40, 96).font('Helvetica').text(mov.concepto, 105, 96, { width: W - 65 }) }
  const benefactor = nombreBenefactor(mov)
  if (benefactor) { doc.fontSize(9).font('Helvetica-Bold').text('Benefactor:', 40, 110).font('Helvetica').text(benefactor, 108, 110, { width: W - 68 }) }
  doc.moveTo(40, 125).lineTo(40 + W, 125).lineWidth(0.5).stroke()
  dibujarImagen(doc, imagen, W, 133)
}

// Otras cuentas: servicio, concepto y benefactor uno debajo del otro, solo los que existan
function paginaCuenta(doc, mov, imagen, titulo) {
  const W = encabezadoPagina(doc, mov, titulo)
  const servicio = mov.punto?.nombre || mov.punto_servicio_otro || ''
  let lineY = 96
  if (servicio) { doc.fontSize(9).font('Helvetica-Bold').text('Servicio:', 40, lineY).font('Helvetica').text(servicio, 100, lineY, { width: W - 60 }); lineY += 14 }
  if (mov.concepto) { doc.fontSize(9).font('Helvetica-Bold').text('Concepto:', 40, lineY).font('Helvetica').text(mov.concepto, 105, lineY, { width: W - 65 }); lineY += 14 }
  const benefactor = nombreBenefactor(mov)
  if (benefactor) { doc.fontSize(9).font('Helvetica-Bold').text('Benefactor:', 40, lineY).font('Helvetica').text(benefactor, 108, lineY, { width: W - 68 }); lineY += 14 }
  const sepY = Math.max(lineY + 2, 125)
  doc.moveTo(40, sepY).lineTo(40 + W, sepY).lineWidth(0.5).stroke()
  dibujarImagen(doc, imagen, W, sepY + 8)
}

// movimientos e imagenes van en paralelo (misma posición)
async function pdfDeImagenes({ movimientos, imagenes, titulo, esBanco }) {
  const doc = new PDFDocument({ size: 'LETTER', margin: 40, autoFirstPage: false })
  const chunks = []
  doc.on('data', c => chunks.push(c))
  const pdfListo = new Promise((resolve, reject) => { doc.on('end', resolve); doc.on('error', reject) })

  const pagina = esBanco ? paginaBanco : paginaCuenta
  movimientos.forEach((mov, i) => {
    doc.addPage()
    pagina(doc, mov, imagenes[i], titulo)
  })

  doc.end()
  await pdfListo
  return Buffer.concat(chunks)
}

module.exports = { pdfDeImagenes }
