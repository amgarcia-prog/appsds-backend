// Rutas del index.js original que todavía no se migran a MVC.
// Cada etapa de la migración mueve un módulo fuera de este archivo; al final se elimina.
const express = require('express')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const ExcelJS = require('exceljs')
const PDFDocument = require('pdfkit')
const archiver = require('archiver')
const supabase = require('../config/supabase')
const resend = require('../config/resend')
const upload = require('../config/upload')
const { ADMIN_KEY, FRONTEND_URL, LOGO_URL } = require('../config/env')
const {
  verificarAdmin,
  verificarCIO,
  verificarComunicaciones,
  verificarComunicacionesConsejo,
  verificarPilarOrganizacional,
  verificarFinanciero,
} = require('../middlewares/auth')
const { agregarHistorial } = require('../services/historialService')
const { numLetras, capitalize } = require('../utils/numLetras')

const router = express.Router()

// ── FINANCIERO ───────────────────────────────────────────────────────────────

const generarReporteMovimiento = async (req, res, cuenta, tituloLabel, nombreArchivo) => {
  const { mes, anio } = req.query
  if (!mes || !anio) return res.status(400).json({ error: 'Mes y año requeridos' })

  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const nombreMes = MESES[parseInt(mes) - 1]
  const desde = `${anio}-${mes.padStart(2,'0')}-01`
  const ultimoDia = new Date(Number(anio), Number(mes), 0).getDate()
  const hasta = `${anio}-${mes.padStart(2,'0')}-${String(ultimoDia).padStart(2,'0')}`

  const [{ data: saldoData }, { data: ingHist }, { data: egrHist }, { data: ingresos }, { data: egresos }] = await Promise.all([
    supabase.from('saldos_iniciales').select('saldo').eq('ciudad', req.ciudadFinanciero).eq('cuenta', cuenta).single(),
    supabase.from('ingresos').select('valor').eq('ciudad', req.ciudadFinanciero).eq('cuenta', cuenta).lt('fecha', desde),
    supabase.from('egresos').select('valor').eq('ciudad', req.ciudadFinanciero).eq('cuenta', cuenta).lt('fecha', desde),
    supabase.from('ingresos').select('*').eq('ciudad', req.ciudadFinanciero).eq('cuenta', cuenta).gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: true }),
    supabase.from('egresos').select('*').eq('ciudad', req.ciudadFinanciero).eq('cuenta', cuenta).gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: true }),
  ])

  const saldoInicial = Number(saldoData?.saldo || 0)
  const totalIngHist = (ingHist || []).reduce((s, r) => s + Number(r.valor), 0)
  const totalEgrHist = (egrHist || []).reduce((s, r) => s + Number(r.valor), 0)
  let saldo = saldoInicial + totalIngHist - totalEgrHist

  const movimientos = [
    ...(ingresos || []).map(r => ({ ...r, _tipo: 'ingreso' })),
    ...(egresos || []).map(r => ({ ...r, _tipo: 'egreso' })),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha))

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(tituloLabel)

  ws.mergeCells('A1:E1')
  ws.getCell('A1').value = `${tituloLabel.toUpperCase()} — ${nombreMes.toUpperCase()} ${anio}`
  ws.getCell('A1').font = { bold: true, size: 13 }
  ws.getCell('A1').alignment = { horizontal: 'center' }
  ws.getRow(1).height = 22

  ws.mergeCells('A2:E2')
  ws.getCell('A2').value = `Ciudad: ${req.ciudadFinanciero}`
  ws.getCell('A2').font = { italic: true, size: 10 }
  ws.getCell('A2').alignment = { horizontal: 'center' }
  ws.addRow([])

  const hRow = ws.addRow(['Fecha', 'Concepto', 'Ingreso', 'Egreso', 'Saldo'])
  hRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }
    cell.alignment = { horizontal: 'center' }
  })

  const saRow = ws.addRow(['', 'Saldo anterior', '', '', saldo])
  saRow.getCell(2).font = { italic: true }
  saRow.getCell(5).numFmt = '$#,##0.00'
  saRow.getCell(5).font = { bold: true, italic: true }
  saRow.getCell(5).alignment = { horizontal: 'right' }

  movimientos.forEach((r, i) => {
    const esIngreso = r._tipo === 'ingreso'
    saldo += esIngreso ? Number(r.valor) : -Number(r.valor)
    const row = ws.addRow([r.fecha, r.concepto || '', esIngreso ? Number(r.valor) : null, esIngreso ? null : Number(r.valor), saldo])
    row.getCell(3).numFmt = '$#,##0.00'; row.getCell(3).alignment = { horizontal: 'right' }
    row.getCell(4).numFmt = '$#,##0.00'; row.getCell(4).alignment = { horizontal: 'right' }
    row.getCell(5).numFmt = '$#,##0.00'; row.getCell(5).alignment = { horizontal: 'right' }
    if (esIngreso) row.getCell(3).font = { color: { argb: 'FF1A7A3C' } }
    else row.getCell(4).font = { color: { argb: 'FFCC2200' } }
    if (i % 2 === 1) row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7FA' } } })
  })

  ws.addRow([])
  const tRow = ws.addRow(['', 'Saldo final', '', '', saldo])
  tRow.getCell(2).font = { bold: true }
  tRow.getCell(5).numFmt = '$#,##0.00'
  tRow.getCell(5).font = { bold: true }
  tRow.getCell(5).alignment = { horizontal: 'right' }

  ws.getColumn(1).width = 14; ws.getColumn(2).width = 40
  ws.getColumn(3).width = 16; ws.getColumn(4).width = 16; ws.getColumn(5).width = 16

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}_${nombreMes}_${anio}.xlsx"`)
  await wb.xlsx.write(res)
  res.end()
}

