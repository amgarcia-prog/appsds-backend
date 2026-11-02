// Respuestas repetidas de los controladores

// Escritura sin datos de vuelta: { ok: true } o 500 con el mensaje de Supabase
function responderEscritura(res, { error }) {
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
}

// Escritura que devuelve la fila creada
function responderCreacion(res, { data, error }) {
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true, data })
}

module.exports = { responderEscritura, responderCreacion }
