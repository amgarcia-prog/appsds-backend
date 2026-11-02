const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

// Primer y último día (AAAA-MM-DD) de un mes y su nombre. mes llega como texto de la query ('3' o '03').
function rangoMes(mes, anio) {
  const desde = `${anio}-${mes.padStart(2,'0')}-01`
  const ultimoDia = new Date(Number(anio), Number(mes), 0).getDate()
  const hasta = `${anio}-${mes.padStart(2,'0')}-${String(ultimoDia).padStart(2,'0')}`
  return { desde, hasta, nombreMes: MESES[parseInt(mes) - 1] }
}

module.exports = { MESES, rangoMes }
