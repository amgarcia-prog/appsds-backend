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
    por_que_consagrarse: datos.porQueConsagrarse,
    fecha_consagracion: datos.fechaConsagracion || null,
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
    .select('id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, numero_identificacion, fecha_nacimiento, fecha_inicio_servicio, por_que_consagrarse, ciudad_donde_sirve, estado_proceso, estado_consagracion, foto_url, created_at')
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
    .select('id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, numero_identificacion, fecha_nacimiento, fecha_inicio_servicio, por_que_consagrarse, ciudad_donde_sirve, estado_proceso, estado_consagracion, concepto_formacion, historial_formacion, concepto_consejo, fecha_reunion_consejo, foto_url, created_at')
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
    const actualizacion = { estado_proceso: nuevoEstado, estado_consagracion: nuevoNivel, fecha_consagracion, fecha_estado: new Date().toISOString() }
    if (acta_url) actualizacion.acta_consagracion_url = acta_url
    const { error } = await supabase.from('registros').update(actualizacion).eq('id', id)
    if (error) { errores.push(id); continue }
    await agregarHistorial(id, reg?.estado_proceso, nuevoEstado, nombreResponsable, `Ceremonia de consagración: ${fecha_consagracion}`)
  }

  if (errores.length) return res.status(500).json({ ok: false, mensaje: `Fallaron ${errores.length} registros` })
  res.json({ ok: true })
})

// Solicitud de consagración desde el perfil del miembro
app.post('/api/miembro/solicitar-consagracion', async (req, res) => {
  const token = req.headers['x-miembro-id']
  if (!token) return res.status(401).json({ ok: false, mensaje: 'No autorizado' })
  const { motivacion, otra_comunidad } = req.body
  if (!motivacion?.trim()) return res.status(400).json({ ok: false, mensaje: 'La motivación es obligatoria' })
  const { data: reg } = await supabase.from('registros').select('estado_proceso, primer_nombre, primer_apellido').eq('id', token).single()
  if (!reg) return res.status(404).json({ ok: false, mensaje: 'No encontrado' })
  const actualizacionSolicitud = {
    estado_proceso: 'pendiente_formacion',
    por_que_consagrarse: motivacion.trim(),
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
    .select('id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, numero_identificacion, fecha_nacimiento, fecha_inicio_servicio, por_que_consagrarse, ciudad_donde_sirve, estado_proceso, estado_consagracion, concepto_formacion, historial_formacion, foto_url, created_at')
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

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`🚀 Backend corriendo en http://localhost:${PORT}`)
})
