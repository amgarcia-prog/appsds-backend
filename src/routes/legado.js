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

// Puntos de servicio de la ciudad (para selectores)
router.get('/api/financiero/puntos-servicio', verificarFinanciero, async (req, res) => {
  const { data } = await supabase.from('puntos_servicio')
    .select('id, nombre').eq('activo', true).ilike('ciudad', req.ciudadFinanciero).order('nombre')
  res.json(data || [])
})

// ── Providentes ──
router.get('/api/financiero/providentes', verificarFinanciero, async (req, res) => {
  const { q } = req.query
  let query = supabase.from('providentes').select('*').eq('ciudad', req.ciudadFinanciero).order('nombre')
  if (q) query = query.ilike('nombre', `%${q}%`)
  const { data } = await query
  res.json(data || [])
})

router.post('/api/financiero/providentes', verificarFinanciero, async (req, res) => {
  const { numero_identificacion, nombre, telefono, direccion, correo } = req.body
  if (!numero_identificacion || !nombre) return res.status(400).json({ ok: false, mensaje: 'Cédula y nombre son requeridos' })
  const { data, error } = await supabase.from('providentes')
    .insert({ numero_identificacion, nombre, telefono, direccion, correo, ciudad: req.ciudadFinanciero })
    .select().single()
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true, data })
})

