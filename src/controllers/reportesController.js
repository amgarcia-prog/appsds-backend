// Reportes mensuales del área financiera. Todos reciben mes y anio en la query.
const reportesService = require('../services/reportesService')
const excel = require('../views/reportes/excel')
const { pdfDeImagenes } = require('../views/reportes/imagenes')
const { rangoMes } = require('../utils/fechas')

// Rango del mes pedido, o null si ya respondió 400
function mesPedido(req, res) {
  const { mes, anio } = req.query
  if (!mes || !anio) {
    res.status(400).json({ error: 'Mes y año requeridos' })
    return null
  }
  return { ...rangoMes(mes, anio), anio }
}

async function enviarExcel(res, libro, nombreArchivo) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}.xlsx"`)
  await libro.xlsx.write(res)
  res.end()
}

async function aportesConsagrados(req, res) {
  const periodo = mesPedido(req, res)
  if (!periodo) return
  const { desde, hasta, nombreMes, anio } = periodo
  const registros = await reportesService.aportesConsagrados(req.ciudadFinanciero, desde, hasta)
  const libro = excel.aportesConsagrados({ registros, nombreMes, anio, ciudad: req.ciudadFinanciero })
  await enviarExcel(res, libro, `aportes_consagrados_${nombreMes}_${anio}`)
}

async function donaciones(req, res) {
  const periodo = mesPedido(req, res)
  if (!periodo) return
  const { desde, hasta, nombreMes, anio } = periodo
  const { especie, dinero } = await reportesService.donaciones(req.ciudadFinanciero, desde, hasta)
  const libro = excel.donaciones({ especie, dinero, nombreMes, anio, ciudad: req.ciudadFinanciero })
  await enviarExcel(res, libro, `donaciones_${nombreMes}_${anio}`)
}

// Reporte de movimiento con saldo corrido de una cuenta
const movimiento = ({ cuenta, hoja, columnas, archivo }) => async (req, res) => {
  const periodo = mesPedido(req, res)
  if (!periodo) return
  const { desde, hasta, nombreMes, anio } = periodo
  const { saldoAnterior, movimientos } = await reportesService.movimientoDeCuenta(req.ciudadFinanciero, cuenta, desde, hasta)
  const libro = excel.movimientoDeCuenta({ hoja, columnas, saldoAnterior, movimientos, nombreMes, anio, ciudad: req.ciudadFinanciero })
  await enviarExcel(res, libro, `${archivo}_${nombreMes}_${anio}`)
}

// PDF con las imágenes de los comprobantes de una cuenta
const imagenes = ({ cuenta, titulo, archivo }) => async (req, res) => {
  try {
    const periodo = mesPedido(req, res)
    if (!periodo) return
    const { desde, hasta, nombreMes, anio } = periodo
    const { movimientos, imagenes: descargadas } = await reportesService.imagenesDeCuenta(req.ciudadFinanciero, cuenta, desde, hasta)
    if (movimientos.length === 0) return res.status(200).json({ sinImagenes: true, mensaje: 'Sin imágenes en este período' })

    const pdf = await pdfDeImagenes({
      movimientos,
      imagenes: descargadas,
      titulo: `${titulo} — ${nombreMes.toUpperCase()} ${anio}`,
      esBanco: cuenta === 'banco',
    })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${archivo}_${nombreMes}_${anio}.pdf"`)
    res.setHeader('Content-Length', pdf.length)
    res.send(pdf)
  } catch (err) {
    console.error(`Error PDF imágenes ${cuenta}:`, err)
    if (!res.headersSent) res.status(500).json({ error: err.message })
  }
}

module.exports = {
  aportesConsagrados,
  donaciones,
  movimientoBanco: movimiento({ cuenta: 'banco', hoja: 'Movimiento Banco', columnas: excel.COLUMNAS_MOVIMIENTO.banco, archivo: 'movimiento_banco' }),
  movimientoCajaMenor: movimiento({ cuenta: 'caja_menor', hoja: 'Movimiento Caja Menor', columnas: excel.COLUMNAS_MOVIMIENTO.cajaMenor, archivo: 'movimiento_caja_menor' }),
  consumoCajaMenor: movimiento({ cuenta: 'consumo_caja_menor', hoja: 'Consumo Caja Menor', columnas: excel.COLUMNAS_MOVIMIENTO.consumoCajaMenor, archivo: 'consumo_caja_menor' }),
  imagenesBanco: imagenes({ cuenta: 'banco', titulo: 'BANCO', archivo: 'imagenes_banco' }),
  imagenesCajaMenor: imagenes({ cuenta: 'caja_menor', titulo: 'CAJA MENOR', archivo: 'imagenes_caja_menor' }),
  imagenesConsumoCajaMenor: imagenes({ cuenta: 'consumo_caja_menor', titulo: 'CONSUMO CAJA MENOR', archivo: 'imagenes_consumo_caja_menor' }),
  imagenesEspecie: imagenes({ cuenta: 'especie', titulo: 'DONACIONES EN ESPECIE', archivo: 'imagenes_especie' }),
}
