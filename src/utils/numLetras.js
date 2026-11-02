const UNIDADES = ['','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez','once','doce','trece','catorce','quince','dieciséis','diecisiete','dieciocho','diecinueve']
const DECENAS  = ['','','veinte','treinta','cuarenta','cincuenta','sesenta','setenta','ochenta','noventa']
const CENTENAS = ['','ciento','doscientos','trescientos','cuatrocientos','quinientos','seiscientos','setecientos','ochocientos','novecientos']

// Número entero a palabras en español (para la suma en letras de los recibos)
function numLetras(n) {
  n = Math.round(n)
  if (n === 0) return 'cero'
  if (n === 100) return 'cien'
  if (n < 20) return UNIDADES[n]
  if (n < 100) return DECENAS[Math.floor(n/10)] + (n%10 ? ' y ' + UNIDADES[n%10] : '')
  if (n < 1000) return CENTENAS[Math.floor(n/100)] + (n%100 ? ' ' + numLetras(n%100) : '')
  if (n < 2000) return 'mil' + (n%1000 ? ' ' + numLetras(n%1000) : '')
  if (n < 1000000) return numLetras(Math.floor(n/1000)) + ' mil' + (n%1000 ? ' ' + numLetras(n%1000) : '')
  if (n < 2000000) return 'un millón' + (n%1000000 ? ' ' + numLetras(n%1000000) : '')
  return numLetras(Math.floor(n/1000000)) + ' millones' + (n%1000000 ? ' ' + numLetras(n%1000000) : '')
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1) }

module.exports = { numLetras, capitalize }