router.put('/api/financiero/providentes/:id', verificarFinanciero, async (req, res) => {
  const { numero_identificacion, nombre, telefono, direccion, correo } = req.body
  const { error } = await supabase.from('providentes').update({ numero_identificacion, nombre, telefono, direccion, correo })
    .eq('id', req.params.id).eq('ciudad', req.ciudadFinanciero)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

router.delete('/api/financiero/providentes/:id', verificarFinanciero, async (req, res) => {
  const { error } = await supabase.from('providentes').delete().eq('id', req.params.id).eq('ciudad', req.ciudadFinanciero)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

// ── Ingresos ──
router.get('/api/financiero/ingresos', verificarFinanciero, async (req, res) => {
  const { mes, anio } = req.query
  let query = supabase.from('ingresos')
    .select('*, providente:providente_id(nombre, correo), punto:punto_servicio_id(nombre), creador:registrado_por(primer_nombre, primer_apellido), editor:editado_por(primer_nombre, primer_apellido)')
    .eq('ciudad', req.ciudadFinanciero).order('fecha', { ascending: false })
  if (mes && anio) {
    const desde = `${anio}-${mes.padStart(2,'0')}-01`
    const ultimoDia = new Date(Number(anio), Number(mes), 0).getDate()
    const hasta = `${anio}-${mes.padStart(2,'0')}-${String(ultimoDia).padStart(2,'0')}`
    query = query.gte('fecha', desde).lte('fecha', hasta)
  }
  const { data } = await query
  res.json(data || [])
})

router.post('/api/financiero/ingresos', verificarFinanciero, async (req, res) => {
  const { fecha, providente_id, providente_otro, punto_servicio_id, punto_servicio_otro, tipo, concepto, mes_aporte, valor, comprobante_url, numero_recibo, forma_donacion, cuenta } = req.body
  if (!fecha || !tipo || !concepto || !valor) return res.status(400).json({ ok: false, mensaje: 'Faltan campos requeridos' })
  const id = req.headers['x-miembro-id']
  const psId = punto_servicio_id === '__otro__' ? null : (punto_servicio_id || null)
  const { data, error } = await supabase.from('ingresos')
    .insert({ fecha, providente_id: providente_id || null, providente_otro: providente_otro || null, punto_servicio_id: psId, punto_servicio_otro: punto_servicio_otro || null, tipo, concepto, mes_aporte: mes_aporte || null, valor, comprobante_url: comprobante_url || null, numero_recibo: numero_recibo || null, forma_donacion: forma_donacion || 'dinero', cuenta: cuenta || 'banco', ciudad: req.ciudadFinanciero, registrado_por: id })
    .select().single()
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true, data })
})

router.put('/api/financiero/ingresos/:id', verificarFinanciero, async (req, res) => {
  const { fecha, providente_id, providente_otro, punto_servicio_id, punto_servicio_otro, tipo, concepto, mes_aporte, valor, comprobante_url, numero_recibo, forma_donacion, cuenta } = req.body
  const psId = punto_servicio_id === '__otro__' ? null : (punto_servicio_id || null)
  const editor = req.headers['x-miembro-id']
  const { error } = await supabase.from('ingresos')
    .update({ fecha, providente_id: providente_id || null, providente_otro: providente_otro || null, punto_servicio_id: psId, punto_servicio_otro: punto_servicio_otro || null, tipo, concepto, mes_aporte: mes_aporte || null, valor, comprobante_url: comprobante_url || null, numero_recibo: numero_recibo || null, forma_donacion: forma_donacion || 'dinero', cuenta: cuenta || 'banco', editado_por: editor })
    .eq('id', req.params.id).eq('ciudad', req.ciudadFinanciero)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

router.delete('/api/financiero/ingresos/:id', verificarFinanciero, async (req, res) => {
  const { error } = await supabase.from('ingresos').delete().eq('id', req.params.id).eq('ciudad', req.ciudadFinanciero)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

router.patch('/api/financiero/ingresos/:id/revisado', verificarFinanciero, async (req, res) => {
  const { revisado } = req.body
  const { error } = await supabase.from('ingresos').update({ revisado }).eq('id', req.params.id).eq('ciudad', req.ciudadFinanciero)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

router.patch('/api/financiero/egresos/:id/revisado', verificarFinanciero, async (req, res) => {
  const { revisado } = req.body
  const { error } = await supabase.from('egresos').update({ revisado }).eq('id', req.params.id).eq('ciudad', req.ciudadFinanciero)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

// ── Reportes de donación (público, desde la página web) ──
router.post('/api/financiero/reportes-donacion', async (req, res) => {
  const { ciudad, nombre_donante, cedula, correo, telefono, direccion, valor, comprobante_url, concepto, comentario } = req.body
  if (!ciudad || !nombre_donante || !cedula || !correo || !telefono || !valor || !comprobante_url || !concepto) {
    return res.status(400).json({ ok: false, mensaje: 'Faltan campos requeridos' })
  }
  const { error } = await supabase.from('reportes_donacion')
    .insert({ ciudad, nombre_donante, cedula, correo, telefono, direccion: direccion || null, valor, comprobante_url, concepto, comentario: comentario || null })
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

router.get('/api/financiero/reportes-donacion', verificarFinanciero, async (req, res) => {
  const { data } = await supabase.from('reportes_donacion')
    .select('*').eq('ciudad', req.ciudadFinanciero).eq('atendido', false).order('created_at', { ascending: false })
  res.json(data || [])
})

router.patch('/api/financiero/reportes-donacion/:id/atendido', verificarFinanciero, async (req, res) => {
  const { error } = await supabase.from('reportes_donacion').update({ atendido: true }).eq('id', req.params.id).eq('ciudad', req.ciudadFinanciero)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

// ── Egresos ──
router.get('/api/financiero/egresos', verificarFinanciero, async (req, res) => {
  const { mes, anio } = req.query
  let query = supabase.from('egresos')
    .select('*, punto:punto_servicio_id(nombre), creador:registrado_por(primer_nombre, primer_apellido), editor:editado_por(primer_nombre, primer_apellido)')
    .eq('ciudad', req.ciudadFinanciero).order('fecha', { ascending: false })
  if (mes && anio) {
    const desde = `${anio}-${mes.padStart(2,'0')}-01`
    const ultimoDia = new Date(Number(anio), Number(mes), 0).getDate()
    const hasta = `${anio}-${mes.padStart(2,'0')}-${String(ultimoDia).padStart(2,'0')}`
    query = query.gte('fecha', desde).lte('fecha', hasta)
  }
  const { data } = await query
  res.json(data || [])
})

router.post('/api/financiero/egresos', verificarFinanciero, async (req, res) => {
  const { fecha, punto_servicio_id, punto_servicio_otro, concepto, valor, documento_url, tipo, cuenta } = req.body
  if (!fecha || !concepto || !valor) return res.status(400).json({ ok: false, mensaje: 'Faltan campos requeridos' })
  const id = req.headers['x-miembro-id']
  const psId = punto_servicio_id === '__otro__' ? null : (punto_servicio_id || null)
  const tipoFinal = tipo || 'egreso_servicio'
  const { data, error } = await supabase.from('egresos')
    .insert({ fecha, punto_servicio_id: psId, punto_servicio_otro: punto_servicio_otro || null, concepto, valor, documento_url: documento_url || null, tipo: tipoFinal, es_costo_financiero: tipoFinal === 'costo_financiero', cuenta: cuenta || 'banco', ciudad: req.ciudadFinanciero, registrado_por: id })
    .select().single()
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true, data })
})

router.put('/api/financiero/egresos/:id', verificarFinanciero, async (req, res) => {
  const { fecha, punto_servicio_id, punto_servicio_otro, concepto, valor, documento_url, tipo, cuenta } = req.body
  const psId = punto_servicio_id === '__otro__' ? null : (punto_servicio_id || null)
  const tipoFinal = tipo || 'egreso_servicio'
  const editor = req.headers['x-miembro-id']
  const { error } = await supabase.from('egresos')
    .update({ fecha, punto_servicio_id: psId, punto_servicio_otro: punto_servicio_otro || null, concepto, valor, documento_url: documento_url || null, tipo: tipoFinal, es_costo_financiero: tipoFinal === 'costo_financiero', cuenta: cuenta || 'banco', editado_por: editor })
    .eq('id', req.params.id).eq('ciudad', req.ciudadFinanciero)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

router.delete('/api/financiero/egresos/:id', verificarFinanciero, async (req, res) => {
  const { error } = await supabase.from('egresos').delete().eq('id', req.params.id).eq('ciudad', req.ciudadFinanciero)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

// ── Gestión del rol financiero ──
// ── Consultas ──
router.get('/api/financiero/consulta/aportes-benefactor', verificarFinanciero, async (req, res) => {
  const { providente_id, anio } = req.query
  let query = supabase.from('ingresos')
    .select('*')
    .eq('ciudad', req.ciudadFinanciero)
    .eq('tipo', 'aporte_consagrado')
    .order('fecha', { ascending: true })
  if (providente_id) query = query.eq('providente_id', providente_id)
  if (anio) query = query.gte('fecha', `${anio}-01-01`).lte('fecha', `${anio}-12-31`)
  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json(data || [])
})

router.get('/api/financiero/consulta/movimiento-banco', verificarFinanciero, async (req, res) => {
  const { desde, hasta } = req.query
  if (!desde || !hasta) return res.status(400).json({ error: 'Fechas requeridas' })

  const [{ data: saldoData }, { data: ingHist }, { data: egrHist }, { data: ingresos }, { data: egresos }] = await Promise.all([
    supabase.from('saldos_iniciales').select('saldo').eq('ciudad', req.ciudadFinanciero).eq('cuenta', 'banco').single(),
    supabase.from('ingresos').select('valor').eq('ciudad', req.ciudadFinanciero).eq('cuenta', 'banco').lt('fecha', desde),
    supabase.from('egresos').select('valor').eq('ciudad', req.ciudadFinanciero).eq('cuenta', 'banco').lt('fecha', desde),
    supabase.from('ingresos').select('*, providente:providente_id(nombre), punto:punto_servicio_id(nombre)')
      .eq('ciudad', req.ciudadFinanciero).eq('cuenta', 'banco').gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: true }),
    supabase.from('egresos').select('*, punto:punto_servicio_id(nombre)')
      .eq('ciudad', req.ciudadFinanciero).eq('cuenta', 'banco').gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: true }),
  ])

  const saldoAnterior = Number(saldoData?.saldo || 0)
    + (ingHist || []).reduce((s, r) => s + Number(r.valor), 0)
    - (egrHist || []).reduce((s, r) => s + Number(r.valor), 0)

  let saldo = saldoAnterior
  const movimientos = [
    ...(ingresos || []).map(r => ({ ...r, _tipo: 'ingreso' })),
    ...(egresos || []).map(r => ({ ...r, _tipo: 'egreso' })),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha)).map(r => {
    const esIngreso = r._tipo === 'ingreso'
    saldo += esIngreso ? Number(r.valor) : -Number(r.valor)
    return {
      id: r.id,
      fecha: r.fecha,
      comprobante: r.numero_recibo || '',
      benefactor: esIngreso ? (r.providente?.nombre || r.providente_otro || '') : '',
      servicio: r.punto?.nombre || r.punto_servicio_otro || '',
      concepto: r.concepto || '',
      ingreso: esIngreso ? Number(r.valor) : null,
      egreso: esIngreso ? null : Number(r.valor),
      saldo,
    }
  })

  res.json({ saldoAnterior, movimientos })
})

router.get('/api/financiero/consulta/busqueda-concepto', verificarFinanciero, async (req, res) => {
  const { desde, hasta, q } = req.query
  if (!desde || !hasta || !q) return res.status(400).json({ error: 'Parámetros requeridos' })

  const [{ data: ingresos }, { data: egresos }] = await Promise.all([
    supabase.from('ingresos').select('id, fecha, concepto, valor, cuenta, providente:providente_id(nombre), providente_otro')
      .eq('ciudad', req.ciudadFinanciero).gte('fecha', desde).lte('fecha', hasta)
      .ilike('concepto', `%${q}%`).order('fecha', { ascending: true }),
    supabase.from('egresos').select('id, fecha, concepto, valor, cuenta')
      .eq('ciudad', req.ciudadFinanciero).gte('fecha', desde).lte('fecha', hasta)
      .ilike('concepto', `%${q}%`).order('fecha', { ascending: true }),
  ])

  const resultado = [
    ...(ingresos || []).map(r => ({ ...r, _tipo: 'ingreso', benefactor: r.providente?.nombre || r.providente_otro || '' })),
    ...(egresos || []).map(r => ({ ...r, _tipo: 'egreso', benefactor: '' })),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha))

  res.json(resultado)
})

router.get('/api/financiero/consulta/donaciones-especie', verificarFinanciero, async (req, res) => {
  const { desde, hasta } = req.query
  if (!desde || !hasta) return res.status(400).json({ error: 'Fechas requeridas' })

  const { data, error } = await supabase.from('ingresos')
    .select('id, fecha, concepto, valor, providente:providente_id(nombre), providente_otro, punto:punto_servicio_id(nombre), punto_servicio_otro')
    .eq('ciudad', req.ciudadFinanciero)
    .eq('cuenta', 'especie')
    .gte('fecha', desde).lte('fecha', hasta)
    .order('fecha', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })
  res.json(data || [])
})

router.post('/api/financiero/enviar-recibo/:id', verificarFinanciero, async (req, res) => {
  try {
    const { data: ingreso } = await supabase.from('ingresos')
      .select('*, providente:providente_id(nombre, correo, numero_identificacion, telefono, direccion)')
      .eq('id', req.params.id).eq('ciudad', req.ciudadFinanciero).single()
    if (!ingreso) return res.status(404).json({ ok: false, mensaje: 'Ingreso no encontrado' })

    const correo = ingreso.providente?.correo
    if (!correo) return res.status(400).json({ ok: false, mensaje: 'El benefactor no tiene correo registrado' })

    const [{ data: cfg }, { data: user }, logo] = await Promise.all([
      supabase.from('config_ciudad').select('cuenta_bancaria').eq('ciudad', req.ciudadFinanciero).single(),
      supabase.from('registros').select('primer_nombre, primer_apellido, correo_electronico').eq('id', req.headers['x-miembro-id']).single(),
      getLogoBuffer(),
    ])
    const receptor = user ? `${user.primer_nombre} ${user.primer_apellido}` : ''
    const correoReceptor = user?.correo_electronico || null

    const pdfBuffer = await new Promise((resolve, reject) => {
      const chunks = []
      const doc = new PDFDocument({ size: 'LETTER', margin: 0 })
      doc.on('data', c => chunks.push(c))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)
      generarReciboPDF(doc, ingreso, cfg || {}, receptor, logo)
      doc.end()
    })

    const nombre = ingreso.providente?.nombre || ingreso.providente_otro || 'Benefactor'
    const numRecibo = ingreso.numero_recibo || ingreso.id.substring(0, 8)

    const emailPayload = {
      from: 'Servidores del Servidor <amgarcia@servidoresdelservidor.org>',
      to: correo,
      subject: `Recibo de donación No. ${numRecibo} — Gracias por tu generosidad`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="color: #1e3a5f; margin-bottom: 4px;">Asociación Privada de Fieles Laicos</h2>
            <p style="color: #666; font-size: 13px; margin: 0;">"Donum Christi — Comunidad Apostólica Servidores del Servidor"</p>
          </div>

          <p style="font-size: 15px;">Estimado/a <strong>${nombre}</strong>,</p>

          <p style="font-size: 15px; line-height: 1.6;">
            Con gratitud y alegría confirmamos la recepción de tu donación registrada con el recibo <strong>No. ${numRecibo}</strong>.
            Tu generosidad es un testimonio vivo del amor de Dios hacia los más necesitados y un pilar fundamental
            para nuestra misión.
          </p>

          <blockquote style="border-left: 4px solid #1e3a5f; margin: 24px 0; padding: 12px 20px; background: #f0f4f8; border-radius: 0 8px 8px 0;">
            <p style="font-style: italic; font-size: 15px; color: #1e3a5f; margin: 0 0 8px 0;">
              "El que da al pobre, presta a Dios — y Dios nunca queda en deuda con nadie."
            </p>
            <p style="font-size: 13px; color: #666; margin: 0;">— San Padre Pío de Pietrelcina</p>
          </blockquote>

          <p style="font-size: 15px; line-height: 1.6;">
            Adjunto encontrarás el recibo de tu donación. Que el Señor y nuestro querido Padre Pío te colmen de bendiciones.
          </p>

          <p style="font-size: 14px; color: #666; margin-top: 32px;">
            Con gratitud,<br>
            Área Financiera
          </p>
        </div>
      `,
      attachments: [{
        filename: `recibo_${numRecibo}.pdf`,
        content: pdfBuffer.toString('base64'),
      }],
    }
    if (correoReceptor) emailPayload.reply_to = correoReceptor
    await resend.emails.send(emailPayload)

    res.json({ ok: true, mensaje: `Recibo enviado a ${correo}` })
  } catch (err) {
    console.error('Error enviando recibo:', err)
    res.status(500).json({ ok: false, mensaje: err.message })
  }
})

router.get('/api/financiero/proximo-recibo', verificarFinanciero, async (req, res) => {
  const { data } = await supabase.from('ingresos')
    .select('numero_recibo')
    .eq('ciudad', req.ciudadFinanciero)
    .not('numero_recibo', 'is', null)
  const max = (data || []).reduce((m, r) => {
    const n = parseInt(r.numero_recibo)
    return isNaN(n) ? m : Math.max(m, n)
  }, 0)
  res.json({ proximo: max > 0 ? max + 1 : null })
})

// ── Reportes Excel ──
router.get('/api/financiero/reporte/aportes-consagrados', verificarFinanciero, async (req, res) => {
  const { mes, anio } = req.query
  if (!mes || !anio) return res.status(400).json({ error: 'Mes y año requeridos' })

  const desde = `${anio}-${mes.padStart(2,'0')}-01`
  const ultimoDia = new Date(Number(anio), Number(mes), 0).getDate()
  const hasta = `${anio}-${mes.padStart(2,'0')}-${String(ultimoDia).padStart(2,'0')}`
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const nombreMes = MESES[parseInt(mes) - 1]

  const { data } = await supabase.from('ingresos')
    .select('*, providente:providente_id(nombre)')
    .eq('ciudad', req.ciudadFinanciero)
    .eq('tipo', 'aporte_consagrado')
    .gte('fecha', desde).lte('fecha', hasta)
    .order('providente_id', { ascending: true })

  const registros = (data || []).sort((a, b) => {
    const na = a.providente?.nombre || a.providente_otro || ''
    const nb = b.providente?.nombre || b.providente_otro || ''
    return na.localeCompare(nb)
  })

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Aportes Consagrados')

  // Título
  ws.mergeCells('A1:E1')
  ws.getCell('A1').value = `RELACIÓN APORTES CONSAGRADOS — ${nombreMes.toUpperCase()} ${anio}`
  ws.getCell('A1').font = { bold: true, size: 13 }
  ws.getCell('A1').alignment = { horizontal: 'center' }
  ws.getRow(1).height = 22

  ws.mergeCells('A2:E2')
  ws.getCell('A2').value = `Ciudad: ${req.ciudadFinanciero}`
  ws.getCell('A2').font = { italic: true, size: 10 }
  ws.getCell('A2').alignment = { horizontal: 'center' }

  ws.addRow([])

  // Encabezados
  const hRow = ws.addRow(['#', 'Fecha', 'N° Recibo', 'Benefactor', 'Mes del aporte', 'Valor'])
  hRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }
    cell.alignment = { horizontal: 'center' }
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF000000' } } }
  })

  // Datos
  let total = 0
  registros.forEach((r, i) => {
    const nombre = r.providente?.nombre || r.providente_otro || '—'
    const row = ws.addRow([
      i + 1,
      r.fecha,
      r.numero_recibo || '',
      nombre,
      r.mes_aporte || '',
      Number(r.valor)
    ])
    row.getCell(6).numFmt = '$#,##0.00'
    row.getCell(6).alignment = { horizontal: 'right' }
    if (i % 2 === 1) {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7FA' } }
      })
    }
    total += Number(r.valor)
  })

  // Total
  ws.addRow([])
  const tRow = ws.addRow(['', '', '', '', 'TOTAL', total])
  tRow.getCell(5).font = { bold: true }
  tRow.getCell(5).alignment = { horizontal: 'right' }
  tRow.getCell(6).numFmt = '$#,##0.00'
  tRow.getCell(6).font = { bold: true }
  tRow.getCell(6).alignment = { horizontal: 'right' }

  // Anchos de columna
  ws.getColumn(1).width = 5
  ws.getColumn(2).width = 14
  ws.getColumn(3).width = 12
  ws.getColumn(4).width = 35
  ws.getColumn(5).width = 18
  ws.getColumn(6).width = 16

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="aportes_consagrados_${nombreMes}_${anio}.xlsx"`)
  await wb.xlsx.write(res)
  res.end()
})

router.get('/api/financiero/reporte/donaciones', verificarFinanciero, async (req, res) => {
  const { mes, anio } = req.query
  if (!mes || !anio) return res.status(400).json({ error: 'Mes y año requeridos' })

  const desde = `${anio}-${mes.padStart(2,'0')}-01`
  const ultimoDia = new Date(Number(anio), Number(mes), 0).getDate()
  const hasta = `${anio}-${mes.padStart(2,'0')}-${String(ultimoDia).padStart(2,'0')}`
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const nombreMes = MESES[parseInt(mes) - 1]

  const { data } = await supabase.from('ingresos')
    .select('*, providente:providente_id(nombre, telefono), punto:punto_servicio_id(nombre)')
    .eq('ciudad', req.ciudadFinanciero)
    .eq('tipo', 'donacion_servicio')
    .gte('fecha', desde).lte('fecha', hasta)
    .order('numero_recibo', { ascending: true })

  const registros = data || []
  const especie = registros.filter(r => r.forma_donacion === 'especie')
  const dinero  = registros.filter(r => r.forma_donacion !== 'especie')

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Donaciones')

  const HEADER_COLOR = 'FF1E3A5F'
  const HEADER_FONT  = { bold: true, color: { argb: 'FFFFFFFF' } }
  const COLS = ['Fecha', 'N° Comprobante', 'Valor', 'Servicio', 'Donante', 'Teléfono']
  const WIDTHS = [14, 16, 16, 28, 35, 16]

  // Título principal
  ws.mergeCells('A1:F1')
  ws.getCell('A1').value = `RELACIÓN DE DONACIONES — ${nombreMes.toUpperCase()} ${anio}`
  ws.getCell('A1').font = { bold: true, size: 13 }
  ws.getCell('A1').alignment = { horizontal: 'center' }
  ws.getRow(1).height = 22

  ws.mergeCells('A2:F2')
  ws.getCell('A2').value = `Ciudad: ${req.ciudadFinanciero}`
  ws.getCell('A2').font = { italic: true, size: 10 }
  ws.getCell('A2').alignment = { horizontal: 'center' }

  const addSeccion = (titulo, filas) => {
    ws.addRow([])
    const tRow = ws.addRow([titulo])
    ws.mergeCells(`A${tRow.number}:F${tRow.number}`)
    tRow.getCell(1).font = { bold: true, size: 11, color: { argb: 'FF1E3A5F' } }
    tRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } }
    tRow.height = 18

    const hRow = ws.addRow(COLS)
    hRow.eachCell(cell => {
      cell.font = HEADER_FONT
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_COLOR } }
      cell.alignment = { horizontal: 'center' }
    })

    let subtotal = 0
    filas.forEach((r, i) => {
      const servicio = r.punto?.nombre || r.punto_servicio_otro || '—'
      const donante  = r.providente?.nombre || r.providente_otro || '—'
      const telefono = r.providente?.telefono || ''
      const row = ws.addRow([r.fecha, r.numero_recibo || '', Number(r.valor), servicio, donante, telefono])
      row.getCell(3).numFmt = '$#,##0.00'
      row.getCell(3).alignment = { horizontal: 'right' }
      if (i % 2 === 1) row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7FA' } } })
      subtotal += Number(r.valor)
    })

    const stRow = ws.addRow(['', '', subtotal, `Subtotal ${titulo}`, '', ''])
    stRow.getCell(2).value = 'Subtotal'
    stRow.getCell(3).numFmt = '$#,##0.00'
    stRow.getCell(3).font = { bold: true }
    stRow.getCell(3).alignment = { horizontal: 'right' }
    stRow.getCell(4).font = { bold: true }
    return subtotal
  }

  const totEspecie = addSeccion('Donaciones en Especie', especie)
  const totDinero  = addSeccion('Donaciones en Dinero', dinero)

  ws.addRow([])
  const tRow = ws.addRow(['', '', totEspecie + totDinero, 'TOTAL GENERAL', '', ''])
  tRow.getCell(3).numFmt = '$#,##0.00'
  tRow.getCell(3).font = { bold: true, size: 11 }
  tRow.getCell(3).alignment = { horizontal: 'right' }
  tRow.getCell(4).font = { bold: true, size: 11 }

  WIDTHS.forEach((w, i) => { ws.getColumn(i + 1).width = w })

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="donaciones_${nombreMes}_${anio}.xlsx"`)
  await wb.xlsx.write(res)
  res.end()
})

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

router.get('/api/financiero/reporte/movimiento-banco', verificarFinanciero, async (req, res) => {
  const { mes, anio } = req.query
  if (!mes || !anio) return res.status(400).json({ error: 'Mes y año requeridos' })

  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const nombreMes = MESES[parseInt(mes) - 1]
  const desde = `${anio}-${mes.padStart(2,'0')}-01`
  const ultimoDia = new Date(Number(anio), Number(mes), 0).getDate()
  const hasta = `${anio}-${mes.padStart(2,'0')}-${String(ultimoDia).padStart(2,'0')}`

  const [{ data: saldoData }, { data: ingHist }, { data: egrHist }, { data: ingresos }, { data: egresos }] = await Promise.all([
    supabase.from('saldos_iniciales').select('saldo').eq('ciudad', req.ciudadFinanciero).eq('cuenta', 'banco').single(),
    supabase.from('ingresos').select('valor').eq('ciudad', req.ciudadFinanciero).eq('cuenta', 'banco').lt('fecha', desde),
    supabase.from('egresos').select('valor').eq('ciudad', req.ciudadFinanciero).eq('cuenta', 'banco').lt('fecha', desde),
    supabase.from('ingresos').select('*, providente:providente_id(nombre), punto:punto_servicio_id(nombre)')
      .eq('ciudad', req.ciudadFinanciero).eq('cuenta', 'banco').gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: true }),
    supabase.from('egresos').select('*, punto:punto_servicio_id(nombre)')
      .eq('ciudad', req.ciudadFinanciero).eq('cuenta', 'banco').gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: true }),
  ])

  const saldoInicial = Number(saldoData?.saldo || 0)
  let saldo = saldoInicial
    + (ingHist || []).reduce((s, r) => s + Number(r.valor), 0)
    - (egrHist || []).reduce((s, r) => s + Number(r.valor), 0)

  const movimientos = [
    ...(ingresos || []).map(r => ({ ...r, _tipo: 'ingreso' })),
    ...(egresos || []).map(r => ({ ...r, _tipo: 'egreso' })),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha))

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Movimiento Banco')

  ws.mergeCells('A1:H1')
  ws.getCell('A1').value = `MOVIMIENTO BANCO — ${nombreMes.toUpperCase()} ${anio}`
  ws.getCell('A1').font = { bold: true, size: 13 }
  ws.getCell('A1').alignment = { horizontal: 'center' }
  ws.getRow(1).height = 22

  ws.mergeCells('A2:H2')
  ws.getCell('A2').value = `Ciudad: ${req.ciudadFinanciero}`
  ws.getCell('A2').font = { italic: true, size: 10 }
  ws.getCell('A2').alignment = { horizontal: 'center' }
  ws.addRow([])

  const hRow = ws.addRow(['Fecha', 'N° Comprobante', 'Benefactor', 'Servicio', 'Concepto', 'Ingreso', 'Egreso', 'Saldo'])
  hRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }
    cell.alignment = { horizontal: 'center' }
  })

  const saRow = ws.addRow(['', '', '', '', 'Saldo anterior', '', '', saldo])
  saRow.getCell(5).font = { italic: true }
  saRow.getCell(8).numFmt = '$#,##0.00'
  saRow.getCell(8).font = { bold: true, italic: true }
  saRow.getCell(8).alignment = { horizontal: 'right' }

  movimientos.forEach((r, i) => {
    const esIngreso = r._tipo === 'ingreso'
    saldo += esIngreso ? Number(r.valor) : -Number(r.valor)
    const benefactor = esIngreso ? (r.providente?.nombre || r.providente_otro || '') : ''
    const servicio = r.punto?.nombre || r.punto_servicio_otro || ''
    const comprobante = r.numero_recibo || ''
    const row = ws.addRow([
      r.fecha, comprobante, benefactor, servicio, r.concepto || '',
      esIngreso ? Number(r.valor) : null,
      esIngreso ? null : Number(r.valor),
      saldo
    ])
    row.getCell(6).numFmt = '$#,##0.00'; row.getCell(6).alignment = { horizontal: 'right' }
    row.getCell(7).numFmt = '$#,##0.00'; row.getCell(7).alignment = { horizontal: 'right' }
    row.getCell(8).numFmt = '$#,##0.00'; row.getCell(8).alignment = { horizontal: 'right' }
    if (esIngreso) row.getCell(6).font = { color: { argb: 'FF1A7A3C' } }
    else row.getCell(7).font = { color: { argb: 'FFCC2200' } }
    if (i % 2 === 1) row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7FA' } } })
  })

  ws.addRow([])
  const tRow = ws.addRow(['', '', '', '', 'Saldo final', '', '', saldo])
  tRow.getCell(5).font = { bold: true }
  tRow.getCell(8).numFmt = '$#,##0.00'
  tRow.getCell(8).font = { bold: true }
  tRow.getCell(8).alignment = { horizontal: 'right' }

  ws.getColumn(1).width = 14; ws.getColumn(2).width = 16; ws.getColumn(3).width = 30
  ws.getColumn(4).width = 25; ws.getColumn(5).width = 30
  ws.getColumn(6).width = 16; ws.getColumn(7).width = 16; ws.getColumn(8).width = 16

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="movimiento_banco_${nombreMes}_${anio}.xlsx"`)
  await wb.xlsx.write(res)
  res.end()
})

router.get('/api/financiero/reporte/movimiento-caja-menor', verificarFinanciero, (req, res) =>
  generarReporteMovimiento(req, res, 'caja_menor', 'Movimiento Caja Menor', 'movimiento_caja_menor'))

router.get('/api/financiero/reporte/consumo-caja-menor', verificarFinanciero, async (req, res) => {
  const { mes, anio } = req.query
  if (!mes || !anio) return res.status(400).json({ error: 'Mes y año requeridos' })

  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const nombreMes = MESES[parseInt(mes) - 1]
  const desde = `${anio}-${mes.padStart(2,'0')}-01`
  const ultimoDia = new Date(Number(anio), Number(mes), 0).getDate()
  const hasta = `${anio}-${mes.padStart(2,'0')}-${String(ultimoDia).padStart(2,'0')}`

  const [{ data: saldoData }, { data: ingHist }, { data: egrHist }, { data: ingresos }, { data: egresos }] = await Promise.all([
    supabase.from('saldos_iniciales').select('saldo').eq('ciudad', req.ciudadFinanciero).eq('cuenta', 'consumo_caja_menor').single(),
    supabase.from('ingresos').select('valor').eq('ciudad', req.ciudadFinanciero).eq('cuenta', 'consumo_caja_menor').lt('fecha', desde),
    supabase.from('egresos').select('valor').eq('ciudad', req.ciudadFinanciero).eq('cuenta', 'consumo_caja_menor').lt('fecha', desde),
    supabase.from('ingresos').select('*').eq('ciudad', req.ciudadFinanciero).eq('cuenta', 'consumo_caja_menor').gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: true }),
    supabase.from('egresos').select('*, punto:punto_servicio_id(nombre)').eq('ciudad', req.ciudadFinanciero).eq('cuenta', 'consumo_caja_menor').gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: true }),
  ])

  const saldoInicial = Number(saldoData?.saldo || 0)
  let saldo = saldoInicial
    + (ingHist || []).reduce((s, r) => s + Number(r.valor), 0)
    - (egrHist || []).reduce((s, r) => s + Number(r.valor), 0)

  const movimientos = [
    ...(ingresos || []).map(r => ({ ...r, _tipo: 'ingreso' })),
    ...(egresos || []).map(r => ({ ...r, _tipo: 'egreso' })),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha))

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Consumo Caja Menor')

  ws.mergeCells('A1:F1')
  ws.getCell('A1').value = `CONSUMO CAJA MENOR — ${nombreMes.toUpperCase()} ${anio}`
  ws.getCell('A1').font = { bold: true, size: 13 }
  ws.getCell('A1').alignment = { horizontal: 'center' }
  ws.getRow(1).height = 22

  ws.mergeCells('A2:F2')
  ws.getCell('A2').value = `Ciudad: ${req.ciudadFinanciero}`
  ws.getCell('A2').font = { italic: true, size: 10 }
  ws.getCell('A2').alignment = { horizontal: 'center' }
  ws.addRow([])

  const hRow = ws.addRow(['Fecha', 'Servicio', 'Concepto', 'Ingreso', 'Egreso', 'Saldo'])
  hRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }
    cell.alignment = { horizontal: 'center' }
  })

  const saRow = ws.addRow(['', '', 'Saldo anterior', '', '', saldo])
  saRow.getCell(3).font = { italic: true }
  saRow.getCell(6).numFmt = '$#,##0.00'
  saRow.getCell(6).font = { bold: true, italic: true }
  saRow.getCell(6).alignment = { horizontal: 'right' }

  movimientos.forEach((r, i) => {
    const esIngreso = r._tipo === 'ingreso'
    saldo += esIngreso ? Number(r.valor) : -Number(r.valor)
    const servicio = esIngreso ? '' : (r.punto?.nombre || r.punto_servicio_otro || '')
    const row = ws.addRow([r.fecha, servicio, r.concepto || '', esIngreso ? Number(r.valor) : null, esIngreso ? null : Number(r.valor), saldo])
    row.getCell(4).numFmt = '$#,##0.00'; row.getCell(4).alignment = { horizontal: 'right' }
    row.getCell(5).numFmt = '$#,##0.00'; row.getCell(5).alignment = { horizontal: 'right' }
    row.getCell(6).numFmt = '$#,##0.00'; row.getCell(6).alignment = { horizontal: 'right' }
    if (esIngreso) row.getCell(4).font = { color: { argb: 'FF1A7A3C' } }
    else row.getCell(5).font = { color: { argb: 'FFCC2200' } }
    if (i % 2 === 1) row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7FA' } } })
  })

  ws.addRow([])
  const tRow = ws.addRow(['', '', 'Saldo final', '', '', saldo])
  tRow.getCell(3).font = { bold: true }
  tRow.getCell(6).numFmt = '$#,##0.00'
  tRow.getCell(6).font = { bold: true }
  tRow.getCell(6).alignment = { horizontal: 'right' }

  ws.getColumn(1).width = 14; ws.getColumn(2).width = 25; ws.getColumn(3).width = 35
  ws.getColumn(4).width = 16; ws.getColumn(5).width = 16; ws.getColumn(6).width = 16

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="consumo_caja_menor_${nombreMes}_${anio}.xlsx"`)
  await wb.xlsx.write(res)
  res.end()
})

// ── Saldo inicial por cuenta ──
router.get('/api/financiero/saldo-inicial', verificarFinanciero, async (req, res) => {
  const { cuenta } = req.query
  const { data } = await supabase.from('saldos_iniciales')
    .select('saldo').eq('ciudad', req.ciudadFinanciero).eq('cuenta', cuenta).single()
  res.json({ saldo: data?.saldo || 0 })
})

router.put('/api/financiero/saldo-inicial', verificarFinanciero, async (req, res) => {
  const { cuenta, saldo } = req.body
  const { error } = await supabase.from('saldos_iniciales')
    .upsert({ ciudad: req.ciudadFinanciero, cuenta, saldo }, { onConflict: 'ciudad,cuenta' })
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

router.get('/api/financiero/totales-cuenta', verificarFinanciero, async (req, res) => {
  const { cuenta, hasta } = req.query
  let ingQ = supabase.from('ingresos').select('valor').eq('ciudad', req.ciudadFinanciero).eq('cuenta', cuenta)
  let egrQ = supabase.from('egresos').select('valor').eq('ciudad', req.ciudadFinanciero).eq('cuenta', cuenta)
  if (hasta) { ingQ = ingQ.lt('fecha', hasta); egrQ = egrQ.lt('fecha', hasta) }
  const [{ data: ing }, { data: egr }] = await Promise.all([ingQ, egrQ])
  const totalIngresos = (ing || []).reduce((s, i) => s + Number(i.valor), 0)
  const totalEgresos = (egr || []).reduce((s, e) => s + Number(e.valor), 0)
  res.json({ totalIngresos, totalEgresos })
})

router.get('/api/financiero/equipo', verificarFinanciero, async (req, res) => {
  const { data } = await supabase.from('registros')
    .select('id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, numero_identificacion, roles')
    .ilike('ciudad_donde_sirve', req.ciudadFinanciero)
  const equipo = (data || []).filter(r => (r.roles || []).includes('responsable_financiero'))
  res.json(equipo)
})

router.get('/api/financiero/buscar-servidor', verificarFinanciero, async (req, res) => {
  const { q } = req.query
  if (!q) return res.json([])
  const { data } = await supabase.from('registros')
    .select('id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, numero_identificacion, roles')
    .ilike('ciudad_donde_sirve', req.ciudadFinanciero)
    .or(`primer_apellido.ilike.%${q}%,primer_nombre.ilike.%${q}%,numero_identificacion.ilike.%${q}%`)
    .limit(8)
  res.json(data || [])
})

router.put('/api/financiero/asignar-rol/:id', verificarFinanciero, async (req, res) => {
  const { data: reg } = await supabase.from('registros').select('roles').eq('id', req.params.id).single()
  const roles = reg?.roles || []
  if (roles.includes('responsable_financiero')) return res.json({ ok: true })
  const { error } = await supabase.from('registros').update({ roles: [...roles, 'responsable_financiero'] }).eq('id', req.params.id)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

router.put('/api/financiero/quitar-rol/:id', verificarFinanciero, async (req, res) => {
  const { data: reg } = await supabase.from('registros').select('roles').eq('id', req.params.id).single()
  const roles = (reg?.roles || []).filter(r => r !== 'responsable_financiero')
  const { error } = await supabase.from('registros').update({ roles }).eq('id', req.params.id)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

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

// ── Recibo PDF individual ──
router.get('/api/financiero/recibo/:id', verificarFinanciero, async (req, res) => {
  const { data: ing, error } = await supabase.from('ingresos')
    .select('*, providente:providente_id(nombre, numero_identificacion, telefono, direccion, correo)')
    .eq('id', req.params.id).eq('ciudad', req.ciudadFinanciero).single()
  if (error || !ing) return res.status(404).json({ error: 'Ingreso no encontrado' })

  const [{ data: cfg }, { data: user }, logo] = await Promise.all([
    supabase.from('config_ciudad').select('cuenta_bancaria').eq('ciudad', req.ciudadFinanciero).single(),
    supabase.from('registros').select('primer_nombre, primer_apellido').eq('id', req.headers['x-miembro-id']).single(),
    getLogoBuffer(),
  ])
  const receptor = user ? `${user.primer_nombre} ${user.primer_apellido}` : ''

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="recibo_${ing.numero_recibo || ing.id.substring(0,8)}.pdf"`)

  const doc = new PDFDocument({ size: 'LETTER', margin: 0 })
  doc.pipe(res)
  generarReciboPDF(doc, ing, cfg || {}, receptor, logo)
  doc.end()
})

