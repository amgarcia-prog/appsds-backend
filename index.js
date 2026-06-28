require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { Resend } = require('resend')
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const multer = require('multer')
const app = express()
const resend = new Resend(process.env.RESEND_API_KEY)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY)

app.use(cors())
app.use(express.json())

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

app.get('/api/verificar-cedula', async (req, res) => {
  const { numero } = req.query
  if (!numero) return res.json({ existe: false })
  const { data } = await supabase.from('registros').select('id').eq('numero_identificacion', numero).single()
  res.json({ existe: !!data })
})

app.post('/api/registro', async (req, res) => {
  const datos = req.body
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress

  const nombreCompleto = [datos.primerNombre, datos.segundoNombre, datos.primerApellido, datos.segundoApellido]
    .filter(Boolean).join(' ')

  // Verificar si ya existe el número de identificación
  const { data: existente } = await supabase
    .from('registros')
    .select('id')
    .eq('numero_identificacion', datos.numeroIdentificacion)
    .single()

  if (existente) {
    return res.status(400).json({ ok: false, mensaje: 'Ya existe un registro con este número de identificación.' })
  }

  // Guardar en Supabase
  const { error: dbError } = await supabase.from('registros').insert({
    acepta_datos: datos.aceptaDatos,
    timestamp_acepta_datos: datos.timestampAceptaDatos || null,
    version_politica: datos.versionPolitica || null,
    hash_politica: datos.hashPolitica || null,
    fecha_nacimiento: datos.fechaNacimiento || null,
    tipo_identificacion: datos.tipoIdentificacion,
    numero_identificacion: datos.numeroIdentificacion,
    sexo: datos.sexo,
    primer_nombre: datos.primerNombre,
    segundo_nombre: datos.segundoNombre,
    primer_apellido: datos.primerApellido,
    segundo_apellido: datos.segundoApellido,
    estado_civil: datos.estadoCivil,
    telefono_movil: datos.telefonoMovil,
    telefono_fijo: datos.telefonoFijo,
    otro_telefono: datos.otroTelefono,
    correo_electronico: datos.correoElectronico,
    pais_residencia: datos.paisResidencia,
    departamento_servicio: datos.departamentoServicio,
    ciudad_servicio: datos.ciudadServicio,
    direccion_residencia: datos.direccionResidencia,
    nivel_academico: datos.nivelAcademico,
    profesion: datos.profesion,
    ocupacion: datos.ocupacion,
    tipo_sangre: datos.tipoSangre,
    eps_servicio: datos.epsServicio,
    indicaciones_medicas: datos.indicacionesMedicas,
    como_llego_comunidad: datos.comoLlegoComunitad,
    pais_servicio: datos.paisServicio,
    departamento_ciudad_servicio: datos.departamentoDondeSirve,
    ciudad_donde_sirve: datos.ciudadDondeSirve,
    puntos_servicio: datos.puntosServicio,
    es_coordinador: datos.esCoordinador,
    puntos_coordina: datos.puntosCoordina,
    pertenece_consejo: datos.perteneceConsejo,
    fecha_inicio_consejo: datos.fechaInicioConsejo || null,
    responsabilidades_consejo: datos.responsabilidadesConsejo,
    estado_consagracion: datos.estadoConsagracion,
    fecha_inicio_servicio: datos.fechaInicioServicio || null,
    motivacion_paciente: datos.porQueConsagrarse,
    fecha_consagracion_paciente: datos.fechaConsagracion || null,
    fecha_inicio_encargo: datos.fechaInicioEncargo || null,
    pertenece_otra_comunidad: datos.perteneceOtraComunidad,
    responsabilidades_pilar: datos.responsabilidadesPilar,
    acepta_contrato: datos.aceptaContrato,
    timestamp_contrato: datos.timestampContrato || new Date().toISOString(),
    version_contrato: datos.versionContrato || 'v1.0-2026',
    hash_contrato: datos.hashContrato || null,
    ip_registro: ip,
    foto_url: datos.fotoUrl || null,
    clave: datos.clave || null,
    estado_proceso: (() => {
      if (datos.estadoConsagracion === 'paciente') return 'consagrado_paciente'
      if (datos.estadoConsagracion === 'servita') return 'consagrado_servita'
      if (datos.estadoConsagracion === 'pilar') return 'consagrado_pilar'
      if (datos.estadoConsagracion === 'laborioso_no_consagrar') return 'laborioso_no_consagrar'
      return 'pendiente_formacion'
    })(),
    fecha_estado: new Date().toISOString(),
  })

  if (dbError) {
    console.error('❌ Error guardando en base de datos:', dbError)
    return res.status(500).json({ ok: false, mensaje: 'Error al guardar el registro.' })
  }

  console.log(`✅ Registro guardado: ${nombreCompleto}`)

  // Enviar correo
  const codigoPath = path.join(__dirname, 'pdfs', 'codigoconducta.pdf')
  const manualPath = path.join(__dirname, 'pdfs', 'manualbuentrato.pdf')
  const adjuntos = []

  if (fs.existsSync(codigoPath)) {
    adjuntos.push({ filename: 'Codigo_de_Conducta_SDS.pdf', content: fs.readFileSync(codigoPath).toString('base64') })
  }
  if (fs.existsSync(manualPath)) {
    adjuntos.push({ filename: 'Manual_del_Buen_Trato_SDS.pdf', content: fs.readFileSync(manualPath).toString('base64') })
  }

  try {
    await resend.emails.send({
      from: 'Servidores del Servidor <amgarcia@servidoresdelservidor.org>',
      to: [datos.correoElectronico],
      bcc: [process.env.CORREO_INSTITUCIONAL],
      subject: '¡Bienvenido(a) a Servidores del Servidor! - Documentos de ingreso',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #1e40af; padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 20px;">Servidores del Servidor</h1>
            <p style="color: #bfdbfe; margin: 4px 0 0; font-size: 14px;">Donum Christi Comunidad Apostólica</p>
          </div>
          <div style="padding: 32px 24px;">
            <p style="font-size: 16px; color: #1f2937;">Servido sea Jesucristo,</p>
            <p style="font-size: 16px; color: #1f2937;">Estimado(a) <strong>${nombreCompleto}</strong>,</p>
            <p style="color: #4b5563;">Hemos recibido tu registro en la comunidad. Adjunto encontrarás los documentos importantes para tu proceso de ingreso.</p>
            <div style="background-color: #eff6ff; border-left: 4px solid #1e40af; padding: 16px; margin: 24px 0; border-radius: 4px;">
              <p style="margin: 0; font-weight: bold; color: #1e40af;">📎 Documentos adjuntos:</p>
              <ul style="margin: 8px 0 0; color: #4b5563;">
                <li>Código de Conducta</li>
                <li>Manual del Buen Trato</li>
              </ul>
            </div>
            <p style="color: #4b5563;">Que Dios te bendiga.</p>
            <p style="color: #1f2937; font-weight: bold;">Equipo Servidores del Servidor</p>
          </div>
          <div style="background-color: #f9fafb; padding: 16px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">www.servidoresdelservidor.org</p>
          </div>
        </div>
      `,
      attachments: adjuntos,
    })

    console.log(`✅ Correo enviado a ${datos.correoElectronico}`)
    res.json({ ok: true, mensaje: 'Registro guardado y correo enviado correctamente.' })

  } catch (error) {
    console.error('❌ Error enviando correo:', error)
    res.status(500).json({ ok: false, mensaje: 'Error al enviar el correo.' })
  }
})

const verificarAdmin = (req, res, next) => {
  if (req.headers['x-admin-key'] !== 'SDS2026admin') {
    return res.status(401).json({ ok: false, mensaje: 'No autorizado' })
  }
  next()
}

// Login de miembros
app.post('/api/login', async (req, res) => {
  const { numeroIdentificacion, clave } = req.body
  if (!numeroIdentificacion || !clave) {
    return res.status(400).json({ ok: false, mensaje: 'Ingresa tu número de identificación y clave.' })
  }
  const { data, error } = await supabase
    .from('registros')
    .select('id, primer_nombre, primer_apellido, numero_identificacion, clave, responsabilidades_consejo, ciudad_donde_sirve, estado_consagracion')
    .eq('numero_identificacion', numeroIdentificacion)
    .single()

  if (error || !data) {
    return res.status(401).json({ ok: false, mensaje: 'Número de identificación no encontrado.' })
  }
  if (!data.clave) {
    return res.status(401).json({ ok: false, mensaje: 'Tu usuario aún no tiene clave asignada. Contacta al administrador.' })
  }
  if (data.clave !== clave) {
    return res.status(401).json({ ok: false, mensaje: 'Clave incorrecta.' })
  }

  // Determinar roles
  const roles = []
  const resps = data.responsabilidades_consejo || []
  if (resps.includes('Formación y consagraciones')) roles.push('responsable_formacion')
  if (resps.includes('Obras y servicios')) roles.push('responsable_obras')
  if (resps.includes('Coordinador principal del consejo')) roles.push('coordinador_consejo')

  res.json({
    ok: true,
    miembro: {
      id: data.id,
      nombre: `${data.primer_nombre} ${data.primer_apellido}`,
      numeroIdentificacion: data.numero_identificacion,
      ciudad: data.ciudad_donde_sirve,
      roles,
    }
  })
})

// Obtener datos propios del miembro
app.get('/api/miembro/perfil', async (req, res) => {
  const token = req.headers['x-miembro-id']
  if (!token) return res.status(401).json({ ok: false })
  const { data, error } = await supabase.from('registros').select('*').eq('id', token).single()
  if (error || !data) return res.status(404).json({ ok: false })
  const { clave, ...resto } = data
  res.json({ ok: true, datos: resto })
})

// Actualizar datos propios del miembro (secciones 1-4, sin cédula)
app.put('/api/miembro/perfil', async (req, res) => {
  const token = req.headers['x-miembro-id']
  if (!token) return res.status(401).json({ ok: false })
  const CAMPOS_PERMITIDOS = [
    'primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido',
    'fecha_nacimiento', 'fecha_fallecimiento', 'tipo_identificacion', 'sexo', 'estado_civil', 'tipo_sangre',
    'foto_url',
    'correo_electronico', 'telefono_movil', 'telefono_fijo', 'otro_telefono',
    'pais_residencia', 'departamento_servicio', 'ciudad_servicio', 'direccion_residencia',
    'nivel_academico', 'profesion', 'ocupacion',
    'tipo_sangre', 'eps_servicio', 'indicaciones_medicas',
  ]
  const actualizacion = {}
  for (const campo of CAMPOS_PERMITIDOS) {
    if (req.body[campo] !== undefined) actualizacion[campo] = req.body[campo]
  }
  if (Object.keys(actualizacion).length === 0)
    return res.status(400).json({ ok: false, mensaje: 'No hay campos para actualizar' })
  const { error } = await supabase.from('registros').update(actualizacion).eq('id', token)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

// Pendientes de formación por ciudad (para responsable de formación)
app.get('/api/formacion/pendientes', async (req, res) => {
  const { ciudad } = req.query
  if (!ciudad) return res.status(400).json([])
  const { data, error } = await supabase
    .from('registros')
    .select('id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, numero_identificacion, fecha_nacimiento, fecha_inicio_servicio, fecha_consagracion_paciente, fecha_consagracion_servita, motivacion_paciente, motivacion_servita, ciudad_donde_sirve, estado_proceso, estado_consagracion, foto_url, created_at')
    .eq('estado_proceso', 'pendiente_formacion')
    .ilike('ciudad_donde_sirve', ciudad)
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json([])
  res.json(data)
})

// Aspirantes con formación aprobada (listos para concepto del consejo)
app.get('/api/formacion/aprobados-formacion', async (req, res) => {
  const { ciudad } = req.query
  if (!ciudad) return res.status(400).json([])
  const { data, error } = await supabase
    .from('registros')
    .select('id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, numero_identificacion, fecha_nacimiento, fecha_inicio_servicio, fecha_consagracion_paciente, fecha_consagracion_servita, motivacion_paciente, motivacion_servita, ciudad_donde_sirve, estado_proceso, estado_consagracion, concepto_formacion, historial_formacion, concepto_consejo, fecha_reunion_consejo, foto_url, created_at')
    .eq('estado_proceso', 'formacion_aprobada')
    .ilike('ciudad_donde_sirve', ciudad)
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json([])
  res.json(data)
})

// Aprobados y no aprobados para consagración en una ciudad
app.get('/api/formacion/aprobados-consagracion', async (req, res) => {
  const { ciudad } = req.query
  if (!ciudad) return res.status(400).json([])
  const { data, error } = await supabase
    .from('registros')
    .select('id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, numero_identificacion, fecha_nacimiento, fecha_inicio_servicio, ciudad_donde_sirve, estado_proceso, estado_consagracion, created_at')
    .in('estado_proceso', ['aprobado_consagracion', 'no_aprobado_junta'])
    .ilike('ciudad_donde_sirve', ciudad)
    .order('primer_apellido', { ascending: true })
  if (error) return res.status(500).json([])
  res.json(data)
})

// Registrar consagración masiva como paciente
app.put('/api/formacion/consagrar-pacientes', async (req, res) => {
  const token = req.headers['x-miembro-id']
  if (!token) return res.status(401).json({ ok: false, mensaje: 'No autorizado' })
  const { ids, fecha_consagracion, acta_url } = req.body
  if (!ids || !ids.length || !fecha_consagracion)
    return res.status(400).json({ ok: false, mensaje: 'Faltan datos' })

  const { data: responsable } = await supabase.from('registros').select('primer_nombre, primer_apellido').eq('id', token).single()
  const nombreResponsable = responsable ? `${responsable.primer_nombre} ${responsable.primer_apellido}` : `ID ${token}`

  const errores = []
  for (const id of ids) {
    const { data: reg } = await supabase.from('registros').select('estado_proceso, estado_consagracion').eq('id', id).single()
    const esPaciente = reg?.estado_consagracion === 'paciente'
    const nuevoEstado = esPaciente ? 'consagrado_servita' : 'consagrado_paciente'
    const nuevoNivel = esPaciente ? 'servita' : 'paciente'
    const campofecha = esPaciente ? 'fecha_consagracion_servita' : 'fecha_consagracion_paciente'
    const actualizacion = { estado_proceso: nuevoEstado, estado_consagracion: nuevoNivel, [campofecha]: fecha_consagracion, fecha_estado: new Date().toISOString() }
    if (acta_url) actualizacion.acta_consagracion_url = acta_url
    const { error } = await supabase.from('registros').update(actualizacion).eq('id', id)
    if (error) { errores.push(id); continue }
    await agregarHistorial(id, reg?.estado_proceso, nuevoEstado, nombreResponsable, `Ceremonia de consagración: ${fecha_consagracion}`)
  }

  if (errores.length) return res.status(500).json({ ok: false, mensaje: `Fallaron ${errores.length} registros` })
  res.json({ ok: true })
})

// Cambiar clave del miembro
app.put('/api/miembro/cambiar-clave', async (req, res) => {
  const token = req.headers['x-miembro-id']
  if (!token) return res.status(401).json({ ok: false, mensaje: 'No autorizado' })
  const { claveActual, claveNueva } = req.body
  if (!claveActual || !claveNueva) return res.status(400).json({ ok: false, mensaje: 'Faltan datos' })
  if (claveNueva.length < 6) return res.status(400).json({ ok: false, mensaje: 'La clave nueva debe tener al menos 6 caracteres' })
  const { data: reg } = await supabase.from('registros').select('clave').eq('id', token).single()
  if (!reg) return res.status(404).json({ ok: false, mensaje: 'No encontrado' })
  if (reg.clave !== claveActual) return res.status(401).json({ ok: false, mensaje: 'La clave actual es incorrecta' })
  const { error } = await supabase.from('registros').update({ clave: claveNueva }).eq('id', token)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

// Solicitud de consagración desde el perfil del miembro
app.post('/api/miembro/solicitar-consagracion', async (req, res) => {
  const token = req.headers['x-miembro-id']
  if (!token) return res.status(401).json({ ok: false, mensaje: 'No autorizado' })
  const { motivacion, otra_comunidad } = req.body
  if (!motivacion?.trim()) return res.status(400).json({ ok: false, mensaje: 'La motivación es obligatoria' })
  const { data: reg } = await supabase.from('registros').select('estado_proceso, estado_consagracion, primer_nombre, primer_apellido').eq('id', token).single()
  if (!reg) return res.status(404).json({ ok: false, mensaje: 'No encontrado' })
  const campoMotivacion = reg.estado_consagracion === 'paciente' ? 'motivacion_servita' : 'motivacion_paciente'
  const actualizacionSolicitud = {
    estado_proceso: 'pendiente_formacion',
    [campoMotivacion]: motivacion.trim(),
    fecha_estado: new Date().toISOString(),
  }
  if (otra_comunidad) actualizacionSolicitud.otra_comunidad = otra_comunidad
  const { error } = await supabase.from('registros').update(actualizacionSolicitud).eq('id', token)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  await agregarHistorial(token, reg.estado_proceso, 'pendiente_formacion', `${reg.primer_nombre} ${reg.primer_apellido}`, 'Solicitud de consagración enviada desde el perfil')
  res.json({ ok: true })
})

// Aspirantes listos para formación (cumple_requisitos o formacion_no_aprobada)
app.get('/api/formacion/cumple-requisitos', async (req, res) => {
  const { ciudad } = req.query
  if (!ciudad) return res.status(400).json([])
  const { data, error } = await supabase
    .from('registros')
    .select('id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, numero_identificacion, fecha_nacimiento, fecha_inicio_servicio, fecha_consagracion_paciente, fecha_consagracion_servita, motivacion_paciente, motivacion_servita, ciudad_donde_sirve, estado_proceso, estado_consagracion, concepto_formacion, historial_formacion, foto_url, created_at')
    .in('estado_proceso', ['cumple_requisitos', 'formacion_no_aprobada'])
    .ilike('ciudad_donde_sirve', ciudad)
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json([])
  res.json(data)
})

// Agrega una entrada al historial_proceso
async function agregarHistorial(id, estadoAnterior, estadoNuevo, cambiado_por, notas = '') {
  const { data: reg } = await supabase.from('registros').select('historial_proceso').eq('id', id).single()
  const historial = reg?.historial_proceso || []
  historial.push({
    fecha: new Date().toISOString(),
    estado_anterior: estadoAnterior,
    estado_nuevo: estadoNuevo,
    cambiado_por,
    notas,
  })
  await supabase.from('registros').update({ historial_proceso: historial }).eq('id', id)
}

// Guardar concepto del consejo
app.put('/api/formacion/concepto-consejo/:id', async (req, res) => {
  const token = req.headers['x-miembro-id']
  if (!token) return res.status(401).json({ ok: false, mensaje: 'No autorizado' })
  const { concepto_consejo, fecha_reunion_consejo, avala } = req.body
  if (!concepto_consejo || !fecha_reunion_consejo || avala === undefined)
    return res.status(400).json({ ok: false, mensaje: 'Faltan datos' })
  const decision = avala ? 'pendiente_aprobacion' : 'no_avalado_consejo'

  const { data: reg } = await supabase.from('registros').select('estado_proceso, primer_nombre, primer_apellido').eq('id', req.params.id).single()
  const { data: responsable } = await supabase.from('registros').select('primer_nombre, primer_apellido').eq('id', token).single()
  const nombreResponsable = responsable ? `${responsable.primer_nombre} ${responsable.primer_apellido}` : `ID ${token}`

  const { error } = await supabase.from('registros').update({
    concepto_consejo,
    fecha_reunion_consejo,
    estado_proceso: decision,
    fecha_estado: new Date().toISOString(),
  }).eq('id', req.params.id)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })

  await agregarHistorial(req.params.id, reg?.estado_proceso, decision, nombreResponsable, concepto_consejo)
  res.json({ ok: true })
})

// Cambiar estado desde panel de formación
app.put('/api/formacion/estado/:id', async (req, res) => {
  const token = req.headers['x-miembro-id']
  if (!token) return res.status(401).json({ ok: false, mensaje: 'No autorizado' })
  const { estado, concepto_formacion } = req.body
  const estadosPermitidos = ['cumple_requisitos', 'no_cumple_requisitos', 'formacion_aprobada', 'formacion_no_aprobada']
  if (!estadosPermitidos.includes(estado)) return res.status(400).json({ ok: false, mensaje: 'Estado no permitido' })

  // Obtener estado actual y nombre del responsable
  const { data: reg } = await supabase.from('registros')
    .select('estado_proceso, historial_formacion, primer_nombre, primer_apellido')
    .eq('id', req.params.id).single()
  const { data: responsable } = await supabase.from('registros')
    .select('primer_nombre, primer_apellido')
    .eq('id', token).single()
  const nombreResponsable = responsable
    ? `${responsable.primer_nombre} ${responsable.primer_apellido}`
    : `ID ${token}`

  const actualizacion = { estado_proceso: estado, fecha_estado: new Date().toISOString() }

  // Si hay concepto, guardarlo y agregar al historial de formación
  if (concepto_formacion !== undefined) {
    actualizacion.concepto_formacion = concepto_formacion
    const historialF = reg?.historial_formacion || []
    historialF.push({
      fecha: new Date().toISOString(),
      concepto: concepto_formacion,
      resultado: estado === 'formacion_aprobada' ? 'Aprobada' : 'No aprobada',
      responsable: nombreResponsable,
    })
    actualizacion.historial_formacion = historialF
  }

  const { error } = await supabase.from('registros').update(actualizacion).eq('id', req.params.id)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })

  // Guardar en historial de proceso
  await agregarHistorial(req.params.id, reg?.estado_proceso, estado, nombreResponsable, concepto_formacion || '')

  res.json({ ok: true })
})

// Aspirantes pendientes por aprobación de junta (todos los estados pendiente_aprobacion y no_avalado_consejo)
app.get('/api/junta/pendientes', verificarAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('registros')
    .select('*')
    .in('estado_proceso', ['pendiente_aprobacion', 'no_avalado_consejo'])
    .order('ciudad_donde_sirve', { ascending: true })
  if (error) return res.status(500).json([])
  res.json(data)
})

// Decisión final de la junta
app.put('/api/junta/decision/:id', verificarAdmin, async (req, res) => {
  const { decision, notas, fecha_junta } = req.body
  const estadosPermitidos = ['aprobado_consagracion', 'no_aprobado_junta']
  if (!estadosPermitidos.includes(decision))
    return res.status(400).json({ ok: false, mensaje: 'Decisión no válida' })
  if (!fecha_junta)
    return res.status(400).json({ ok: false, mensaje: 'La fecha de reunión de la junta es obligatoria' })
  const { data: reg } = await supabase.from('registros').select('estado_proceso').eq('id', req.params.id).single()
  const actualizacion = { estado_proceso: decision, fecha_estado: new Date().toISOString(), fecha_reunion_junta: fecha_junta }
  const { error } = await supabase.from('registros').update(actualizacion).eq('id', req.params.id)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  await agregarHistorial(req.params.id, reg?.estado_proceso, decision, 'Junta directiva', notas || '')
  res.json({ ok: true })
})

// Registros para pilar (búsqueda avanzada)
app.get('/api/pilar/registros', async (req, res) => {
  const miembroId = req.headers['x-miembro-id']
  if (!miembroId) return res.status(401).json({ error: 'sin id' })
  const { data: m, error: errM } = await supabase.from('registros').select('estado_consagracion').eq('id', miembroId).single()
  if (errM || !m) return res.status(403).json({ error: 'miembro no encontrado', miembroId })
  if (m.estado_consagracion !== 'pilar') return res.status(403).json({ error: 'no es pilar', estado: m.estado_consagracion })
  const { data, error } = await supabase.from('registros').select('*').order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

app.get('/api/admin/registros', verificarAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('registros')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json(data)
})

app.put('/api/admin/registros/:id', verificarAdmin, async (req, res) => {
  const { id } = req.params

  // Si cambió el estado, guardar en historial
  if (req.body.estado_proceso) {
    const { data: reg } = await supabase.from('registros').select('estado_proceso').eq('id', id).single()
    if (reg && reg.estado_proceso !== req.body.estado_proceso) {
      await agregarHistorial(id, reg.estado_proceso, req.body.estado_proceso, 'Administrador')
    }
  }

  const { error } = await supabase.from('registros').update(req.body).eq('id', id)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

app.delete('/api/admin/registros/:id', verificarAdmin, async (req, res) => {
  const { id } = req.params
  const { error } = await supabase
    .from('registros')
    .delete()
    .eq('id', id)

  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

app.get('/api/puntos-servicio', async (req, res) => {
  const { ciudad } = req.query
  let query = supabase.from('puntos_servicio').select('id, nombre, ciudad, pais').eq('activo', true)
  if (ciudad) query = query.ilike('ciudad', ciudad)
  const { data, error } = await query.order('nombre')
  if (error) return res.status(500).json([])
  res.json(data)
})

// Correo masivo (admin o pilar)
app.post('/api/admin/enviar-correo-masivo', async (req, res) => {
  const adminKey = req.headers['x-admin-key']
  const miembroId = req.headers['x-miembro-id']
  if (!adminKey && !miembroId) return res.status(401).json({ ok: false, mensaje: 'No autorizado' })

  // Si es miembro, verificar que sea pilar
  let replyTo = null
  if (miembroId) {
    const { data: m } = await supabase.from('registros').select('estado_consagracion, correo_electronico').eq('id', miembroId).single()
    if (!m || m.estado_consagracion !== 'pilar') return res.status(403).json({ ok: false, mensaje: 'Solo los pilares pueden enviar correos masivos' })
    if (m.correo_electronico) replyTo = m.correo_electronico
  } else if (adminKey !== 'SDS2026admin') {
    return res.status(401).json({ ok: false, mensaje: 'No autorizado' })
  }

  const { asunto, cuerpo, correos } = req.body
  if (!asunto || !cuerpo || !Array.isArray(correos) || correos.length === 0)
    return res.status(400).json({ ok: false, mensaje: 'Faltan datos' })

  let enviados = 0, errores = 0
  for (const correo of correos) {
    try {
      const emailData = {
        from: process.env.CORREO_INSTITUCIONAL || 'noreply@servidoresdelservidor.org',
        to: correo,
        subject: asunto,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:auto"><p style="white-space:pre-line">${cuerpo}</p><hr style="margin-top:32px"><p style="color:#888;font-size:12px">Servidores del Servidor</p></div>`
      }
      if (replyTo) emailData.reply_to = replyTo
      await resend.emails.send(emailData)
      enviados++
    } catch { errores++ }
  }
  res.json({ ok: true, enviados, errores })
})

