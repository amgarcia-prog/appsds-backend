// Reportes mensuales en Excel. Cada función arma el libro; el controlador lo escribe en la respuesta.
const ExcelJS = require('exceljs')

const FORMATO_MONEDA = '$#,##0.00'
const AZUL = 'FF1E3A5F'
const relleno = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })
const RELLENO_CEBRA = relleno('FFF5F7FA')
const VERDE = { color: { argb: 'FF1A7A3C' } }
const ROJO = { color: { argb: 'FFCC2200' } }
const DERECHA = { horizontal: 'right' }

const letraColumna = (n) => String.fromCharCode(64 + n)

// Título (fila 1) y ciudad (fila 2), combinados hasta la última columna
function encabezadoReporte(ws, ultimaColumna, titulo, ciudad) {
  ws.mergeCells(`A1:${ultimaColumna}1`)
  ws.getCell('A1').value = titulo
  ws.getCell('A1').font = { bold: true, size: 13 }
  ws.getCell('A1').alignment = { horizontal: 'center' }
  ws.getRow(1).height = 22

  ws.mergeCells(`A2:${ultimaColumna}2`)
  ws.getCell('A2').value = `Ciudad: ${ciudad}`
  ws.getCell('A2').font = { italic: true, size: 10 }
  ws.getCell('A2').alignment = { horizontal: 'center' }
}

function filaEncabezados(ws, columnas, { conBorde = false } = {}) {
  const fila = ws.addRow(columnas)
  fila.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = relleno(AZUL)
    cell.alignment = { horizontal: 'center' }
    if (conBorde) cell.border = { bottom: { style: 'thin', color: { argb: 'FF000000' } } }
  })
  return fila
}

function moneda(celda, font) {
  celda.numFmt = FORMATO_MONEDA
  if (font) celda.font = font
  celda.alignment = DERECHA
}

const tituloMensual = (titulo, nombreMes, anio) => `${titulo} — ${nombreMes.toUpperCase()} ${anio}`

// Aportes de consagrados del mes, ordenados por benefactor, con total
function aportesConsagrados({ registros, nombreMes, anio, ciudad }) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Aportes Consagrados')

  encabezadoReporte(ws, 'E', tituloMensual('RELACIÓN APORTES CONSAGRADOS', nombreMes, anio), ciudad)
  ws.addRow([])
  filaEncabezados(ws, ['#', 'Fecha', 'N° Recibo', 'Benefactor', 'Mes del aporte', 'Valor'], { conBorde: true })

  let total = 0
  registros.forEach((r, i) => {
    const nombre = r.providente?.nombre || r.providente_otro || '—'
    const row = ws.addRow([i + 1, r.fecha, r.numero_recibo || '', nombre, r.mes_aporte || '', Number(r.valor)])
    row.getCell(6).numFmt = FORMATO_MONEDA
    row.getCell(6).alignment = DERECHA
    if (i % 2 === 1) row.eachCell(cell => { cell.fill = RELLENO_CEBRA })
    total += Number(r.valor)
  })

  ws.addRow([])
  const tRow = ws.addRow(['', '', '', '', 'TOTAL', total])
  tRow.getCell(5).font = { bold: true }
  tRow.getCell(5).alignment = DERECHA
  moneda(tRow.getCell(6), { bold: true })

  ;[5, 14, 12, 35, 18, 16].forEach((ancho, i) => { ws.getColumn(i + 1).width = ancho })
  return wb
}

// Donaciones del mes en dos secciones (especie y dinero) con subtotales y total general
function donaciones({ especie, dinero, nombreMes, anio, ciudad }) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Donaciones')
  const COLS = ['Fecha', 'N° Comprobante', 'Valor', 'Servicio', 'Donante', 'Teléfono']

  encabezadoReporte(ws, 'F', tituloMensual('RELACIÓN DE DONACIONES', nombreMes, anio), ciudad)

  const addSeccion = (titulo, filas) => {
    ws.addRow([])
    const tRow = ws.addRow([titulo])
    ws.mergeCells(`A${tRow.number}:F${tRow.number}`)
    tRow.getCell(1).font = { bold: true, size: 11, color: { argb: AZUL } }
    tRow.getCell(1).fill = relleno('FFE8EEF7')
    tRow.height = 18

    filaEncabezados(ws, COLS)

    let subtotal = 0
    filas.forEach((r, i) => {
      const servicio = r.punto?.nombre || r.punto_servicio_otro || '—'
      const donante  = r.providente?.nombre || r.providente_otro || '—'
      const telefono = r.providente?.telefono || ''
      const row = ws.addRow([r.fecha, r.numero_recibo || '', Number(r.valor), servicio, donante, telefono])
      row.getCell(3).numFmt = FORMATO_MONEDA
      row.getCell(3).alignment = DERECHA
      if (i % 2 === 1) row.eachCell(c => { c.fill = RELLENO_CEBRA })
      subtotal += Number(r.valor)
    })

    const stRow = ws.addRow(['', '', subtotal, `Subtotal ${titulo}`, '', ''])
    stRow.getCell(2).value = 'Subtotal'
    moneda(stRow.getCell(3), { bold: true })
    stRow.getCell(4).font = { bold: true }
    return subtotal
  }

  const totEspecie = addSeccion('Donaciones en Especie', especie)
  const totDinero  = addSeccion('Donaciones en Dinero', dinero)

  ws.addRow([])
  const tRow = ws.addRow(['', '', totEspecie + totDinero, 'TOTAL GENERAL', '', ''])
  moneda(tRow.getCell(3), { bold: true, size: 11 })
  tRow.getCell(4).font = { bold: true, size: 11 }

  ;[14, 16, 16, 28, 35, 16].forEach((ancho, i) => { ws.getColumn(i + 1).width = ancho })
  return wb
}