// ── Recibos ZIP del mes ──
router.get('/api/financiero/reporte/recibos-mes', verificarFinanciero, async (req, res) => {
  try {
  const { mes, anio } = req.query
  if (!mes || !anio) return res.status(400).json({ error: 'Mes y año requeridos' })

  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const nombreMes = MESES[parseInt(mes)-1]
  const desde = `${anio}-${mes.padStart(2,'0')}-01`
  const ultimoDia = new Date(Number(anio), Number(mes), 0).getDate()
  const hasta = `${anio}-${mes.padStart(2,'0')}-${String(ultimoDia).padStart(2,'0')}`

  const [{ data: ingresos }, { data: cfg }, { data: user }, logo] = await Promise.all([
    supabase.from('ingresos').select('*, providente:providente_id(nombre, numero_identificacion, telefono, direccion, correo)')
      .eq('ciudad', req.ciudadFinanciero).gte('fecha', desde).lte('fecha', hasta).order('numero_recibo', { ascending: true }),
    supabase.from('config_ciudad').select('cuenta_bancaria').eq('ciudad', req.ciudadFinanciero).single(),
    supabase.from('registros').select('primer_nombre, primer_apellido').eq('id', req.headers['x-miembro-id']).single(),
    getLogoBuffer(),
  ])

  const receptor = user ? `${user.primer_nombre} ${user.primer_apellido}` : ''

  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition', `attachment; filename="recibos_${nombreMes}_${anio}.zip"`)

  const archive = archiver('zip', { zlib: { level: 6 } })
  archive.pipe(res)

  for (const ing of (ingresos || [])) {
    await new Promise((resolve) => {
      const chunks = []
      const doc = new PDFDocument({ size: 'LETTER', margin: 0 })
      doc.on('data', c => chunks.push(c))
      doc.on('end', () => {
        const buf = Buffer.concat(chunks)
        archive.append(buf, { name: `recibo_${ing.numero_recibo || ing.id.substring(0,8)}.pdf` })
        resolve()
      })
      generarReciboPDF(doc, ing, cfg || {}, receptor, logo)
      doc.end()
    })
  }

  archive.on('error', err => { console.error('ZIP error:', err); if (!res.headersSent) res.status(500).json({ error: err.message }) })
  archive.finalize()
  } catch (err) {
    console.error('Error ZIP recibos:', err)
    if (!res.headersSent) res.status(500).json({ error: err.message })
  }
})

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