// ── Helpers recibo PDF ──
let logoBuffer = null
async function getLogoBuffer() {
  if (logoBuffer) return logoBuffer
  try {
    const https = require('https')
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

function generarReciboPDF(doc, ingreso, config, receptor, logo) {
  const M = 40
  const W = 515
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
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

// ── PDF de imágenes por cuenta ──
async function descargarImagen(url) {
  return new Promise((resolve) => {
    try {
      const https = require('https')
      const http = require('http')
      const mod = url.startsWith('https') ? https : http
      const req = mod.get(url, (r) => {
        if (r.statusCode === 301 || r.statusCode === 302) {
          descargarImagen(r.headers.location).then(resolve)
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

async function generarPDFImagenesCuenta(req, res, cuenta, tituloLabel, nombreArchivo) {
  try {
    const { mes, anio } = req.query
    if (!mes || !anio) return res.status(400).json({ error: 'Mes y año requeridos' })
    const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
    const nombreMes = MESES[parseInt(mes) - 1]
    const desde = `${anio}-${mes.padStart(2,'0')}-01`
    const ultimoDia = new Date(Number(anio), Number(mes), 0).getDate()
    const hasta = `${anio}-${mes.padStart(2,'0')}-${String(ultimoDia).padStart(2,'0')}`

    const [{ data: ingresos }, { data: egresos }] = await Promise.all([
      supabase.from('ingresos').select('id, fecha, concepto, valor, numero_recibo, comprobante_url, providente_otro, tipo, providente:providente_id(nombre)')
        .eq('ciudad', req.ciudadFinanciero).eq('cuenta', cuenta)
        .not('comprobante_url', 'is', null).neq('comprobante_url', '').gte('fecha', desde).lte('fecha', hasta).order('fecha'),
      supabase.from('egresos').select('id, fecha, concepto, valor, documento_url, punto_servicio_otro, punto:punto_servicio_id(nombre)')
        .eq('ciudad', req.ciudadFinanciero).eq('cuenta', cuenta)
        .not('documento_url', 'is', null).neq('documento_url', '').gte('fecha', desde).lte('fecha', hasta).order('fecha'),
    ])

    const movimientos = [
      ...(ingresos || []).map(r => ({ ...r, _tipo: 'Ingreso', documento_url: r.comprobante_url })),
      ...(egresos || []).map(r => ({ ...r, _tipo: 'Egreso' })),
    ].sort((a, b) => a.fecha.localeCompare(b.fecha))

    if (movimientos.length === 0) return res.status(200).json({ sinImagenes: true, mensaje: 'Sin imágenes en este período' })

    const doc = new PDFDocument({ size: 'LETTER', margin: 40, autoFirstPage: false })
    const chunks = []
    doc.on('data', c => chunks.push(c))
    const pdfReady = new Promise((resolve, reject) => { doc.on('end', resolve); doc.on('error', reject) })

    for (const mov of movimientos) {
      doc.addPage()
      const W = doc.page.width - 80
      doc.fontSize(11).font('Helvetica-Bold')
        .text(`${tituloLabel} — ${nombreMes.toUpperCase()} ${anio}`, 40, 40, { width: W, align: 'center' })
      doc.moveTo(40, 58).lineTo(40 + W, 58).lineWidth(0.5).stroke()
      doc.fontSize(9).font('Helvetica-Bold').text('Tipo:', 40, 68).font('Helvetica').text(mov._tipo, 80, 68)
      doc.fontSize(9).font('Helvetica-Bold').text('Fecha:', 40, 82).font('Helvetica').text(mov.fecha, 85, 82)
      const valorFmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(Number(mov.valor))
      doc.fontSize(9).font('Helvetica-Bold').text('Valor:', 200, 82).font('Helvetica').text(valorFmt, 240, 82)
      if (mov.numero_recibo) { doc.fontSize(9).font('Helvetica-Bold').text('Recibo:', 350, 82).font('Helvetica').text(`#${mov.numero_recibo}`, 395, 82) }
      const servicio = mov.punto?.nombre || mov.punto_servicio_otro || ''
      let lineY = 96
      if (servicio) { doc.fontSize(9).font('Helvetica-Bold').text('Servicio:', 40, lineY).font('Helvetica').text(servicio, 100, lineY, { width: W - 60 }); lineY += 14 }
      if (mov.concepto) { doc.fontSize(9).font('Helvetica-Bold').text('Concepto:', 40, lineY).font('Helvetica').text(mov.concepto, 105, lineY, { width: W - 65 }); lineY += 14 }
      const nombreBenefactor = mov.providente?.nombre || mov.providente_otro || ''
      if (nombreBenefactor) { doc.fontSize(9).font('Helvetica-Bold').text('Benefactor:', 40, lineY).font('Helvetica').text(nombreBenefactor, 108, lineY, { width: W - 68 }); lineY += 14 }
      const sepY = Math.max(lineY + 2, 125)
      doc.moveTo(40, sepY).lineTo(40 + W, sepY).lineWidth(0.5).stroke()
      const imgBuf = await descargarImagen(mov.documento_url)
      if (imgBuf) {
        const imgY = sepY + 8
        const maxH = doc.page.height - imgY - 40
        try {
          doc.image(imgBuf, 40, imgY, { width: W, height: maxH, fit: [W, maxH], align: 'center', valign: 'top' })
        } catch (e) {
          doc.fontSize(9).font('Helvetica').fillColor('gray').text('(Imagen no disponible)', 40, sepY + 8)
          doc.fillColor('black')
        }
      } else {
        doc.fontSize(9).font('Helvetica').fillColor('gray').text('(Imagen no disponible)', 40, 133)
        doc.fillColor('black')
      }
    }
    doc.end()
    await pdfReady

    const buf = Buffer.concat(chunks)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}_${nombreMes}_${anio}.pdf"`)
    res.setHeader('Content-Length', buf.length)
    res.send(buf)
  } catch (err) {
    console.error(`Error PDF imágenes ${cuenta}:`, err)
    if (!res.headersSent) res.status(500).json({ error: err.message })
  }
}

module.exports = router
