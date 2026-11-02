// Consultas comunes a ingresos y egresos. Todas se limitan a la ciudad del responsable financiero.
const supabase = require('../config/supabase')

// campoSoporte: columna con la URL de la imagen (comprobante_url en ingresos, documento_url en egresos)
function crearModeloMovimientos(nombreTabla, campoSoporte) {
  const tabla = () => supabase.from(nombreTabla)

  return {
    tabla,

    // Más recientes primero; con rango, solo los de ese periodo
    listar(columnas, ciudad, rango) {
      let consulta = tabla().select(columnas).eq('ciudad', ciudad).order('fecha', { ascending: false })
      if (rango) consulta = consulta.gte('fecha', rango.desde).lte('fecha', rango.hasta)
      return consulta
    },

    insertar: (datos) => tabla().insert(datos).select().single(),
    actualizar: (id, ciudad, datos) => tabla().update(datos).eq('id', id).eq('ciudad', ciudad),
    eliminar: (id, ciudad) => tabla().delete().eq('id', id).eq('ciudad', ciudad),

    // Solo los valores de una cuenta; con antesDe, los anteriores a esa fecha
    valores(ciudad, cuenta, antesDe) {
      const consulta = tabla().select('valor').eq('ciudad', ciudad).eq('cuenta', cuenta)
      return antesDe ? consulta.lt('fecha', antesDe) : consulta
    },

    movimientosDeCuenta: (columnas, ciudad, cuenta, desde, hasta) => tabla().select(columnas)
      .eq('ciudad', ciudad).eq('cuenta', cuenta).gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: true }),

    buscarPorConcepto: (columnas, ciudad, desde, hasta, q) => tabla().select(columnas)
      .eq('ciudad', ciudad).gte('fecha', desde).lte('fecha', hasta)
      .ilike('concepto', `%${q}%`).order('fecha', { ascending: true }),

    // Movimientos de la cuenta que tienen imagen de soporte
    conSoporteEnRango: (columnas, ciudad, cuenta, desde, hasta) => tabla().select(columnas)
      .eq('ciudad', ciudad).eq('cuenta', cuenta)
      .not(campoSoporte, 'is', null).neq(campoSoporte, '').gte('fecha', desde).lte('fecha', hasta).order('fecha'),
  }
}

module.exports = { crearModeloMovimientos }