app.get('/api/admin/puntos-servicio', verificarAdmin, async (req, res) => {
  const { data, error } = await supabase.from('puntos_servicio').select('*').order('pais').order('ciudad').order('nombre')
  if (error) return res.status(500).json([])
  res.json(data)
})

app.post('/api/admin/puntos-servicio', verificarAdmin, async (req, res) => {
  const { error } = await supabase.from('puntos_servicio').insert(req.body)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

app.put('/api/admin/puntos-servicio/:id', verificarAdmin, async (req, res) => {
  const { error } = await supabase.from('puntos_servicio').update(req.body).eq('id', req.params.id)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

app.delete('/api/admin/puntos-servicio/:id', verificarAdmin, async (req, res) => {
  const { error } = await supabase.from('puntos_servicio').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

// ── Responsabilidades Consejo ───────────────────────────────────────────────

// Consejeros de una ciudad
app.get('/api/consejo/miembros', async (req, res) => {
  const token = req.headers['x-miembro-id']
  if (!token) return res.status(401).json([])
  const { ciudad } = req.query
  if (!ciudad) return res.status(400).json([])
  const { data } = await supabase.from('registros')
    .select('id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, numero_identificacion, responsabilidades_consejo, fecha_inicio_consejo, estado_consagracion')
    .eq('pertenece_consejo', 'Si pertenezco')
    .ilike('ciudad_donde_sirve', ciudad)
    .order('primer_apellido')
  res.json(data || [])
})

// Actualizar responsabilidades de un consejero
app.put('/api/consejo/miembro/:id/responsabilidades', async (req, res) => {
  const token = req.headers['x-miembro-id']
  if (!token) return res.status(401).json({ ok: false })
  const { responsabilidades } = req.body
  if (!Array.isArray(responsabilidades)) return res.status(400).json({ ok: false, mensaje: 'Formato inválido' })
  const { error } = await supabase.from('registros').update({ responsabilidades_consejo: responsabilidades }).eq('id', req.params.id)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

// Consejeros de una ciudad (admin)
app.get('/api/admin/consejo/miembros', verificarAdmin, async (req, res) => {
  const { ciudad } = req.query
  if (!ciudad) return res.status(400).json([])
  const { data } = await supabase.from('registros')
    .select('id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, numero_identificacion, responsabilidades_consejo, fecha_inicio_consejo, estado_consagracion, pertenece_consejo')
    .eq('pertenece_consejo', 'Si pertenezco')
    .ilike('ciudad_donde_sirve', ciudad)
    .order('primer_apellido')
  res.json(data || [])
})

// Buscar miembros de una ciudad para agregar al consejo (admin)
app.get('/api/admin/consejo/buscar-miembro', verificarAdmin, async (req, res) => {
  const { q, ciudad } = req.query
  if (!q || !ciudad) return res.json([])
  const { data } = await supabase.from('registros')
    .select('id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, numero_identificacion, estado_consagracion, pertenece_consejo')
    .ilike('ciudad_donde_sirve', ciudad)
    .or(`primer_nombre.ilike.%${q}%,primer_apellido.ilike.%${q}%,segundo_apellido.ilike.%${q}%,numero_identificacion.ilike.%${q}%`)
    .neq('pertenece_consejo', 'Si pertenezco')
    .limit(10)
  res.json(data || [])
})

// Agregar miembro al consejo (admin)
app.put('/api/admin/consejo/miembro/:id/agregar', verificarAdmin, async (req, res) => {
  const { error } = await supabase.from('registros').update({
    pertenece_consejo: 'Si pertenezco',
    responsabilidades_consejo: [],
    fecha_inicio_consejo: new Date().toISOString().split('T')[0]
  }).eq('id', req.params.id)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

// Eliminar miembro del consejo (admin) — limpia responsabilidades
app.put('/api/admin/consejo/miembro/:id/eliminar', verificarAdmin, async (req, res) => {
  const { error } = await supabase.from('registros').update({
    pertenece_consejo: 'No pertenezco',
    responsabilidades_consejo: [],
    fecha_inicio_consejo: null
  }).eq('id', req.params.id)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

// Quitar rol coordinador (admin)
app.put('/api/admin/consejo/miembro/:id/quitar-coordinador', verificarAdmin, async (req, res) => {
  const { rol } = req.body
  const { data: miembro } = await supabase.from('registros').select('responsabilidades_consejo').eq('id', req.params.id).single()
  const resps = (miembro?.responsabilidades_consejo || []).filter(r => r !== rol)
  const { error } = await supabase.from('registros').update({ responsabilidades_consejo: resps }).eq('id', req.params.id)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

// Asignar coordinador principal o suplente (admin)
app.put('/api/admin/consejo/miembro/:id/coordinador', verificarAdmin, async (req, res) => {
  const { tipo, ciudadActual } = req.body
  // tipo: 'principal' | 'suplente'
  const rolAsignar = tipo === 'principal' ? 'Coordinador principal del consejo' : 'Coordinador suplente del consejo'
  const rolQuitar = tipo === 'principal' ? 'Coordinador principal del consejo' : 'Coordinador suplente del consejo'

  // Quitar ese rol a quien lo tenga actualmente en esa ciudad
  const { data: actuales } = await supabase.from('registros')
    .select('id, responsabilidades_consejo')
    .eq('pertenece_consejo', 'Si pertenezco')
    .ilike('ciudad_donde_sirve', ciudadActual)
  if (actuales) {
    for (const m of actuales) {
      const resps = m.responsabilidades_consejo || []
      if (resps.includes(rolQuitar) && m.id !== parseInt(req.params.id)) {
        await supabase.from('registros').update({
          responsabilidades_consejo: resps.filter(r => r !== rolQuitar)
        }).eq('id', m.id)
      }
    }
  }

  // Asignar rol al nuevo coordinador
  const { data: nuevo } = await supabase.from('registros').select('responsabilidades_consejo').eq('id', req.params.id).single()
  const respsNuevo = (nuevo?.responsabilidades_consejo || []).filter(r => r !== rolAsignar)
  respsNuevo.push(rolAsignar)
  const { error } = await supabase.from('registros').update({ responsabilidades_consejo: respsNuevo }).eq('id', req.params.id)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

// ── Obras y Servicios ──────────────────────────────────────────────────────

// Crear punto de servicio desde panel de obras
app.post('/api/obras/puntos-servicio', async (req, res) => {
  const token = req.headers['x-miembro-id']
  if (!token) return res.status(401).json({ ok: false })
  const { nombre } = req.body
  if (!nombre?.trim()) return res.status(400).json({ ok: false, mensaje: 'Falta el nombre' })
  const { data: miembro } = await supabase.from('registros').select('ciudad_donde_sirve, pais_servicio, departamento_ciudad_servicio').eq('id', token).single()
  if (!miembro) return res.status(404).json({ ok: false, mensaje: 'Miembro no encontrado' })
  const { error } = await supabase.from('puntos_servicio').insert({
    nombre: nombre.trim(),
    ciudad: miembro.ciudad_donde_sirve,
    pais: miembro.pais_servicio || 'Colombia',
    departamento: miembro.departamento_ciudad_servicio || null,
    activo: true
  })
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

// Eliminar punto de servicio desde panel de obras
app.delete('/api/obras/puntos-servicio/:id', async (req, res) => {
  const token = req.headers['x-miembro-id']
  if (!token) return res.status(401).json({ ok: false })
  const { error } = await supabase.from('puntos_servicio').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

// Puntos de servicio de una ciudad con conteo de miembros
app.get('/api/obras/puntos-servicio', async (req, res) => {
  const token = req.headers['x-miembro-id']
  if (!token) return res.status(401).json([])
  const { ciudad } = req.query
  if (!ciudad) return res.status(400).json([])
  const { data: puntos } = await supabase.from('puntos_servicio').select('id, nombre').eq('activo', true).ilike('ciudad', ciudad).order('nombre')
  if (!puntos) return res.json([])
  const { data: miembros } = await supabase.from('registros').select('puntos_servicio').ilike('ciudad_donde_sirve', ciudad)
  const conteos = {}
  for (const m of miembros || []) {
    for (const p of m.puntos_servicio || []) {
      conteos[p] = (conteos[p] || 0) + 1
    }
  }
  res.json(puntos.map(p => ({ ...p, total_miembros: conteos[p.nombre] || 0 })))
})

// Miembros de un punto de servicio en una ciudad
app.get('/api/obras/miembros-punto', async (req, res) => {
  const token = req.headers['x-miembro-id']
  if (!token) return res.status(401).json([])
  const { punto, ciudad } = req.query
  if (!punto || !ciudad) return res.status(400).json([])
  const { data } = await supabase.from('registros')
    .select('id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, numero_identificacion, estado_consagracion, es_coordinador, puntos_coordina, puntos_servicio')
    .ilike('ciudad_donde_sirve', ciudad)
  const filtrados = (data || [])
    .filter(m => (m.puntos_servicio || []).includes(punto))
    .sort((a, b) => (a.primer_apellido || '').localeCompare(b.primer_apellido || ''))
  res.json(filtrados)
})

// Adicionar coordinador a un punto de servicio
app.put('/api/obras/miembro/:id/adicionar-coordinador', async (req, res) => {
  const token = req.headers['x-miembro-id']
  if (!token) return res.status(401).json({ ok: false })
  const { punto } = req.body
  if (!punto) return res.status(400).json({ ok: false, mensaje: 'Falta el punto' })
  const { data: reg } = await supabase.from('registros').select('puntos_coordina').eq('id', req.params.id).single()
  const actual = reg?.puntos_coordina || []
  if (actual.includes(punto)) return res.json({ ok: true })
  const { error } = await supabase.from('registros').update({ puntos_coordina: [...actual, punto], es_coordinador: 'Sí' }).eq('id', req.params.id)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

// Quitar coordinador de un punto de servicio
app.put('/api/obras/miembro/:id/quitar-coordinador', async (req, res) => {
  const token = req.headers['x-miembro-id']
  if (!token) return res.status(401).json({ ok: false })
  const { punto } = req.body
  if (!punto) return res.status(400).json({ ok: false, mensaje: 'Falta el punto' })
  const { data: reg } = await supabase.from('registros').select('puntos_coordina').eq('id', req.params.id).single()
  const nuevos = (reg?.puntos_coordina || []).filter(p => p !== punto)
  const { error } = await supabase.from('registros').update({ puntos_coordina: nuevos, es_coordinador: nuevos.length > 0 ? 'Sí' : 'No' }).eq('id', req.params.id)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

// Buscar miembro por nombre o identificación en una ciudad
app.get('/api/obras/buscar-miembro', async (req, res) => {
  const token = req.headers['x-miembro-id']
  if (!token) return res.status(401).json([])
  const { q, ciudad } = req.query
  if (!q || !ciudad) return res.json([])
  const { data } = await supabase.from('registros')
    .select('id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, numero_identificacion, estado_consagracion, puntos_servicio')
    .ilike('ciudad_donde_sirve', ciudad)
    .or(`primer_apellido.ilike.%${q}%,segundo_apellido.ilike.%${q}%,primer_nombre.ilike.%${q}%,numero_identificacion.ilike.%${q}%`)
    .limit(10)
  res.json(data || [])
})

// Agregar un punto de servicio a un miembro
app.put('/api/obras/miembro/:id/agregar-punto', async (req, res) => {
  const token = req.headers['x-miembro-id']
  if (!token) return res.status(401).json({ ok: false })
  const { punto } = req.body
  if (!punto) return res.status(400).json({ ok: false, mensaje: 'Falta el punto' })
  const { data: reg } = await supabase.from('registros').select('puntos_servicio').eq('id', req.params.id).single()
  const actual = reg?.puntos_servicio || []
  if (actual.includes(punto)) return res.json({ ok: true })
  const { error } = await supabase.from('registros').update({ puntos_servicio: [...actual, punto] }).eq('id', req.params.id)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

// Quitar un punto de servicio a un miembro
app.put('/api/obras/miembro/:id/quitar-punto', async (req, res) => {
  const token = req.headers['x-miembro-id']
  if (!token) return res.status(401).json({ ok: false })
  const { punto } = req.body
  if (!punto) return res.status(400).json({ ok: false, mensaje: 'Falta el punto' })
  const { data: reg } = await supabase.from('registros').select('puntos_servicio').eq('id', req.params.id).single()
  const actual = reg?.puntos_servicio || []
  const { error } = await supabase.from('registros').update({ puntos_servicio: actual.filter(p => p !== punto) }).eq('id', req.params.id)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

app.get('/api/health', (req, res) => {
  res.json({ ok: true, mensaje: 'Backend funcionando' })
})

// Subir archivo a Supabase Storage
app.post('/api/upload', upload.single('archivo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, mensaje: 'No se recibió archivo' })
  const { bucket, carpeta } = req.body
  const ext = req.file.originalname.split('.').pop()
  const nombre = `${carpeta}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from(bucket).upload(nombre, req.file.buffer, {
    contentType: req.file.mimetype,
    upsert: false,
  })
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  const { data } = supabase.storage.from(bucket).getPublicUrl(nombre)
  res.json({ ok: true, url: data.publicUrl })
})

// ── CIO ──────────────────────────────────────────────────────────────────────
const CIO_KEY = 'CIO2026'
const verificarCIO = (req, res, next) => {
  if (req.headers['x-cio-key'] !== CIO_KEY) return res.status(401).json({ error: 'No autorizado' })
  next()
}

// Clientes
app.get('/api/cio/clientes', verificarCIO, async (req, res) => {
  const { data, error } = await supabase.from('cio_clientes').select('*').order('nombre')
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})
app.post('/api/cio/clientes', verificarCIO, async (req, res) => {
  const { nit, nombre } = req.body
  const { data, error } = await supabase.from('cio_clientes').insert({ nit, nombre }).select().single()
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true, data })
})
app.put('/api/cio/clientes/:id', verificarCIO, async (req, res) => {
  const { nit, nombre } = req.body
  const { error } = await supabase.from('cio_clientes').update({ nit, nombre }).eq('id', req.params.id)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})
app.delete('/api/cio/clientes/:id', verificarCIO, async (req, res) => {
  const { error } = await supabase.from('cio_clientes').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

// Proyectos
app.get('/api/cio/proyectos/:clienteId', verificarCIO, async (req, res) => {
  const { data, error } = await supabase.from('cio_proyectos')
    .select('*, cio_items_facturacion(*), cio_productos(*), cio_registros_tiempo(*)')
    .eq('cliente_id', req.params.clienteId)
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})
app.post('/api/cio/proyectos', verificarCIO, async (req, res) => {
  const { cliente_id, concepto, fecha_inicio } = req.body
  const { data, error } = await supabase.from('cio_proyectos').insert({ cliente_id, concepto, fecha_inicio: fecha_inicio || null }).select().single()
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true, data })
})
app.put('/api/cio/proyectos/:id', verificarCIO, async (req, res) => {
  const { concepto, fecha_inicio } = req.body
  const { error } = await supabase.from('cio_proyectos').update({ concepto, fecha_inicio: fecha_inicio || null }).eq('id', req.params.id)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

// Productos
app.post('/api/cio/productos', verificarCIO, async (req, res) => {
  const { proyecto_id, concepto, valor, horas_estimadas } = req.body
  const { data, error } = await supabase.from('cio_productos').insert({ proyecto_id, concepto, valor: valor || 0, horas_estimadas: horas_estimadas || null }).select().single()
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true, data })
})
app.put('/api/cio/productos/:id', verificarCIO, async (req, res) => {
  const { concepto, valor, horas_estimadas } = req.body
  const { error } = await supabase.from('cio_productos').update({ concepto, valor: valor || 0, horas_estimadas: horas_estimadas || null }).eq('id', req.params.id)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})
app.delete('/api/cio/productos/:id', verificarCIO, async (req, res) => {
  const { error } = await supabase.from('cio_productos').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})
app.delete('/api/cio/proyectos/:id', verificarCIO, async (req, res) => {
  const { error } = await supabase.from('cio_proyectos').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

// Items facturación
app.post('/api/cio/items', verificarCIO, async (req, res) => {
  const { proyecto_id, fecha_facturacion, valor_facturado, descripcion } = req.body
  const { data, error } = await supabase.from('cio_items_facturacion').insert({ proyecto_id, fecha_facturacion, valor_facturado, descripcion }).select().single()
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true, data })
})
app.put('/api/cio/items/:id', verificarCIO, async (req, res) => {
  const { fecha_facturacion, valor_facturado, descripcion } = req.body
  const { error } = await supabase.from('cio_items_facturacion').update({ fecha_facturacion, valor_facturado, descripcion }).eq('id', req.params.id)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})
app.delete('/api/cio/items/:id', verificarCIO, async (req, res) => {
  const { error } = await supabase.from('cio_items_facturacion').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

// Registros de tiempo
app.post('/api/cio/tiempo', verificarCIO, async (req, res) => {
  const { proyecto_id, producto_id, fecha, hora_inicio, hora_fin, con_quien, actividad } = req.body
  const [h1, m1] = hora_inicio.split(':').map(Number)
  const [h2, m2] = hora_fin.split(':').map(Number)
  const horas = Math.round(((h2 * 60 + m2) - (h1 * 60 + m1)) / 60 * 100) / 100
  const { data, error } = await supabase.from('cio_registros_tiempo').insert({ proyecto_id, producto_id: producto_id || null, fecha, hora_inicio, hora_fin, horas, con_quien, actividad }).select().single()
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true, data })
})
app.put('/api/cio/tiempo/:id', verificarCIO, async (req, res) => {
  const { producto_id, fecha, hora_inicio, hora_fin, con_quien, actividad } = req.body
  const [h1, m1] = hora_inicio.split(':').map(Number)
  const [h2, m2] = hora_fin.split(':').map(Number)
  const horas = Math.round(((h2 * 60 + m2) - (h1 * 60 + m1)) / 60 * 100) / 100
  const { error } = await supabase.from('cio_registros_tiempo').update({ producto_id: producto_id || null, fecha, hora_inicio, hora_fin, horas, con_quien, actividad }).eq('id', req.params.id)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})
app.delete('/api/cio/tiempo/:id', verificarCIO, async (req, res) => {
  const { error } = await supabase.from('cio_registros_tiempo').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`🚀 Backend corriendo en http://localhost:${PORT}`)
})
