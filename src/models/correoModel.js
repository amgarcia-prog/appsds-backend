const resend = require('../config/resend')

// Envío por Resend. Devuelve { data, error } o lanza si falla la conexión.
const enviar = (correo) => resend.emails.send(correo)

module.exports = { enviar }
