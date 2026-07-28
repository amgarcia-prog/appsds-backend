require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { Resend } = require('resend')
const { createClient } = require('@supabase/supabase-js')
const ExcelJS = require('exceljs')
const PDFDocument = require('pdfkit')
const archiver = require('archiver')
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

  // Guardar ciudades responsables del pilar
  if (datos.estadoConsagracion === 'pilar' && Array.isArray(datos.ciudadesResponsable) && datos.ciudadesResponsable.length > 0) {
    const { data: nuevoRegistro } = await supabase.from('registros').select('id').eq('numero_identificacion', datos.numeroIdentificacion).single()
    if (nuevoRegistro) {
      const ciudadesInsert = datos.ciudadesResponsable.map(c => ({ pilar_id: nuevoRegistro.id, pais: c.pais, departamento: c.departamento || null, ciudad: c.ciudad }))
      await supabase.from('pilar_ciudades').insert(ciudadesInsert)
    }
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
    .select('id, primer_nombre, primer_apellido, numero_identificacion, clave, responsabilidades_consejo, responsabilidades_pilar, ciudad_donde_sirve, estado_consagracion, roles')
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
  const roles = [...(data.roles || [])]
  const resps = data.responsabilidades_consejo || []
  if (resps.includes('Formación y consagraciones') && !roles.includes('responsable_formacion')) roles.push('responsable_formacion')
  if (resps.includes('Obras y servicios') && !roles.includes('responsable_obras')) roles.push('responsable_obras')
  if (resps.includes('Coordinador principal del consejo') && !roles.includes('coordinador_consejo')) roles.push('coordinador_consejo')
  if (resps.includes('Financiero') && !roles.includes('responsable_financiero')) roles.push('responsable_financiero')

  res.json({
    ok: true,
    miembro: {
      id: data.id,
      nombre: `${data.primer_nombre} ${data.primer_apellido}`,
      numeroIdentificacion: data.numero_identificacion,
      ciudad: data.ciudad_donde_sirve,
      estado_consagracion: data.estado_consagracion,
      responsabilidades_consejo: data.responsabilidades_consejo,
      responsabilidades_pilar: data.responsabilidades_pilar,
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

app.put('/api/admin/registros/:id/rol-financiero', verificarAdmin, async (req, res) => {
  const { asignar } = req.body
  const { data: reg } = await supabase.from('registros').select('roles').eq('id', req.params.id).single()
  let roles = reg?.roles || []
  if (asignar) { if (!roles.includes('responsable_financiero')) roles = [...roles, 'responsable_financiero'] }
  else { roles = roles.filter(r => r !== 'responsable_financiero') }
  const { error } = await supabase.from('registros').update({ roles }).eq('id', req.params.id)
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

// ── Pilar Organizacional ─────────────────────────────────────────────────────

const verificarPilarOrganizacional = async (req, res, next) => {
  const id = req.headers['x-miembro-id']
  if (!id) return res.status(401).json({ error: 'No autorizado' })
  const { data } = await supabase.from('registros').select('estado_consagracion, responsabilidades_pilar').eq('id', id).single()
  if (!data || data.estado_consagracion !== 'pilar' || !(data.responsabilidades_pilar || []).includes('Organizacional'))
    return res.status(403).json({ error: 'Solo pilares con rol Organizacional' })
  next()
}

// Ciudades de un pilar
app.get('/api/pilar/ciudades', async (req, res) => {
  const id = req.headers['x-miembro-id']
  if (!id) return res.status(401).json([])
  const { data } = await supabase.from('pilar_ciudades').select('*').eq('pilar_id', id).order('pais').order('ciudad')
  res.json(data || [])
})
app.post('/api/pilar/ciudades', async (req, res) => {
  const id = req.headers['x-miembro-id']
  if (!id) return res.status(401).json({ ok: false })
  const { pais, departamento, ciudad } = req.body
  const { error } = await supabase.from('pilar_ciudades').insert({ pilar_id: id, pais, departamento, ciudad })
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})
app.delete('/api/pilar/ciudades/:ciudadId', async (req, res) => {
  const id = req.headers['x-miembro-id']
  if (!id) return res.status(401).json({ ok: false })
  const { error } = await supabase.from('pilar_ciudades').delete().eq('id', req.params.ciudadId).eq('pilar_id', id)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

// Lista de todos los pilares (para organizacional)
app.get('/api/organizacional/pilares', verificarPilarOrganizacional, async (req, res) => {
  const { data } = await supabase.from('registros')
    .select('id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, numero_identificacion, responsabilidades_pilar, ciudad_donde_sirve, pais_servicio')
    .eq('estado_consagracion', 'pilar')
    .order('primer_apellido')
  res.json(data || [])
})

// Actualizar responsabilidades de un pilar
app.put('/api/organizacional/pilar/:id/responsabilidades', verificarPilarOrganizacional, async (req, res) => {
  const { responsabilidades } = req.body
  if (!Array.isArray(responsabilidades)) return res.status(400).json({ ok: false, mensaje: 'Formato inválido' })
  const { error } = await supabase.from('registros').update({ responsabilidades_pilar: responsabilidades }).eq('id', req.params.id)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

// Ciudades de un pilar (por organizacional)
app.get('/api/organizacional/pilar/:id/ciudades', verificarPilarOrganizacional, async (req, res) => {
  const { data } = await supabase.from('pilar_ciudades').select('*').eq('pilar_id', req.params.id).order('pais').order('ciudad')
  res.json(data || [])
})
app.post('/api/organizacional/pilar/:id/ciudades', verificarPilarOrganizacional, async (req, res) => {
  const { pais, departamento, ciudad } = req.body
  const { error } = await supabase.from('pilar_ciudades').insert({ pilar_id: req.params.id, pais, departamento, ciudad })
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})
app.delete('/api/organizacional/pilar/:pilarId/ciudades/:ciudadId', verificarPilarOrganizacional, async (req, res) => {
  const { error } = await supabase.from('pilar_ciudades').delete().eq('id', req.params.ciudadId).eq('pilar_id', req.params.pilarId)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

// ── FINANCIERO ───────────────────────────────────────────────────────────────

const verificarFinanciero = async (req, res, next) => {
  const id = req.headers['x-miembro-id']
  if (!id) return res.status(401).json({ error: 'No autorizado' })
  const { data } = await supabase.from('registros').select('roles, responsabilidades_consejo, ciudad_donde_sirve').eq('id', id).single()
  if (!data) return res.status(401).json({ error: 'No autorizado' })
  const tieneRol = (data.roles || []).includes('responsable_financiero') ||
                   (data.responsabilidades_consejo || []).includes('Financiero')
  if (!tieneRol) return res.status(403).json({ error: 'Solo responsables financieros' })
  req.ciudadFinanciero = data.ciudad_donde_sirve
  next()
}

// Puntos de servicio de la ciudad (para selectores)
app.get('/api/financiero/puntos-servicio', verificarFinanciero, async (req, res) => {
  const { data } = await supabase.from('puntos_servicio')
    .select('id, nombre').eq('activo', true).ilike('ciudad', req.ciudadFinanciero).order('nombre')
  res.json(data || [])
})

// ── Providentes ──
app.get('/api/financiero/providentes', verificarFinanciero, async (req, res) => {
  const { q } = req.query
  let query = supabase.from('providentes').select('*').eq('ciudad', req.ciudadFinanciero).order('nombre')
  if (q) query = query.ilike('nombre', `%${q}%`)
  const { data } = await query
  res.json(data || [])
})

app.post('/api/financiero/providentes', verificarFinanciero, async (req, res) => {
  const { numero_identificacion, nombre, telefono, direccion, correo } = req.body
  if (!numero_identificacion || !nombre) return res.status(400).json({ ok: false, mensaje: 'Cédula y nombre son requeridos' })
  const { data, error } = await supabase.from('providentes')
    .insert({ numero_identificacion, nombre, telefono, direccion, correo, ciudad: req.ciudadFinanciero })
    .select().single()
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true, data })
})

app.put('/api/financiero/providentes/:id', verificarFinanciero, async (req, res) => {
  const { numero_identificacion, nombre, telefono, direccion, correo } = req.body
  const { error } = await supabase.from('providentes').update({ numero_identificacion, nombre, telefono, direccion, correo })
    .eq('id', req.params.id).eq('ciudad', req.ciudadFinanciero)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

app.delete('/api/financiero/providentes/:id', verificarFinanciero, async (req, res) => {
  const { error } = await supabase.from('providentes').delete().eq('id', req.params.id).eq('ciudad', req.ciudadFinanciero)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

// ── Ingresos ──
app.get('/api/financiero/ingresos', verificarFinanciero, async (req, res) => {
  const { mes, anio } = req.query
  let query = supabase.from('ingresos')
    .select('*, providente:providente_id(nombre, correo), punto:punto_servicio_id(nombre), creador:registrado_por(primer_nombre, primer_apellido), editor:editado_por(primer_nombre, primer_apellido)')
    .eq('ciudad', req.ciudadFinanciero).order('fecha', { ascending: false })
  if (mes && anio) {
    const desde = `${anio}-${mes.padStart(2,'0')}-01`
    const hasta = `${anio}-${mes.padStart(2,'0')}-31`
    query = query.gte('fecha', desde).lte('fecha', hasta)
  }
  const { data } = await query
  res.json(data || [])
})

app.post('/api/financiero/ingresos', verificarFinanciero, async (req, res) => {
  const { fecha, providente_id, providente_otro, punto_servicio_id, punto_servicio_otro, tipo, concepto, mes_aporte, valor, comprobante_url, numero_recibo, forma_donacion, cuenta } = req.body
  if (!fecha || !tipo || !concepto || !valor) return res.status(400).json({ ok: false, mensaje: 'Faltan campos requeridos' })
  const id = req.headers['x-miembro-id']
  const psId = punto_servicio_id === '__otro__' ? null : (punto_servicio_id || null)
  const { data, error } = await supabase.from('ingresos')
    .insert({ fecha, providente_id: providente_id || null, providente_otro: providente_otro || null, punto_servicio_id: psId, punto_servicio_otro: punto_servicio_otro || null, tipo, concepto, mes_aporte: mes_aporte || null, valor, comprobante_url: comprobante_url || null, numero_recibo: numero_recibo || null, forma_donacion: forma_donacion || 'dinero', cuenta: cuenta || 'banco', ciudad: req.ciudadFinanciero, registrado_por: id })
    .select().single()
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true, data })
})

app.put('/api/financiero/ingresos/:id', verificarFinanciero, async (req, res) => {
  const { fecha, providente_id, providente_otro, punto_servicio_id, punto_servicio_otro, tipo, concepto, mes_aporte, valor, comprobante_url, numero_recibo, forma_donacion, cuenta } = req.body
  const psId = punto_servicio_id === '__otro__' ? null : (punto_servicio_id || null)
  const editor = req.headers['x-miembro-id']
  const { error } = await supabase.from('ingresos')
    .update({ fecha, providente_id: providente_id || null, providente_otro: providente_otro || null, punto_servicio_id: psId, punto_servicio_otro: punto_servicio_otro || null, tipo, concepto, mes_aporte: mes_aporte || null, valor, comprobante_url: comprobante_url || null, numero_recibo: numero_recibo || null, forma_donacion: forma_donacion || 'dinero', cuenta: cuenta || 'banco', editado_por: editor })
    .eq('id', req.params.id).eq('ciudad', req.ciudadFinanciero)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

app.delete('/api/financiero/ingresos/:id', verificarFinanciero, async (req, res) => {
  const { error } = await supabase.from('ingresos').delete().eq('id', req.params.id).eq('ciudad', req.ciudadFinanciero)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

app.patch('/api/financiero/ingresos/:id/revisado', verificarFinanciero, async (req, res) => {
  const { revisado } = req.body
  const { error } = await supabase.from('ingresos').update({ revisado }).eq('id', req.params.id).eq('ciudad', req.ciudadFinanciero)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

app.patch('/api/financiero/egresos/:id/revisado', verificarFinanciero, async (req, res) => {
  const { revisado } = req.body
  const { error } = await supabase.from('egresos').update({ revisado }).eq('id', req.params.id).eq('ciudad', req.ciudadFinanciero)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

// ── Egresos ──
app.get('/api/financiero/egresos', verificarFinanciero, async (req, res) => {
  const { mes, anio } = req.query
  let query = supabase.from('egresos')
    .select('*, punto:punto_servicio_id(nombre), creador:registrado_por(primer_nombre, primer_apellido), editor:editado_por(primer_nombre, primer_apellido)')
    .eq('ciudad', req.ciudadFinanciero).order('fecha', { ascending: false })
  if (mes && anio) {
    const desde = `${anio}-${mes.padStart(2,'0')}-01`
    const hasta = `${anio}-${mes.padStart(2,'0')}-31`
    query = query.gte('fecha', desde).lte('fecha', hasta)
  }
  const { data } = await query
  res.json(data || [])
})

app.post('/api/financiero/egresos', verificarFinanciero, async (req, res) => {
  const { fecha, punto_servicio_id, punto_servicio_otro, concepto, valor, documento_url, tipo, cuenta } = req.body
  if (!fecha || !concepto || !valor) return res.status(400).json({ ok: false, mensaje: 'Faltan campos requeridos' })
  const id = req.headers['x-miembro-id']
  const psId = punto_servicio_id === '__otro__' ? null : (punto_servicio_id || null)
  const tipoFinal = tipo || 'egreso_servicio'
  const { data, error } = await supabase.from('egresos')
    .insert({ fecha, punto_servicio_id: psId, punto_servicio_otro: punto_servicio_otro || null, concepto, valor, documento_url: documento_url || null, tipo: tipoFinal, es_costo_financiero: tipoFinal === 'costo_financiero', cuenta: cuenta || 'banco', ciudad: req.ciudadFinanciero, registrado_por: id })
    .select().single()
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true, data })
})

app.put('/api/financiero/egresos/:id', verificarFinanciero, async (req, res) => {
  const { fecha, punto_servicio_id, punto_servicio_otro, concepto, valor, documento_url, tipo, cuenta } = req.body
  const psId = punto_servicio_id === '__otro__' ? null : (punto_servicio_id || null)
  const tipoFinal = tipo || 'egreso_servicio'
  const editor = req.headers['x-miembro-id']
  const { error } = await supabase.from('egresos')
    .update({ fecha, punto_servicio_id: psId, punto_servicio_otro: punto_servicio_otro || null, concepto, valor, documento_url: documento_url || null, tipo: tipoFinal, es_costo_financiero: tipoFinal === 'costo_financiero', cuenta: cuenta || 'banco', editado_por: editor })
    .eq('id', req.params.id).eq('ciudad', req.ciudadFinanciero)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

app.delete('/api/financiero/egresos/:id', verificarFinanciero, async (req, res) => {
  const { error } = await supabase.from('egresos').delete().eq('id', req.params.id).eq('ciudad', req.ciudadFinanciero)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

// ── Gestión del rol financiero ──
// ── Consultas ──
app.get('/api/financiero/consulta/aportes-benefactor', verificarFinanciero, async (req, res) => {
  const { providente_id, anio } = req.query
  let query = supabase.from('ingresos')
    .select('*')
    .eq('ciudad', req.ciudadFinanciero)
    .eq('tipo', 'aporte_consagrado')
    .order('fecha', { ascending: true })
  if (providente_id) query = query.eq('providente_id', providente_id)
  if (anio) query = query.gte('fecha', `${anio}-01-01`).lte('fecha', `${anio}-12-31`)
  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json(data || [])
})

app.get('/api/financiero/consulta/movimiento-banco', verificarFinanciero, async (req, res) => {
  const { desde, hasta } = req.query
  if (!desde || !hasta) return res.status(400).json({ error: 'Fechas requeridas' })

  const [{ data: saldoData }, { data: ingHist }, { data: egrHist }, { data: ingresos }, { data: egresos }] = await Promise.all([
    supabase.from('saldos_iniciales').select('saldo').eq('ciudad', req.ciudadFinanciero).eq('cuenta', 'banco').single(),
    supabase.from('ingresos').select('valor').eq('ciudad', req.ciudadFinanciero).eq('cuenta', 'banco').lt('fecha', desde),
    supabase.from('egresos').select('valor').eq('ciudad', req.ciudadFinanciero).eq('cuenta', 'banco').lt('fecha', desde),
    supabase.from('ingresos').select('*, providente:providente_id(nombre), punto:punto_servicio_id(nombre)')
      .eq('ciudad', req.ciudadFinanciero).eq('cuenta', 'banco').gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: true }),
    supabase.from('egresos').select('*, punto:punto_servicio_id(nombre)')
      .eq('ciudad', req.ciudadFinanciero).eq('cuenta', 'banco').gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: true }),
  ])

  const saldoAnterior = Number(saldoData?.saldo || 0)
    + (ingHist || []).reduce((s, r) => s + Number(r.valor), 0)
    - (egrHist || []).reduce((s, r) => s + Number(r.valor), 0)

  let saldo = saldoAnterior
  const movimientos = [
    ...(ingresos || []).map(r => ({ ...r, _tipo: 'ingreso' })),
    ...(egresos || []).map(r => ({ ...r, _tipo: 'egreso' })),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha)).map(r => {
    const esIngreso = r._tipo === 'ingreso'
    saldo += esIngreso ? Number(r.valor) : -Number(r.valor)
    return {
      id: r.id,
      fecha: r.fecha,
      comprobante: r.numero_recibo || r.id?.substring(0, 8) || '',
      benefactor: esIngreso ? (r.providente?.nombre || r.providente_otro || '') : '',
      servicio: r.punto?.nombre || r.punto_servicio_otro || '',
      concepto: r.concepto || '',
      ingreso: esIngreso ? Number(r.valor) : null,
      egreso: esIngreso ? null : Number(r.valor),
      saldo,
    }
  })

  res.json({ saldoAnterior, movimientos })
})

app.get('/api/financiero/consulta/busqueda-concepto', verificarFinanciero, async (req, res) => {
  const { desde, hasta, q } = req.query
  if (!desde || !hasta || !q) return res.status(400).json({ error: 'Parámetros requeridos' })

  const [{ data: ingresos }, { data: egresos }] = await Promise.all([
    supabase.from('ingresos').select('id, fecha, concepto, valor, cuenta, providente:providente_id(nombre), providente_otro')
      .eq('ciudad', req.ciudadFinanciero).gte('fecha', desde).lte('fecha', hasta)
      .ilike('concepto', `%${q}%`).order('fecha', { ascending: true }),
    supabase.from('egresos').select('id, fecha, concepto, valor, cuenta')
      .eq('ciudad', req.ciudadFinanciero).gte('fecha', desde).lte('fecha', hasta)
      .ilike('concepto', `%${q}%`).order('fecha', { ascending: true }),
  ])

  const resultado = [
    ...(ingresos || []).map(r => ({ ...r, _tipo: 'ingreso', benefactor: r.providente?.nombre || r.providente_otro || '' })),
    ...(egresos || []).map(r => ({ ...r, _tipo: 'egreso', benefactor: '' })),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha))

  res.json(resultado)
})

app.get('/api/financiero/consulta/donaciones-especie', verificarFinanciero, async (req, res) => {
  const { desde, hasta } = req.query
  if (!desde || !hasta) return res.status(400).json({ error: 'Fechas requeridas' })

  const { data, error } = await supabase.from('ingresos')
    .select('id, fecha, concepto, valor, providente:providente_id(nombre), providente_otro, punto:punto_servicio_id(nombre), punto_servicio_otro')
    .eq('ciudad', req.ciudadFinanciero)
    .eq('cuenta', 'especie')
    .gte('fecha', desde).lte('fecha', hasta)
    .order('fecha', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })
  res.json(data || [])
})

app.post('/api/financiero/enviar-recibo/:id', verificarFinanciero, async (req, res) => {
  try {
    const { data: ingreso } = await supabase.from('ingresos')
      .select('*, providente:providente_id(nombre, correo, numero_identificacion, telefono, direccion)')
      .eq('id', req.params.id).eq('ciudad', req.ciudadFinanciero).single()
    if (!ingreso) return res.status(404).json({ ok: false, mensaje: 'Ingreso no encontrado' })

    const correo = ingreso.providente?.correo
    if (!correo) return res.status(400).json({ ok: false, mensaje: 'El benefactor no tiene correo registrado' })

    const [{ data: cfg }, { data: user }, logo] = await Promise.all([
      supabase.from('config_ciudad').select('cuenta_bancaria').eq('ciudad', req.ciudadFinanciero).single(),
      supabase.from('registros').select('primer_nombre, primer_apellido, correo_electronico').eq('id', req.headers['x-miembro-id']).single(),
      getLogoBuffer(),
    ])
    const receptor = user ? `${user.primer_nombre} ${user.primer_apellido}` : ''
    const correoReceptor = user?.correo_electronico || null

    const pdfBuffer = await new Promise((resolve, reject) => {
      const chunks = []
      const doc = new PDFDocument({ size: 'LETTER', margin: 0 })
      doc.on('data', c => chunks.push(c))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)
      generarReciboPDF(doc, ingreso, cfg || {}, receptor, logo)
      doc.end()
    })

    const nombre = ingreso.providente?.nombre || ingreso.providente_otro || 'Benefactor'
    const numRecibo = ingreso.numero_recibo || ingreso.id.substring(0, 8)

    const emailPayload = {
      from: 'Servidores del Servidor <amgarcia@servidoresdelservidor.org>',
      to: correo,
      subject: `Recibo de donación No. ${numRecibo} — Gracias por tu generosidad`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="color: #1e3a5f; margin-bottom: 4px;">Asociación Privada de Fieles Laicos</h2>
            <p style="color: #666; font-size: 13px; margin: 0;">"Donum Christi — Comunidad Apostólica Servidores del Servidor"</p>
          </div>

          <p style="font-size: 15px;">Estimado/a <strong>${nombre}</strong>,</p>

          <p style="font-size: 15px; line-height: 1.6;">
            Con gratitud y alegría confirmamos la recepción de tu donación registrada con el recibo <strong>No. ${numRecibo}</strong>.
            Tu generosidad es un testimonio vivo del amor de Dios hacia los más necesitados y un pilar fundamental
            para nuestra misión.
          </p>

          <blockquote style="border-left: 4px solid #1e3a5f; margin: 24px 0; padding: 12px 20px; background: #f0f4f8; border-radius: 0 8px 8px 0;">
            <p style="font-style: italic; font-size: 15px; color: #1e3a5f; margin: 0 0 8px 0;">
              "El que da al pobre, presta a Dios — y Dios nunca queda en deuda con nadie."
            </p>
            <p style="font-size: 13px; color: #666; margin: 0;">— San Padre Pío de Pietrelcina</p>
          </blockquote>

          <p style="font-size: 15px; line-height: 1.6;">
            Adjunto encontrarás el recibo de tu donación. Que el Señor y nuestro querido Padre Pío te colmen de bendiciones.
          </p>

          <p style="font-size: 14px; color: #666; margin-top: 32px;">
            Con gratitud,<br>
            Área Financiera
          </p>
        </div>
      `,
      attachments: [{
        filename: `recibo_${numRecibo}.pdf`,
        content: pdfBuffer.toString('base64'),
      }],
    }
    if (correoReceptor) emailPayload.reply_to = correoReceptor
    await resend.emails.send(emailPayload)

    res.json({ ok: true, mensaje: `Recibo enviado a ${correo}` })
  } catch (err) {
    console.error('Error enviando recibo:', err)
    res.status(500).json({ ok: false, mensaje: err.message })
  }
})

app.get('/api/financiero/proximo-recibo', verificarFinanciero, async (req, res) => {
  const { data } = await supabase.from('ingresos')
    .select('numero_recibo')
    .eq('ciudad', req.ciudadFinanciero)
    .not('numero_recibo', 'is', null)
  const max = (data || []).reduce((m, r) => {
    const n = parseInt(r.numero_recibo)
    return isNaN(n) ? m : Math.max(m, n)
  }, 0)
  res.json({ proximo: max > 0 ? max + 1 : null })
})

// ── Reportes Excel ──
app.get('/api/financiero/reporte/aportes-consagrados', verificarFinanciero, async (req, res) => {
  const { mes, anio } = req.query
  if (!mes || !anio) return res.status(400).json({ error: 'Mes y año requeridos' })

  const desde = `${anio}-${mes.padStart(2,'0')}-01`
  const hasta = `${anio}-${mes.padStart(2,'0')}-31`
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const nombreMes = MESES[parseInt(mes) - 1]

  const { data } = await supabase.from('ingresos')
    .select('*, providente:providente_id(nombre)')
    .eq('ciudad', req.ciudadFinanciero)
    .eq('tipo', 'aporte_consagrado')
    .gte('fecha', desde).lte('fecha', hasta)
    .order('providente_id', { ascending: true })

  const registros = (data || []).sort((a, b) => {
    const na = a.providente?.nombre || a.providente_otro || ''
    const nb = b.providente?.nombre || b.providente_otro || ''
    return na.localeCompare(nb)
  })

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Aportes Consagrados')

  // Título
  ws.mergeCells('A1:E1')
  ws.getCell('A1').value = `RELACIÓN APORTES CONSAGRADOS — ${nombreMes.toUpperCase()} ${anio}`
  ws.getCell('A1').font = { bold: true, size: 13 }
  ws.getCell('A1').alignment = { horizontal: 'center' }
  ws.getRow(1).height = 22

  ws.mergeCells('A2:E2')
  ws.getCell('A2').value = `Ciudad: ${req.ciudadFinanciero}`
  ws.getCell('A2').font = { italic: true, size: 10 }
  ws.getCell('A2').alignment = { horizontal: 'center' }

  ws.addRow([])

  // Encabezados
  const hRow = ws.addRow(['#', 'Fecha', 'N° Recibo', 'Benefactor', 'Mes del aporte', 'Valor'])
  hRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }
    cell.alignment = { horizontal: 'center' }
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF000000' } } }
  })

  // Datos
  let total = 0
  registros.forEach((r, i) => {
    const nombre = r.providente?.nombre || r.providente_otro || '—'
    const row = ws.addRow([
      i + 1,
      r.fecha,
      r.numero_recibo || '',
      nombre,
      r.mes_aporte || '',
      Number(r.valor)
    ])
    row.getCell(6).numFmt = '$#,##0.00'
    row.getCell(6).alignment = { horizontal: 'right' }
    if (i % 2 === 1) {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7FA' } }
      })
    }
    total += Number(r.valor)
  })

  // Total
  ws.addRow([])
  const tRow = ws.addRow(['', '', '', '', 'TOTAL', total])
  tRow.getCell(5).font = { bold: true }
  tRow.getCell(5).alignment = { horizontal: 'right' }
  tRow.getCell(6).numFmt = '$#,##0.00'
  tRow.getCell(6).font = { bold: true }
  tRow.getCell(6).alignment = { horizontal: 'right' }

  // Anchos de columna
  ws.getColumn(1).width = 5
  ws.getColumn(2).width = 14
  ws.getColumn(3).width = 12
  ws.getColumn(4).width = 35
  ws.getColumn(5).width = 18
  ws.getColumn(6).width = 16

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="aportes_consagrados_${nombreMes}_${anio}.xlsx"`)
  await wb.xlsx.write(res)
  res.end()
})

app.get('/api/financiero/reporte/donaciones', verificarFinanciero, async (req, res) => {
  const { mes, anio } = req.query
  if (!mes || !anio) return res.status(400).json({ error: 'Mes y año requeridos' })

  const desde = `${anio}-${mes.padStart(2,'0')}-01`
  const hasta = `${anio}-${mes.padStart(2,'0')}-31`
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const nombreMes = MESES[parseInt(mes) - 1]

  const { data } = await supabase.from('ingresos')
    .select('*, providente:providente_id(nombre, telefono), punto:punto_servicio_id(nombre)')
    .eq('ciudad', req.ciudadFinanciero)
    .eq('tipo', 'donacion_servicio')
    .gte('fecha', desde).lte('fecha', hasta)
    .order('numero_recibo', { ascending: true })

  const registros = data || []
  const especie = registros.filter(r => r.forma_donacion === 'especie')
  const dinero  = registros.filter(r => r.forma_donacion !== 'especie')

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Donaciones')

  const HEADER_COLOR = 'FF1E3A5F'
  const HEADER_FONT  = { bold: true, color: { argb: 'FFFFFFFF' } }
  const COLS = ['Fecha', 'N° Comprobante', 'Valor', 'Servicio', 'Donante', 'Teléfono']
  const WIDTHS = [14, 16, 16, 28, 35, 16]

  // Título principal
  ws.mergeCells('A1:F1')
  ws.getCell('A1').value = `RELACIÓN DE DONACIONES — ${nombreMes.toUpperCase()} ${anio}`
  ws.getCell('A1').font = { bold: true, size: 13 }
  ws.getCell('A1').alignment = { horizontal: 'center' }
  ws.getRow(1).height = 22

  ws.mergeCells('A2:F2')
  ws.getCell('A2').value = `Ciudad: ${req.ciudadFinanciero}`
  ws.getCell('A2').font = { italic: true, size: 10 }
  ws.getCell('A2').alignment = { horizontal: 'center' }

  const addSeccion = (titulo, filas) => {
    ws.addRow([])
    const tRow = ws.addRow([titulo])
    ws.mergeCells(`A${tRow.number}:F${tRow.number}`)
    tRow.getCell(1).font = { bold: true, size: 11, color: { argb: 'FF1E3A5F' } }
    tRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } }
    tRow.height = 18

    const hRow = ws.addRow(COLS)
    hRow.eachCell(cell => {
      cell.font = HEADER_FONT
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_COLOR } }
      cell.alignment = { horizontal: 'center' }
    })

    let subtotal = 0
    filas.forEach((r, i) => {
      const servicio = r.punto?.nombre || r.punto_servicio_otro || '—'
      const donante  = r.providente?.nombre || r.providente_otro || '—'
      const telefono = r.providente?.telefono || ''
      const row = ws.addRow([r.fecha, r.numero_recibo || '', Number(r.valor), servicio, donante, telefono])
      row.getCell(3).numFmt = '$#,##0.00'
      row.getCell(3).alignment = { horizontal: 'right' }
      if (i % 2 === 1) row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7FA' } } })
      subtotal += Number(r.valor)
    })

    const stRow = ws.addRow(['', '', subtotal, `Subtotal ${titulo}`, '', ''])
    stRow.getCell(2).value = 'Subtotal'
    stRow.getCell(3).numFmt = '$#,##0.00'
    stRow.getCell(3).font = { bold: true }
    stRow.getCell(3).alignment = { horizontal: 'right' }
    stRow.getCell(4).font = { bold: true }
    return subtotal
  }

  const totEspecie = addSeccion('Donaciones en Especie', especie)
  const totDinero  = addSeccion('Donaciones en Dinero', dinero)

  ws.addRow([])
  const tRow = ws.addRow(['', '', totEspecie + totDinero, 'TOTAL GENERAL', '', ''])
  tRow.getCell(3).numFmt = '$#,##0.00'
  tRow.getCell(3).font = { bold: true, size: 11 }
  tRow.getCell(3).alignment = { horizontal: 'right' }
  tRow.getCell(4).font = { bold: true, size: 11 }

  WIDTHS.forEach((w, i) => { ws.getColumn(i + 1).width = w })

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="donaciones_${nombreMes}_${anio}.xlsx"`)
  await wb.xlsx.write(res)
  res.end()
})

const generarReporteMovimiento = async (req, res, cuenta, tituloLabel, nombreArchivo) => {
  const { mes, anio } = req.query
  if (!mes || !anio) return res.status(400).json({ error: 'Mes y año requeridos' })

  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const nombreMes = MESES[parseInt(mes) - 1]
  const desde = `${anio}-${mes.padStart(2,'0')}-01`
  const hasta = `${anio}-${mes.padStart(2,'0')}-31`

  const [{ data: saldoData }, { data: ingHist }, { data: egrHist }, { data: ingresos }, { data: egresos }] = await Promise.all([
    supabase.from('saldos_iniciales').select('saldo').eq('ciudad', req.ciudadFinanciero).eq('cuenta', cuenta).single(),
    supabase.from('ingresos').select('valor').eq('ciudad', req.ciudadFinanciero).eq('cuenta', cuenta).lt('fecha', desde),
    supabase.from('egresos').select('valor').eq('ciudad', req.ciudadFinanciero).eq('cuenta', cuenta).lt('fecha', desde),
    supabase.from('ingresos').select('*').eq('ciudad', req.ciudadFinanciero).eq('cuenta', cuenta).gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: true }),
    supabase.from('egresos').select('*').eq('ciudad', req.ciudadFinanciero).eq('cuenta', cuenta).gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: true }),
  ])

  const saldoInicial = Number(saldoData?.saldo || 0)
  const totalIngHist = (ingHist || []).reduce((s, r) => s + Number(r.valor), 0)
  const totalEgrHist = (egrHist || []).reduce((s, r) => s + Number(r.valor), 0)
  let saldo = saldoInicial + totalIngHist - totalEgrHist

  const movimientos = [
    ...(ingresos || []).map(r => ({ ...r, _tipo: 'ingreso' })),
    ...(egresos || []).map(r => ({ ...r, _tipo: 'egreso' })),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha))

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(tituloLabel)

  ws.mergeCells('A1:E1')
  ws.getCell('A1').value = `${tituloLabel.toUpperCase()} — ${nombreMes.toUpperCase()} ${anio}`
  ws.getCell('A1').font = { bold: true, size: 13 }
  ws.getCell('A1').alignment = { horizontal: 'center' }
  ws.getRow(1).height = 22

  ws.mergeCells('A2:E2')
  ws.getCell('A2').value = `Ciudad: ${req.ciudadFinanciero}`
  ws.getCell('A2').font = { italic: true, size: 10 }
  ws.getCell('A2').alignment = { horizontal: 'center' }
  ws.addRow([])

  const hRow = ws.addRow(['Fecha', 'Concepto', 'Ingreso', 'Egreso', 'Saldo'])
  hRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }
    cell.alignment = { horizontal: 'center' }
  })

  const saRow = ws.addRow(['', 'Saldo anterior', '', '', saldo])
  saRow.getCell(2).font = { italic: true }
  saRow.getCell(5).numFmt = '$#,##0.00'
  saRow.getCell(5).font = { bold: true, italic: true }
  saRow.getCell(5).alignment = { horizontal: 'right' }

  movimientos.forEach((r, i) => {
    const esIngreso = r._tipo === 'ingreso'
    saldo += esIngreso ? Number(r.valor) : -Number(r.valor)
    const row = ws.addRow([r.fecha, r.concepto || '', esIngreso ? Number(r.valor) : null, esIngreso ? null : Number(r.valor), saldo])
    row.getCell(3).numFmt = '$#,##0.00'; row.getCell(3).alignment = { horizontal: 'right' }
    row.getCell(4).numFmt = '$#,##0.00'; row.getCell(4).alignment = { horizontal: 'right' }
    row.getCell(5).numFmt = '$#,##0.00'; row.getCell(5).alignment = { horizontal: 'right' }
    if (esIngreso) row.getCell(3).font = { color: { argb: 'FF1A7A3C' } }
    else row.getCell(4).font = { color: { argb: 'FFCC2200' } }
    if (i % 2 === 1) row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7FA' } } })
  })

  ws.addRow([])
  const tRow = ws.addRow(['', 'Saldo final', '', '', saldo])
  tRow.getCell(2).font = { bold: true }
  tRow.getCell(5).numFmt = '$#,##0.00'
  tRow.getCell(5).font = { bold: true }
  tRow.getCell(5).alignment = { horizontal: 'right' }

  ws.getColumn(1).width = 14; ws.getColumn(2).width = 40
  ws.getColumn(3).width = 16; ws.getColumn(4).width = 16; ws.getColumn(5).width = 16

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}_${nombreMes}_${anio}.xlsx"`)
  await wb.xlsx.write(res)
  res.end()
}

app.get('/api/financiero/reporte/movimiento-banco', verificarFinanciero, async (req, res) => {
  const { mes, anio } = req.query
  if (!mes || !anio) return res.status(400).json({ error: 'Mes y año requeridos' })

  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const nombreMes = MESES[parseInt(mes) - 1]
  const desde = `${anio}-${mes.padStart(2,'0')}-01`
  const hasta = `${anio}-${mes.padStart(2,'0')}-31`

  const [{ data: saldoData }, { data: ingHist }, { data: egrHist }, { data: ingresos }, { data: egresos }] = await Promise.all([
    supabase.from('saldos_iniciales').select('saldo').eq('ciudad', req.ciudadFinanciero).eq('cuenta', 'banco').single(),
    supabase.from('ingresos').select('valor').eq('ciudad', req.ciudadFinanciero).eq('cuenta', 'banco').lt('fecha', desde),
    supabase.from('egresos').select('valor').eq('ciudad', req.ciudadFinanciero).eq('cuenta', 'banco').lt('fecha', desde),
    supabase.from('ingresos').select('*, providente:providente_id(nombre), punto:punto_servicio_id(nombre)')
      .eq('ciudad', req.ciudadFinanciero).eq('cuenta', 'banco').gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: true }),
    supabase.from('egresos').select('*, punto:punto_servicio_id(nombre)')
      .eq('ciudad', req.ciudadFinanciero).eq('cuenta', 'banco').gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: true }),
  ])

  const saldoInicial = Number(saldoData?.saldo || 0)
  let saldo = saldoInicial
    + (ingHist || []).reduce((s, r) => s + Number(r.valor), 0)
    - (egrHist || []).reduce((s, r) => s + Number(r.valor), 0)

  const movimientos = [
    ...(ingresos || []).map(r => ({ ...r, _tipo: 'ingreso' })),
    ...(egresos || []).map(r => ({ ...r, _tipo: 'egreso' })),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha))

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Movimiento Banco')

  ws.mergeCells('A1:H1')
  ws.getCell('A1').value = `MOVIMIENTO BANCO — ${nombreMes.toUpperCase()} ${anio}`
  ws.getCell('A1').font = { bold: true, size: 13 }
  ws.getCell('A1').alignment = { horizontal: 'center' }
  ws.getRow(1).height = 22

  ws.mergeCells('A2:H2')
  ws.getCell('A2').value = `Ciudad: ${req.ciudadFinanciero}`
  ws.getCell('A2').font = { italic: true, size: 10 }
  ws.getCell('A2').alignment = { horizontal: 'center' }
  ws.addRow([])

  const hRow = ws.addRow(['Fecha', 'N° Comprobante', 'Benefactor', 'Servicio', 'Concepto', 'Ingreso', 'Egreso', 'Saldo'])
  hRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }
    cell.alignment = { horizontal: 'center' }
  })

  const saRow = ws.addRow(['', '', '', '', 'Saldo anterior', '', '', saldo])
  saRow.getCell(5).font = { italic: true }
  saRow.getCell(8).numFmt = '$#,##0.00'
  saRow.getCell(8).font = { bold: true, italic: true }
  saRow.getCell(8).alignment = { horizontal: 'right' }

  movimientos.forEach((r, i) => {
    const esIngreso = r._tipo === 'ingreso'
    saldo += esIngreso ? Number(r.valor) : -Number(r.valor)
    const benefactor = esIngreso ? (r.providente?.nombre || r.providente_otro || '') : ''
    const servicio = r.punto?.nombre || r.punto_servicio_otro || ''
    const comprobante = r.numero_recibo || r.id?.substring(0, 8) || ''
    const row = ws.addRow([
      r.fecha, comprobante, benefactor, servicio, r.concepto || '',
      esIngreso ? Number(r.valor) : null,
      esIngreso ? null : Number(r.valor),
      saldo
    ])
    row.getCell(6).numFmt = '$#,##0.00'; row.getCell(6).alignment = { horizontal: 'right' }
    row.getCell(7).numFmt = '$#,##0.00'; row.getCell(7).alignment = { horizontal: 'right' }
    row.getCell(8).numFmt = '$#,##0.00'; row.getCell(8).alignment = { horizontal: 'right' }
    if (esIngreso) row.getCell(6).font = { color: { argb: 'FF1A7A3C' } }
    else row.getCell(7).font = { color: { argb: 'FFCC2200' } }
    if (i % 2 === 1) row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7FA' } } })
  })

  ws.addRow([])
  const tRow = ws.addRow(['', '', '', '', 'Saldo final', '', '', saldo])
  tRow.getCell(5).font = { bold: true }
  tRow.getCell(8).numFmt = '$#,##0.00'
  tRow.getCell(8).font = { bold: true }
  tRow.getCell(8).alignment = { horizontal: 'right' }

  ws.getColumn(1).width = 14; ws.getColumn(2).width = 16; ws.getColumn(3).width = 30
  ws.getColumn(4).width = 25; ws.getColumn(5).width = 30
  ws.getColumn(6).width = 16; ws.getColumn(7).width = 16; ws.getColumn(8).width = 16

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="movimiento_banco_${nombreMes}_${anio}.xlsx"`)
  await wb.xlsx.write(res)
  res.end()
})

app.get('/api/financiero/reporte/movimiento-caja-menor', verificarFinanciero, (req, res) =>
  generarReporteMovimiento(req, res, 'caja_menor', 'Movimiento Caja Menor', 'movimiento_caja_menor'))

app.get('/api/financiero/reporte/consumo-caja-menor', verificarFinanciero, async (req, res) => {
  const { mes, anio } = req.query
  if (!mes || !anio) return res.status(400).json({ error: 'Mes y año requeridos' })

  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const nombreMes = MESES[parseInt(mes) - 1]
  const desde = `${anio}-${mes.padStart(2,'0')}-01`
  const hasta = `${anio}-${mes.padStart(2,'0')}-31`

  const [{ data: saldoData }, { data: ingHist }, { data: egrHist }, { data: ingresos }, { data: egresos }] = await Promise.all([
    supabase.from('saldos_iniciales').select('saldo').eq('ciudad', req.ciudadFinanciero).eq('cuenta', 'consumo_caja_menor').single(),
    supabase.from('ingresos').select('valor').eq('ciudad', req.ciudadFinanciero).eq('cuenta', 'consumo_caja_menor').lt('fecha', desde),
    supabase.from('egresos').select('valor').eq('ciudad', req.ciudadFinanciero).eq('cuenta', 'consumo_caja_menor').lt('fecha', desde),
    supabase.from('ingresos').select('*').eq('ciudad', req.ciudadFinanciero).eq('cuenta', 'consumo_caja_menor').gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: true }),
    supabase.from('egresos').select('*, punto:punto_servicio_id(nombre)').eq('ciudad', req.ciudadFinanciero).eq('cuenta', 'consumo_caja_menor').gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: true }),
  ])

  const saldoInicial = Number(saldoData?.saldo || 0)
  let saldo = saldoInicial
    + (ingHist || []).reduce((s, r) => s + Number(r.valor), 0)
    - (egrHist || []).reduce((s, r) => s + Number(r.valor), 0)

  const movimientos = [
    ...(ingresos || []).map(r => ({ ...r, _tipo: 'ingreso' })),
    ...(egresos || []).map(r => ({ ...r, _tipo: 'egreso' })),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha))

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Consumo Caja Menor')

  ws.mergeCells('A1:F1')
  ws.getCell('A1').value = `CONSUMO CAJA MENOR — ${nombreMes.toUpperCase()} ${anio}`
  ws.getCell('A1').font = { bold: true, size: 13 }
  ws.getCell('A1').alignment = { horizontal: 'center' }
  ws.getRow(1).height = 22

  ws.mergeCells('A2:F2')
  ws.getCell('A2').value = `Ciudad: ${req.ciudadFinanciero}`
  ws.getCell('A2').font = { italic: true, size: 10 }
  ws.getCell('A2').alignment = { horizontal: 'center' }
  ws.addRow([])

  const hRow = ws.addRow(['Fecha', 'Servicio', 'Concepto', 'Ingreso', 'Egreso', 'Saldo'])
  hRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }
    cell.alignment = { horizontal: 'center' }
  })

  const saRow = ws.addRow(['', '', 'Saldo anterior', '', '', saldo])
  saRow.getCell(3).font = { italic: true }
  saRow.getCell(6).numFmt = '$#,##0.00'
  saRow.getCell(6).font = { bold: true, italic: true }
  saRow.getCell(6).alignment = { horizontal: 'right' }

  movimientos.forEach((r, i) => {
    const esIngreso = r._tipo === 'ingreso'
    saldo += esIngreso ? Number(r.valor) : -Number(r.valor)
    const servicio = esIngreso ? '' : (r.punto?.nombre || r.punto_servicio_otro || '')
    const row = ws.addRow([r.fecha, servicio, r.concepto || '', esIngreso ? Number(r.valor) : null, esIngreso ? null : Number(r.valor), saldo])
    row.getCell(4).numFmt = '$#,##0.00'; row.getCell(4).alignment = { horizontal: 'right' }
    row.getCell(5).numFmt = '$#,##0.00'; row.getCell(5).alignment = { horizontal: 'right' }
    row.getCell(6).numFmt = '$#,##0.00'; row.getCell(6).alignment = { horizontal: 'right' }
    if (esIngreso) row.getCell(4).font = { color: { argb: 'FF1A7A3C' } }
    else row.getCell(5).font = { color: { argb: 'FFCC2200' } }
    if (i % 2 === 1) row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7FA' } } })
  })

  ws.addRow([])
  const tRow = ws.addRow(['', '', 'Saldo final', '', '', saldo])
  tRow.getCell(3).font = { bold: true }
  tRow.getCell(6).numFmt = '$#,##0.00'
  tRow.getCell(6).font = { bold: true }
  tRow.getCell(6).alignment = { horizontal: 'right' }

  ws.getColumn(1).width = 14; ws.getColumn(2).width = 25; ws.getColumn(3).width = 35
  ws.getColumn(4).width = 16; ws.getColumn(5).width = 16; ws.getColumn(6).width = 16

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="consumo_caja_menor_${nombreMes}_${anio}.xlsx"`)
  await wb.xlsx.write(res)
  res.end()
})

// ── Saldo inicial por cuenta ──
app.get('/api/financiero/saldo-inicial', verificarFinanciero, async (req, res) => {
  const { cuenta } = req.query
  const { data } = await supabase.from('saldos_iniciales')
    .select('saldo').eq('ciudad', req.ciudadFinanciero).eq('cuenta', cuenta).single()
  res.json({ saldo: data?.saldo || 0 })
})

app.put('/api/financiero/saldo-inicial', verificarFinanciero, async (req, res) => {
  const { cuenta, saldo } = req.body
  const { error } = await supabase.from('saldos_iniciales')
    .upsert({ ciudad: req.ciudadFinanciero, cuenta, saldo }, { onConflict: 'ciudad,cuenta' })
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

app.get('/api/financiero/totales-cuenta', verificarFinanciero, async (req, res) => {
  const { cuenta, hasta } = req.query
  let ingQ = supabase.from('ingresos').select('valor').eq('ciudad', req.ciudadFinanciero).eq('cuenta', cuenta)
  let egrQ = supabase.from('egresos').select('valor').eq('ciudad', req.ciudadFinanciero).eq('cuenta', cuenta)
  if (hasta) { ingQ = ingQ.lt('fecha', hasta); egrQ = egrQ.lt('fecha', hasta) }
  const [{ data: ing }, { data: egr }] = await Promise.all([ingQ, egrQ])
  const totalIngresos = (ing || []).reduce((s, i) => s + Number(i.valor), 0)
  const totalEgresos = (egr || []).reduce((s, e) => s + Number(e.valor), 0)
  res.json({ totalIngresos, totalEgresos })
})

app.get('/api/financiero/equipo', verificarFinanciero, async (req, res) => {
  const { data } = await supabase.from('registros')
    .select('id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, numero_identificacion, roles')
    .ilike('ciudad_donde_sirve', req.ciudadFinanciero)
  const equipo = (data || []).filter(r => (r.roles || []).includes('responsable_financiero'))
  res.json(equipo)
})

app.get('/api/financiero/buscar-servidor', verificarFinanciero, async (req, res) => {
  const { q } = req.query
  if (!q) return res.json([])
  const { data } = await supabase.from('registros')
    .select('id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, numero_identificacion, roles')
    .ilike('ciudad_donde_sirve', req.ciudadFinanciero)
    .or(`primer_apellido.ilike.%${q}%,primer_nombre.ilike.%${q}%,numero_identificacion.ilike.%${q}%`)
    .limit(8)
  res.json(data || [])
})

app.put('/api/financiero/asignar-rol/:id', verificarFinanciero, async (req, res) => {
  const { data: reg } = await supabase.from('registros').select('roles').eq('id', req.params.id).single()
  const roles = reg?.roles || []
  if (roles.includes('responsable_financiero')) return res.json({ ok: true })
  const { error } = await supabase.from('registros').update({ roles: [...roles, 'responsable_financiero'] }).eq('id', req.params.id)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

app.put('/api/financiero/quitar-rol/:id', verificarFinanciero, async (req, res) => {
  const { data: reg } = await supabase.from('registros').select('roles').eq('id', req.params.id).single()
  const roles = (reg?.roles || []).filter(r => r !== 'responsable_financiero')
  const { error } = await supabase.from('registros').update({ roles }).eq('id', req.params.id)
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

// ── Helpers recibo PDF ──
const LOGO_URL = 'https://gvdgqwxbkcauephznqfd.supabase.co/storage/v1/object/public/Comprobantes/Logos/Logo%20Servidores.jpg'
let logoBuffer = null
async function getLogoBuffer() {
  if (logoBuffer) return logoBuffer
  try {
    const https = require('https')
    logoBuffer = await new Promise((resolve, reject) => {
      https.get(LOGO_URL, (r) => {
        const chunks = []
        r.on('data', c => chunks.push(c))
        r.on('end', () => resolve(Buffer.concat(chunks)))
        r.on('error', reject)
      }).on('error', reject)
    })
    return logoBuffer
  } catch (e) {
    console.error('Error descargando logo:', e.message)
    return null
  }
}

const UNIDADES = ['','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez','once','doce','trece','catorce','quince','dieciséis','diecisiete','dieciocho','diecinueve']
const DECENAS  = ['','','veinte','treinta','cuarenta','cincuenta','sesenta','setenta','ochenta','noventa']
const CENTENAS = ['','ciento','doscientos','trescientos','cuatrocientos','quinientos','seiscientos','setecientos','ochocientos','novecientos']

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

function generarReciboPDF(doc, ingreso, config, receptor, logo) {
  const M = 40
  const W = 515
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const fecha = new Date(ingreso.fecha + 'T12:00:00')
  const dia = String(fecha.getDate()).padStart(2,'0')
  const mes = String(fecha.getMonth()+1).padStart(2,'0')
  const anio = fecha.getFullYear()

  // ── Logo ──
  if (logo) doc.image(logo, M, 38, { width: 65, height: 65 })

  // ── Encabezado ──
  doc.fontSize(9).font('Helvetica-Bold')
    .text('Asociación Privada de Fieles Laicos', M+70, 42, { width: 330, align: 'center' })
  doc.fontSize(7.5).font('Helvetica-Bold')
    .text('"Donum Christi Comunidad Apostólica Servidores del Servidor hijos di Padre Pío"', M+70, 54, { width: 330, align: 'center' })
  doc.fontSize(9).font('Helvetica-Bold')
    .text('NIT. 900.049.867-5', M+70, 67, { width: 330, align: 'center' })

  // No. recibo (caja superior derecha)
  doc.rect(430, 40, 125, 24).stroke()
  doc.fontSize(9).font('Helvetica-Bold').text('No.', 435, 47)
  doc.fontSize(12).font('Helvetica-Bold').fillColor('red').text(ingreso.numero_recibo || '—', 460, 45, { width: 90, align: 'center' })
  doc.fillColor('black')

  // Caja fecha
  doc.rect(430, 68, 125, 36).stroke()
  doc.rect(430, 68, 125, 14).stroke()
  doc.fontSize(8).font('Helvetica-Bold').text('FECHA', 430, 70, { width: 125, align: 'center' })
  doc.rect(430, 82, 42, 22).stroke()
  doc.rect(472, 82, 42, 22).stroke()
  doc.rect(514, 82, 41, 22).stroke()
  doc.fontSize(7).font('Helvetica').text('DIA', 430, 84, { width: 42, align: 'center' })
    .text('MES', 472, 84, { width: 42, align: 'center' })
    .text('AÑO', 514, 84, { width: 41, align: 'center' })
  doc.fontSize(9).font('Helvetica-Bold')
    .text(dia, 430, 93, { width: 42, align: 'center' })
    .text(mes, 472, 93, { width: 42, align: 'center' })
    .text(String(anio), 514, 93, { width: 41, align: 'center' })

  // ── Sección benefactor ──
  const BY = 130
  doc.roundedRect(M, BY, W, 90, 4).stroke()
  doc.moveTo(M, BY+30).lineTo(M+W, BY+30).stroke()
  doc.moveTo(M, BY+60).lineTo(M+W, BY+60).stroke()
  doc.moveTo(M+310, BY).lineTo(M+310, BY+90).stroke()

  const nombre = ingreso.providente?.nombre || ingreso.providente_otro || '—'
  const cc = ingreso.providente?.numero_identificacion || ''
  const dir = ingreso.providente?.direccion || ''
  const tel = ingreso.providente?.telefono || ''
  const email = ingreso.providente?.correo || ''

  doc.fontSize(7).font('Helvetica-Bold').text('NOMBRE / RAZON SOCIAL', M+5, BY+4)
  doc.fontSize(9).font('Helvetica').text(nombre, M+5, BY+16)
  doc.fontSize(7).font('Helvetica-Bold').text('CÉDULA / NIT', M+315, BY+4)
  doc.fontSize(9).font('Helvetica').text(cc, M+315, BY+16, { width: 200, align: 'center' })
  doc.fontSize(7).font('Helvetica-Bold').text('DIRECCIÓN', M+5, BY+34)
  doc.fontSize(9).font('Helvetica').text(dir, M+5, BY+45)
  doc.fontSize(7).font('Helvetica-Bold').text('TELÉFONO', M+315, BY+34)
  doc.fontSize(9).font('Helvetica').text(tel, M+315, BY+48, { width: 200, align: 'center' })
  doc.fontSize(7).font('Helvetica-Bold').text('EMAIL', M+5, BY+64)
  doc.fontSize(9).font('Helvetica').text(email, M+5, BY+75)

  // ── Sección donación ──
  const DY = 235
  const esEspecie = ingreso.forma_donacion === 'especie'
  const esBanco   = ingreso.cuenta === 'banco'

  doc.fontSize(8).font('Helvetica-Bold').text('DONACIÓN EN:', M, DY+5)
  doc.fontSize(7).font('Helvetica')
  // checkboxes
  const cbX = M+5
  doc.rect(cbX, DY+18, 9, 9).stroke().text('ESPECIE',  cbX+12, DY+19)
  doc.rect(cbX, DY+31, 9, 9).stroke().text('EFECTIVO', cbX+12, DY+32)
  doc.rect(cbX, DY+44, 9, 9).stroke().text('BANCO',    cbX+12, DY+45)
  doc.fontSize(8).font('Helvetica-Bold')
  if (esEspecie) doc.text('X', cbX+1, DY+19)
  else if (esBanco) doc.text('X', cbX+1, DY+45)
  else doc.text('X', cbX+1, DY+32)

  // Valor y suma en letras
  doc.roundedRect(M+90, DY+10, 340, 45, 3).stroke()
  const valor = Number(ingreso.valor)
  const fmtVal = new Intl.NumberFormat('es-CO').format(valor)
  doc.fontSize(14).font('Helvetica-Bold').text(`$ ${fmtVal}`, M+95, DY+16, { width: 100 })
  doc.fontSize(8).font('Helvetica-Bold').text('LA SUMA DE', M+200, DY+16)
  doc.fontSize(8).font('Helvetica').text(capitalize(numLetras(valor)) + ' Pesos', M+200, DY+28, { width: 225 })

  // Concepto
  const CY = DY + 65
  doc.roundedRect(M, CY, W, 28, 3).stroke()
  doc.fontSize(8).font('Helvetica-Bold').text('CONCEPTO', M+5, CY+4)
  doc.fontSize(9).font('Helvetica').text(ingreso.concepto || '', M+80, CY+4)

  // ── Footer ──
  const FY = CY + 40
  doc.roundedRect(M, FY, 130, 40, 3).stroke()
  doc.fontSize(7).font('Helvetica-Bold').text('NOMBRE DE QUIEN RECIBE', M+5, FY+5)
  doc.fontSize(9).font('Helvetica').text(receptor || '', M+5, FY+18)

  doc.fontSize(7).font('Helvetica')
    .text(config.cuenta_bancaria || '', M+145, FY+2, { width: 220 })
    .text(`Oficina Carrera 20 No 62-37  Teléfono: 7551335`, M+145, FY+12, { width: 220 })
    .text('administracion@servidoresdelservidor.org', M+145, FY+22, { width: 220 })
    .fontSize(6.5).text('"Señor mi Dios, si amas al que da alegremente, suscita entonces en nuestros corazones la alegría de servirnos unos a otros mediante la caridad."', M+145, FY+30, { width: 220 })

  doc.fontSize(7).text('www.servidoresdelservidor.org', M+370, FY+20, { width: 185, align: 'center' })
}

// ── Recibo PDF individual ──
app.get('/api/financiero/recibo/:id', verificarFinanciero, async (req, res) => {
  const { data: ing, error } = await supabase.from('ingresos')
    .select('*, providente:providente_id(nombre, numero_identificacion, telefono, direccion, correo)')
    .eq('id', req.params.id).eq('ciudad', req.ciudadFinanciero).single()
  if (error || !ing) return res.status(404).json({ error: 'Ingreso no encontrado' })

  const [{ data: cfg }, { data: user }, logo] = await Promise.all([
    supabase.from('config_ciudad').select('cuenta_bancaria').eq('ciudad', req.ciudadFinanciero).single(),
    supabase.from('registros').select('primer_nombre, primer_apellido').eq('id', req.headers['x-miembro-id']).single(),
    getLogoBuffer(),
  ])
  const receptor = user ? `${user.primer_nombre} ${user.primer_apellido}` : ''

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="recibo_${ing.numero_recibo || ing.id.substring(0,8)}.pdf"`)

  const doc = new PDFDocument({ size: 'LETTER', margin: 0 })
  doc.pipe(res)
  generarReciboPDF(doc, ing, cfg || {}, receptor, logo)
  doc.end()
})

// ── Recibos ZIP del mes ──
app.get('/api/financiero/reporte/recibos-mes', verificarFinanciero, async (req, res) => {
  try {
  const { mes, anio } = req.query
  if (!mes || !anio) return res.status(400).json({ error: 'Mes y año requeridos' })

  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const nombreMes = MESES[parseInt(mes)-1]
  const desde = `${anio}-${mes.padStart(2,'0')}-01`
  const hasta = `${anio}-${mes.padStart(2,'0')}-31`

  const [{ data: ingresos }, { data: cfg }, { data: user }, logo] = await Promise.all([
    supabase.from('ingresos').select('*, providente:providente_id(nombre, numero_identificacion, telefono, direccion, correo)')
      .eq('ciudad', req.ciudadFinanciero).gte('fecha', desde).lte('fecha', hasta).order('numero_recibo', { ascending: true }),
    supabase.from('config_ciudad').select('cuenta_bancaria').eq('ciudad', req.ciudadFinanciero).single(),
    supabase.from('registros').select('primer_nombre, primer_apellido').eq('id', req.headers['x-miembro-id']).single(),
    getLogoBuffer(),
  ])

  const receptor = user ? `${user.primer_nombre} ${user.primer_apellido}` : ''

  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition', `attachment; filename="recibos_${nombreMes}_${anio}.zip"`)

  const archive = archiver('zip', { zlib: { level: 6 } })
  archive.pipe(res)

  for (const ing of (ingresos || [])) {
    await new Promise((resolve) => {
      const chunks = []
      const doc = new PDFDocument({ size: 'LETTER', margin: 0 })
      doc.on('data', c => chunks.push(c))
      doc.on('end', () => {
        const buf = Buffer.concat(chunks)
        archive.append(buf, { name: `recibo_${ing.numero_recibo || ing.id.substring(0,8)}.pdf` })
        resolve()
      })
      generarReciboPDF(doc, ing, cfg || {}, receptor, logo)
      doc.end()
    })
  }

  archive.on('error', err => { console.error('ZIP error:', err); if (!res.headersSent) res.status(500).json({ error: err.message }) })
  archive.finalize()
  } catch (err) {
    console.error('Error ZIP recibos:', err)
    if (!res.headersSent) res.status(500).json({ error: err.message })
  }
})

// ── PDF de imágenes por cuenta ──
async function descargarImagen(url) {
  return new Promise((resolve) => {
    try {
      const https = require('https')
      const http = require('http')
      const mod = url.startsWith('https') ? https : http
      mod.get(url, (r) => {
        const chunks = []
        r.on('data', c => chunks.push(c))
        r.on('end', () => resolve(Buffer.concat(chunks)))
        r.on('error', () => resolve(null))
      }).on('error', () => resolve(null))
    } catch (e) { resolve(null) }
  })
}

app.get('/api/financiero/reporte/imagenes-banco', verificarFinanciero, async (req, res) => {
  try {
    const { mes, anio } = req.query
    if (!mes || !anio) return res.status(400).json({ error: 'Mes y año requeridos' })
    const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
    const nombreMes = MESES[parseInt(mes) - 1]
    const desde = `${anio}-${mes.padStart(2,'0')}-01`
    const hasta = `${anio}-${mes.padStart(2,'0')}-31`

    const [{ data: ingresos }, { data: egresos }] = await Promise.all([
      supabase.from('ingresos').select('id, fecha, concepto, valor, numero_recibo, comprobante_url, providente_otro, tipo, providente:providente_id(nombre)')
        .eq('ciudad', req.ciudadFinanciero).eq('cuenta', 'banco')
        .not('comprobante_url', 'is', null).neq('comprobante_url', '').gte('fecha', desde).lte('fecha', hasta).order('fecha'),
      supabase.from('egresos').select('id, fecha, concepto, valor, documento_url')
        .eq('ciudad', req.ciudadFinanciero).eq('cuenta', 'banco')
        .not('documento_url', 'is', null).neq('documento_url', '').gte('fecha', desde).lte('fecha', hasta).order('fecha'),
    ])

    const movimientos = [
      ...(ingresos || []).map(r => ({ ...r, _tipo: 'Ingreso', documento_url: r.comprobante_url })),
      ...(egresos || []).map(r => ({ ...r, _tipo: 'Egreso' })),
    ].sort((a, b) => a.fecha.localeCompare(b.fecha))

    console.log(`Imágenes banco ${nombreMes}/${anio}: ingresos=${(ingresos||[]).length} egresos=${(egresos||[]).length} con_img=${movimientos.length}`)
    if (movimientos.length === 0) return res.status(200).json({ sinImagenes: true, mensaje: 'Sin imágenes en este período' })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="imagenes_banco_${nombreMes}_${anio}.pdf"`)

    const doc = new PDFDocument({ size: 'LETTER', margin: 40, autoFirstPage: false })
    doc.pipe(res)

    for (const mov of movimientos) {
      doc.addPage()
      const W = doc.page.width - 80

      // Encabezado
      doc.fontSize(11).font('Helvetica-Bold')
        .text(`BANCO — ${nombreMes.toUpperCase()} ${anio}`, 40, 40, { width: W, align: 'center' })
      doc.moveTo(40, 58).lineTo(40 + W, 58).lineWidth(0.5).stroke()

      // Datos del movimiento
      doc.fontSize(9).font('Helvetica-Bold').text('Tipo:', 40, 68).font('Helvetica').text(mov._tipo, 80, 68)
      doc.fontSize(9).font('Helvetica-Bold').text('Fecha:', 40, 82).font('Helvetica').text(mov.fecha, 85, 82)
      const valorFmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(Number(mov.valor))
      doc.fontSize(9).font('Helvetica-Bold').text('Valor:', 200, 82).font('Helvetica').text(valorFmt, 240, 82)
      if (mov.numero_recibo) { doc.fontSize(9).font('Helvetica-Bold').text('Recibo:', 350, 82).font('Helvetica').text(`#${mov.numero_recibo}`, 395, 82) }
      if (mov.concepto) { doc.fontSize(9).font('Helvetica-Bold').text('Concepto:', 40, 96).font('Helvetica').text(mov.concepto, 105, 96, { width: W - 65 }) }
      const nombreBenefactor = mov.providente?.nombre || mov.providente_otro || ''
      if (nombreBenefactor) { doc.fontSize(9).font('Helvetica-Bold').text('Benefactor:', 40, 110).font('Helvetica').text(nombreBenefactor, 108, 110, { width: W - 68 }) }

      doc.moveTo(40, 125).lineTo(40 + W, 125).lineWidth(0.5).stroke()

      // Imagen
      const imgBuf = await descargarImagen(mov.documento_url)
      if (imgBuf) {
        const imgY = 133
        const maxH = doc.page.height - imgY - 40
        doc.image(imgBuf, 40, imgY, { width: W, height: maxH, fit: [W, maxH], align: 'center', valign: 'top' })
      } else {
        doc.fontSize(9).font('Helvetica').fillColor('gray').text('(Imagen no disponible)', 40, 133)
        doc.fillColor('black')
      }
    }

    doc.end()
  } catch (err) {
    console.error('Error PDF imágenes banco:', err)
    if (!res.headersSent) res.status(500).json({ error: err.message })
  }
})

async function generarPDFImagenesCuenta(req, res, cuenta, tituloLabel, nombreArchivo) {
  try {
    const { mes, anio } = req.query
    if (!mes || !anio) return res.status(400).json({ error: 'Mes y año requeridos' })
    const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
    const nombreMes = MESES[parseInt(mes) - 1]
    const desde = `${anio}-${mes.padStart(2,'0')}-01`
    const hasta = `${anio}-${mes.padStart(2,'0')}-31`

    const [{ data: ingresos }, { data: egresos }] = await Promise.all([
      supabase.from('ingresos').select('id, fecha, concepto, valor, numero_recibo, comprobante_url, providente_otro, tipo, providente:providente_id(nombre)')
        .eq('ciudad', req.ciudadFinanciero).eq('cuenta', cuenta)
        .not('comprobante_url', 'is', null).neq('comprobante_url', '').gte('fecha', desde).lte('fecha', hasta).order('fecha'),
      supabase.from('egresos').select('id, fecha, concepto, valor, documento_url, punto_servicio_otro, punto:punto_servicio_id(nombre)')
        .eq('ciudad', req.ciudadFinanciero).eq('cuenta', cuenta)
        .not('documento_url', 'is', null).neq('documento_url', '').gte('fecha', desde).lte('fecha', hasta).order('fecha'),
    ])

    const movimientos = [
      ...(ingresos || []).map(r => ({ ...r, _tipo: 'Ingreso', documento_url: r.comprobante_url })),
      ...(egresos || []).map(r => ({ ...r, _tipo: 'Egreso' })),
    ].sort((a, b) => a.fecha.localeCompare(b.fecha))

    if (movimientos.length === 0) return res.status(200).json({ sinImagenes: true, mensaje: 'Sin imágenes en este período' })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}_${nombreMes}_${anio}.pdf"`)

    const doc = new PDFDocument({ size: 'LETTER', margin: 40, autoFirstPage: false })
    doc.pipe(res)

    for (const mov of movimientos) {
      doc.addPage()
      const W = doc.page.width - 80
      doc.fontSize(11).font('Helvetica-Bold')
        .text(`${tituloLabel} — ${nombreMes.toUpperCase()} ${anio}`, 40, 40, { width: W, align: 'center' })
      doc.moveTo(40, 58).lineTo(40 + W, 58).lineWidth(0.5).stroke()
      doc.fontSize(9).font('Helvetica-Bold').text('Tipo:', 40, 68).font('Helvetica').text(mov._tipo, 80, 68)
      doc.fontSize(9).font('Helvetica-Bold').text('Fecha:', 40, 82).font('Helvetica').text(mov.fecha, 85, 82)
      const valorFmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(Number(mov.valor))
      doc.fontSize(9).font('Helvetica-Bold').text('Valor:', 200, 82).font('Helvetica').text(valorFmt, 240, 82)
      if (mov.numero_recibo) { doc.fontSize(9).font('Helvetica-Bold').text('Recibo:', 350, 82).font('Helvetica').text(`#${mov.numero_recibo}`, 395, 82) }
      const servicio = mov.punto?.nombre || mov.punto_servicio_otro || ''
      let lineY = 96
      if (servicio) { doc.fontSize(9).font('Helvetica-Bold').text('Servicio:', 40, lineY).font('Helvetica').text(servicio, 100, lineY, { width: W - 60 }); lineY += 14 }
      if (mov.concepto) { doc.fontSize(9).font('Helvetica-Bold').text('Concepto:', 40, lineY).font('Helvetica').text(mov.concepto, 105, lineY, { width: W - 65 }); lineY += 14 }
      const nombreBenefactor = mov.providente?.nombre || mov.providente_otro || ''
      if (nombreBenefactor) { doc.fontSize(9).font('Helvetica-Bold').text('Benefactor:', 40, lineY).font('Helvetica').text(nombreBenefactor, 108, lineY, { width: W - 68 }); lineY += 14 }
      const sepY = Math.max(lineY + 2, 125)
      doc.moveTo(40, sepY).lineTo(40 + W, sepY).lineWidth(0.5).stroke()
      const imgBuf = await descargarImagen(mov.documento_url)
      if (imgBuf) {
        const imgY = sepY + 8
        const maxH = doc.page.height - imgY - 40
        doc.image(imgBuf, 40, imgY, { width: W, height: maxH, fit: [W, maxH], align: 'center', valign: 'top' })
      } else {
        doc.fontSize(9).font('Helvetica').fillColor('gray').text('(Imagen no disponible)', 40, 133)
        doc.fillColor('black')
      }
    }
    doc.end()
  } catch (err) {
    console.error(`Error PDF imágenes ${cuenta}:`, err)
    if (!res.headersSent) res.status(500).json({ error: err.message })
  }
}

app.get('/api/financiero/reporte/imagenes-caja-menor', verificarFinanciero, (req, res) =>
  generarPDFImagenesCuenta(req, res, 'caja_menor', 'CAJA MENOR', 'imagenes_caja_menor'))

app.get('/api/financiero/reporte/imagenes-consumo-caja-menor', verificarFinanciero, (req, res) =>
  generarPDFImagenesCuenta(req, res, 'consumo_caja_menor', 'CONSUMO CAJA MENOR', 'imagenes_consumo_caja_menor'))

// ── Evaluación de pilares ─────────────────────────────────────────────────────

// Login evaluación
app.post('/api/evaluacion/login', async (req, res) => {
  const { numero_identificacion, clave } = req.body
  if (!numero_identificacion || !clave) return res.status(400).json({ ok: false, mensaje: 'Faltan campos' })
  const { data, error } = await supabase.from('registros')
    .select('id, primer_nombre, primer_apellido, estado_consagracion, responsabilidades_pilar, clave')
    .eq('numero_identificacion', numero_identificacion).single()
  if (error || !data) return res.status(401).json({ ok: false, mensaje: 'Usuario no encontrado' })
  if (data.clave !== clave) return res.status(401).json({ ok: false, mensaje: 'Clave incorrecta' })
  if (data.estado_consagracion !== 'pilar') return res.status(403).json({ ok: false, mensaje: 'Solo los pilares pueden acceder a esta evaluación' })
  res.json({ ok: true, id: data.id, nombre: `${data.primer_nombre} ${data.primer_apellido}`, responsabilidades_pilar: data.responsabilidades_pilar })
})

// Lista de pilares
app.get('/api/evaluacion/pilares', async (req, res) => {
  const { data } = await supabase.from('registros')
    .select('id, primer_nombre, primer_apellido')
    .eq('estado_consagracion', 'pilar')
    .order('primer_apellido')
  res.json(data || [])
})

// Guardar evaluaciones (array de evaluaciones)
app.post('/api/evaluacion/guardar', async (req, res) => {
  const { anio, evaluador_id, evaluaciones } = req.body
  if (!anio || !evaluador_id || !evaluaciones?.length) return res.status(400).json({ ok: false, mensaje: 'Faltan datos' })
  const rows = evaluaciones.map(e => ({
    anio, evaluador_id, evaluado_id: e.evaluado_id,
    es_autoevaluacion: e.es_autoevaluacion || false,
    p1_reuniones: e.p1, p2_compromisos: e.p2, p3_seguimiento: e.p3
  }))
  const { error } = await supabase.from('evaluaciones_pilar').upsert(rows, { onConflict: 'anio,evaluador_id,evaluado_id' })
  if (error) return res.status(500).json({ ok: false, mensaje: error.message })
  res.json({ ok: true })
})

// Verificar si ya evaluó
app.get('/api/evaluacion/ya-evaluo', async (req, res) => {
  const { anio, evaluador_id } = req.query
  const { data } = await supabase.from('evaluaciones_pilar')
    .select('id').eq('anio', anio).eq('evaluador_id', evaluador_id).limit(1)
  res.json({ ya_evaluo: data && data.length > 0 })
})

// Resultados (solo para Servidor General u Organizacional)
app.get('/api/evaluacion/resultados', async (req, res) => {
  const { anio, id } = req.query
  const { data: reg } = await supabase.from('registros')
    .select('responsabilidades_pilar').eq('id', id).single()
  if (!reg || !['Servidor General', 'Organizacional'].includes(reg.responsabilidades_pilar))
    return res.status(403).json({ ok: false, mensaje: 'No tienes permiso para ver los resultados' })
  const { data } = await supabase.from('evaluaciones_pilar')
    .select('evaluado_id, es_autoevaluacion, p1_reuniones, p2_compromisos, p3_seguimiento, evaluado:evaluado_id(primer_nombre, primer_apellido)')
    .eq('anio', anio)
  res.json(data || [])
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`🚀 Backend corriendo en http://localhost:${PORT}`)
})
