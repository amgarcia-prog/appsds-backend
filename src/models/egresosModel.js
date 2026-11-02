const { crearModeloMovimientos } = require('./movimientosModel')

const { tabla, ...comunes } = crearModeloMovimientos('egresos', 'documento_url')

module.exports = comunes
