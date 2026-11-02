// Punto de entrada: carga .env antes que cualquier módulo que lea process.env
require('dotenv').config()
const app = require('./src/app')
const { PORT } = require('./src/config/env')

app.listen(PORT, () => {
  console.log(`🚀 Backend corriendo en http://localhost:${PORT}`)
})
