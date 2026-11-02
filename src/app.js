const express = require('express')
const cors = require('cors')
const generalRoutes = require('./routes/generalRoutes')
const comunicacionesRoutes = require('./routes/comunicacionesRoutes')
const miCiudadRoutes = require('./routes/miCiudadRoutes')
const cioRoutes = require('./routes/cioRoutes')
const evaluacionRoutes = require('./routes/evaluacionRoutes')
const legado = require('./routes/legado')
const errorHandler = require('./middlewares/errorHandler')

const app = express()

app.use(cors())
app.use(express.json())

app.use(generalRoutes)
app.use(comunicacionesRoutes)
app.use(miCiudadRoutes)
app.use(cioRoutes)
app.use(evaluacionRoutes)
app.use(legado)

app.use(errorHandler)

module.exports = app
