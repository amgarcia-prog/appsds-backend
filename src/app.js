const express = require('express')
const cors = require('cors')
const errorHandler = require('./middlewares/errorHandler')

// Cada router declara sus rutas completas (/api/...); ninguna ruta se solapa entre módulos
const routers = [
  require('./routes/authRoutes'),
  require('./routes/miembroRoutes'),
  require('./routes/formacionRoutes'),
  require('./routes/consejoRoutes'),
  require('./routes/obrasRoutes'),
  require('./routes/pilarRoutes'),
  require('./routes/adminRoutes'),
  require('./routes/comunicacionesRoutes'),
  require('./routes/miCiudadRoutes'),
  require('./routes/financieroRoutes'),
  require('./routes/cioRoutes'),
  require('./routes/evaluacionRoutes'),
  require('./routes/generalRoutes'),
]

const app = express()

app.use(cors())
app.use(express.json())

for (const router of routers) app.use(router)

app.use(errorHandler)

module.exports = app
