const { createClient } = require('@supabase/supabase-js')

// Cliente con la clave de service role: ignora RLS. Solo lo usan los modelos.
module.exports = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY)
