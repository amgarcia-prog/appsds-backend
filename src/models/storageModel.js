const supabase = require('../config/supabase')

const subir = (bucket, ruta, contenido, opciones) => supabase.storage.from(bucket).upload(ruta, contenido, opciones)
const urlPublica = (bucket, ruta) => supabase.storage.from(bucket).getPublicUrl(ruta).data.publicUrl
const eliminar = (bucket, ruta) => supabase.storage.from(bucket).remove([ruta])

module.exports = { subir, urlPublica, eliminar }
