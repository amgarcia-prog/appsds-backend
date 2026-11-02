// Tablas del módulo CIO (clientes, proyectos y su facturación y tiempos)
const supabase = require('../config/supabase')

// Escrituras comunes: crear devuelve la fila creada
function escrituras(nombreTabla) {
  const tabla = () => supabase.from(nombreTabla)
  return {
    crear: (datos) => tabla().insert(datos).select().single(),
    actualizar: (id, datos) => tabla().update(datos).eq('id', id),
    eliminar: (id) => tabla().delete().eq('id', id),
  }
}

const clientes = {
  ...escrituras('cio_clientes'),
  listar: () => supabase.from('cio_clientes').select('*').order('nombre'),
}

const proyectos = {
  ...escrituras('cio_proyectos'),
  listarPorCliente: (clienteId) => supabase.from('cio_proyectos')
    .select('*, cio_items_facturacion(*), cio_productos(*), cio_registros_tiempo(*)')
    .eq('cliente_id', clienteId)
    .order('created_at', { ascending: false }),
}

module.exports = {
  clientes,
  proyectos,
  productos: escrituras('cio_productos'),
  items: escrituras('cio_items_facturacion'),
  tiempos: escrituras('cio_registros_tiempo'),
}