router.get('/api/financiero/reporte/imagenes-banco', verificarFinanciero, async (req, res) => {
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
        .eq('ciudad', req.ciudadFinanciero).eq('cuenta', 'banco')
        .not('comprobante_url', 'is', null).neq('comprobante_url', '').gte('fecha', desde).lte('fecha', hasta).order('fecha'),
      supabase.from('egresos').select('id, fecha, concepto, valor, documento_url')
        .eq('ciudad', req.ciudadFinanciero).eq('cuenta', 'banco')
        .not('documento_url', 'is', null).neq('documento_url', '').gte('fecha', desde).lte('fecha', hasta).order('fecha'),
    ])

    const movimientos = [
      ...(ingresos || []).map(r => ({ ...r, _tipo: 'Ingreso', documento_url: r.comprobante_url })),
      ...(egresos || []).map(r => ({ ...r, _tipo: 'Egreso' })),
    ].sort((a, b) => a.fecha.localeCompare(b.fecha))

    console.log(`Imágenes banco ${nombreMes}/${anio}: ingresos=${(ingresos||[]).length} egresos=${(egresos||[]).length} con_img=${movimientos.length}`)
    if (movimientos.length === 0) return res.status(200).json({ sinImagenes: true, mensaje: 'Sin imágenes en este período' })

    const doc = new PDFDocument({ size: 'LETTER', margin: 40, autoFirstPage: false })
    const chunks = []
    doc.on('data', c => chunks.push(c))

    const pdfReady = new Promise((resolve, reject) => {
      doc.on('end', resolve)
      doc.on('error', reject)
    })

    for (const mov of movimientos) {
      doc.addPage()
      const W = doc.page.width - 80

      doc.fontSize(11).font('Helvetica-Bold')
        .text(`BANCO — ${nombreMes.toUpperCase()} ${anio}`, 40, 40, { width: W, align: 'center' })
      doc.moveTo(40, 58).lineTo(40 + W, 58).lineWidth(0.5).stroke()

      doc.fontSize(9).font('Helvetica-Bold').text('Tipo:', 40, 68).font('Helvetica').text(mov._tipo, 80, 68)
      doc.fontSize(9).font('Helvetica-Bold').text('Fecha:', 40, 82).font('Helvetica').text(mov.fecha, 85, 82)
      const valorFmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(Number(mov.valor))
      doc.fontSize(9).font('Helvetica-Bold').text('Valor:', 200, 82).font('Helvetica').text(valorFmt, 240, 82)
      if (mov.numero_recibo) { doc.fontSize(9).font('Helvetica-Bold').text('Recibo:', 350, 82).font('Helvetica').text(`#${mov.numero_recibo}`, 395, 82) }
      if (mov.concepto) { doc.fontSize(9).font('Helvetica-Bold').text('Concepto:', 40, 96).font('Helvetica').text(mov.concepto, 105, 96, { width: W - 65 }) }
      const nombreBenefactor = mov.providente?.nombre || mov.providente_otro || ''
      if (nombreBenefactor) { doc.fontSize(9).font('Helvetica-Bold').text('Benefactor:', 40, 110).font('Helvetica').text(nombreBenefactor, 108, 110, { width: W - 68 }) }

      doc.moveTo(40, 125).lineTo(40 + W, 125).lineWidth(0.5).stroke()

      const imgBuf = await descargarImagen(mov.documento_url)
      if (imgBuf) {
        const imgY = 133
        const maxH = doc.page.height - imgY - 40
        try {
          doc.image(imgBuf, 40, imgY, { width: W, height: maxH, fit: [W, maxH], align: 'center', valign: 'top' })
        } catch (e) {
          doc.fontSize(9).font('Helvetica').fillColor('gray').text('(Imagen no disponible)', 40, 133)
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
    res.setHeader('Content-Disposition', `attachment; filename="imagenes_banco_${nombreMes}_${anio}.pdf"`)
    res.setHeader('Content-Length', buf.length)
    res.send(buf)
  } catch (err) {
    console.error('Error PDF imágenes banco:', err)
    if (!res.headersSent) res.status(500).json({ error: err.message })
  }
})

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

router.get('/api/financiero/reporte/imagenes-caja-menor', verificarFinanciero, (req, res) =>
  generarPDFImagenesCuenta(req, res, 'caja_menor', 'CAJA MENOR', 'imagenes_caja_menor'))

router.get('/api/financiero/reporte/imagenes-consumo-caja-menor', verificarFinanciero, (req, res) =>
  generarPDFImagenesCuenta(req, res, 'consumo_caja_menor', 'CONSUMO CAJA MENOR', 'imagenes_consumo_caja_menor'))

router.get('/api/financiero/reporte/imagenes-especie', verificarFinanciero, (req, res) =>
  generarPDFImagenesCuenta(req, res, 'especie', 'DONACIONES EN ESPECIE', 'imagenes_especie'))

module.exports = router
