const registrosModel = require('../models/registrosModel')

// Agrega una entrada al historial_proceso. Debe llamarse en cada cambio de estado_proceso.
async function agregarHistorial(id, estadoAnterior, estadoNuevo, cambiado_por, notas = '') {
  const { data: reg } = await registrosModel.obtenerPorId(id, 'historial_proceso')
  const historial = reg?.historial_proceso || []
  historial.push({
    fecha: new Date().toISOString(),
    estado_anterior: estadoAnterior,
    estado_nuevo: estadoNuevo,
    cambiado_por,
    notas,
  })
  await registrosModel.actualizar(id, { historial_proceso: historial })
}

// Nombre de quien hace el cambio, o su id si no se encuentra
async function nombreResponsable(id) {
  const { data: responsable } = await registrosModel.obtenerPorId(id, 'primer_nombre, primer_apellido')
  return responsable ? `${responsable.primer_nombre} ${responsable.primer_apellido}` : `ID ${id}`
}

module.exports = { agregarHistorial, nombreResponsable }
