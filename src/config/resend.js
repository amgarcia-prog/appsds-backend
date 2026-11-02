const { Resend } = require('resend')

module.exports = new Resend(process.env.RESEND_API_KEY)