// Movimiento de una cuenta con saldo corrido. columnas: las descriptivas de cada fila,
// { titulo, ancho, valor(r, esIngreso) }; la última es el concepto. Después van Ingreso, Egreso y Saldo.
function movimientoDeCuenta({ hoja, columnas, saldoAnterior, movimientos, nombreMes, anio, ciudad }) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(hoja)

  const colConcepto = columnas.length
  const [colIngreso, colEgreso, colSaldo] = [colConcepto + 1, colConcepto + 2, colConcepto + 3]
  const etiqueta = (texto) => [...Array(colConcepto - 1).fill(''), texto, '', '']

  encabezadoReporte(ws, letraColumna(colSaldo), tituloMensual(hoja.toUpperCase(), nombreMes, anio), ciudad)
  ws.addRow([])
  filaEncabezados(ws, [...columnas.map(c => c.titulo), 'Ingreso', 'Egreso', 'Saldo'])

  let saldo = saldoAnterior
  const saRow = ws.addRow([...etiqueta('Saldo anterior'), saldo])
  saRow.getCell(colConcepto).font = { italic: true }
  moneda(saRow.getCell(colSaldo), { bold: true, italic: true })

  movimientos.forEach((r, i) => {
    const esIngreso = r._tipo === 'ingreso'
    saldo += esIngreso ? Number(r.valor) : -Number(r.valor)
    const row = ws.addRow([
      ...columnas.map(c => c.valor(r, esIngreso)),
      esIngreso ? Number(r.valor) : null,
      esIngreso ? null : Number(r.valor),
      saldo,
    ])
    for (const col of [colIngreso, colEgreso, colSaldo]) moneda(row.getCell(col))
    if (esIngreso) row.getCell(colIngreso).font = VERDE
    else row.getCell(colEgreso).font = ROJO
    if (i % 2 === 1) row.eachCell(c => { c.fill = RELLENO_CEBRA })
  })

  ws.addRow([])
  const tRow = ws.addRow([...etiqueta('Saldo final'), saldo])
  tRow.getCell(colConcepto).font = { bold: true }
  moneda(tRow.getCell(colSaldo), { bold: true })

  ;[...columnas.map(c => c.ancho), 16, 16, 16].forEach((ancho, i) => { ws.getColumn(i + 1).width = ancho })
  return wb
}

// Columnas descriptivas de cada reporte de movimiento
const fecha = { titulo: 'Fecha', ancho: 14, valor: (r) => r.fecha }
const concepto = (ancho) => ({ titulo: 'Concepto', ancho, valor: (r) => r.concepto || '' })
const servicioDe = (r) => r.punto?.nombre || r.punto_servicio_otro || ''

const COLUMNAS_MOVIMIENTO = {
  banco: [
    fecha,
    { titulo: 'N° Comprobante', ancho: 16, valor: (r) => r.numero_recibo || '' },
    { titulo: 'Benefactor', ancho: 30, valor: (r, esIngreso) => (esIngreso ? (r.providente?.nombre || r.providente_otro || '') : '') },
    { titulo: 'Servicio', ancho: 25, valor: servicioDe },
    concepto(30),
  ],
  cajaMenor: [fecha, concepto(40)],
  consumoCajaMenor: [
    fecha,
    { titulo: 'Servicio', ancho: 25, valor: (r, esIngreso) => (esIngreso ? '' : servicioDe(r)) },
    concepto(35),
  ],
}

module.exports = { aportesConsagrados, donaciones, movimientoDeCuenta, COLUMNAS_MOVIMIENTO }
