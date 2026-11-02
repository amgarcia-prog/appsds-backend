const { crearModeloMovimientos } = require('./movimientosModel')

const { tabla, ...comunes } = crearModeloMovimientos('ingresos', 'comprobante_url')

// Aportes de consagrados en orden cronológico, opcionalmente de un benefactor y de un año
function aportesConsagrados(ciudad, providenteId, anio) {
  let consulta = tabla().select('*').eq('ciudad', ciudad).eq('tipo', 'aporte_consagrado').order('fecha', { ascending: true })
  if (providenteId) consulta = consulta.eq('providente_id', providenteId)
  if (anio) consulta = consulta.gte('fecha', `${anio}-01-01`).lte('fecha', `${anio}-12-31`)
  return consulta
}

const numerosDeRecibo = (ciudad) => tabla().select('numero_recibo').eq('ciudad', ciudad).not('numero_recibo', 'is', null)

const obtenerDeCiudad = (id, ciudad, columnas) => tabla().select(columnas).eq('id', id).eq('ciudad', ciudad).single()

const listarEnRango = (columnas, ciudad, desde, hasta, ordenarPor) => tabla().select(columnas)
  .eq('ciudad', ciudad).gte('fecha', desde).lte('fecha', hasta).order(ordenarPor, { ascending: true })

const listarDeTipoEnRango = (columnas, ciudad, tipo, desde, hasta, ordenarPor) => tabla().select(columnas)
  .eq('ciudad', ciudad).eq('tipo', tipo).gte('fecha', desde).lte('fecha', hasta).order(ordenarPor, { ascending: true })

module.exports = {
  ...comunes,
  aportesConsagrados,
  numerosDeRecibo,
  obtenerDeCiudad,
  listarEnRango,
  listarDeTipoEnRango,
}
