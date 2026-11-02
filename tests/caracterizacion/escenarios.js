// Escenarios de petición para cada endpoint. Las rutas se extraen del index.js legado,
// así que todo endpoint original queda cubierto aunque se mueva de archivo.
const { MODOS } = require('./fakes')

const MIEMBRO_ID = 'registros-1'
const ADMIN_KEY = 'SDS2026admin'
const CIO_KEY = 'CIO2026'

const ENCABEZADOS = {
  todos: { 'x-miembro-id': MIEMBRO_ID, 'x-admin-key': ADMIN_KEY, 'x-cio-key': CIO_KEY },
  ninguno: {},
  soloAdmin: { 'x-admin-key': ADMIN_KEY },
  clavesMalas: { 'x-admin-key': 'incorrecta', 'x-cio-key': 'incorrecta' },
}

const PARAMETROS_RUTA = { id: '5', clienteId: 'cliente-1', ciudadId: 'ciudad-1', pilarId: 'pilar-1', nombre: 'Bogotá' }

const QUERY_COMPLETA = {
  mes: '3', anio: '2026', ciudad: 'Bogotá', q: 'an', desde: '2026-03-01', hasta: '2026-03-31',
  providente_id: 'providentes-1', cuenta: 'banco', punto: 'Comedor San José', id: MIEMBRO_ID,
  evaluador_id: MIEMBRO_ID, numero: '1000',
}

// Un único cuerpo con todos los campos que lee algún endpoint
const CUERPO_COMPLETO = {
  // registro
  aceptaDatos: true, timestampAceptaDatos: '2026-03-01T00:00:00.000Z', versionPolitica: 'v1', hashPolitica: 'h1',
  fechaNacimiento: '1990-01-02', tipoIdentificacion: 'CC', numeroIdentificacion: '1000', sexo: 'F',
  primerNombre: 'Ana', segundoNombre: 'María', primerApellido: 'Zapata', segundoApellido: 'Ruiz', estadoCivil: 'Soltera',
  telefonoMovil: '300', telefonoFijo: '601', otroTelefono: '', correoElectronico: 'nueva@example.org',
  paisResidencia: 'Colombia', departamentoServicio: 'Cundinamarca', ciudadServicio: 'Bogotá', direccionResidencia: 'Calle 2',
  nivelAcademico: 'Profesional', profesion: 'Ingeniera', ocupacion: 'Empleada', tipoSangre: 'O+', epsServicio: 'EPS',
  indicacionesMedicas: 'Ninguna', comoLlegoComunitad: 'Invitación', paisServicio: 'Colombia', departamentoDondeSirve: 'Cundinamarca',
  ciudadDondeSirve: 'Bogotá', puntosServicio: ['Comedor San José'], esCoordinador: 'No', puntosCoordina: [],
  perteneceConsejo: 'No pertenezco', fechaInicioConsejo: '', responsabilidadesConsejo: [], estadoConsagracion: 'pilar',
  fechaInicioServicio: '2020-01-01', porQueConsagrarse: 'Servir', fechaConsagracion: '', fechaInicioEncargo: '2021-01-01',
  perteneceOtraComunidad: 'No', responsabilidadesPilar: ['Comunicaciones'], aceptaContrato: true, timestampContrato: '',
  versionContrato: '', hashContrato: 'h2', fotoUrl: 'https://imagenes.example.org/f.png',
  ciudadesResponsable: [{ pais: 'Colombia', departamento: '', ciudad: 'Bogotá' }, { pais: 'Colombia', departamento: 'Antioquia', ciudad: 'Medellín' }],
  // credenciales
  clave: 'secreta', claveActual: 'secreta', claveNueva: 'nueva123', token: 'token-1', numero_identificacion: '1000',
  // perfil y procesos
  primer_nombre: 'Ana', telefono_movil: '301', tipo_sangre: 'A+',
  motivacion: '  Quiero servir  ', otra_comunidad: 'Ninguna',
  ids: ['registros-1', 'registros-2'], fecha_consagracion: '2026-03-01', acta_url: 'https://archivos.example.org/acta.pdf',
  concepto_consejo: 'Avalado', fecha_reunion_consejo: '2026-02-01', avala: true,
  estado: 'formacion_aprobada', concepto_formacion: 'Cumple', decision: 'aprobado_consagracion', notas: 'Aprobado', fecha_junta: '2026-02-15',
  estado_proceso: 'cumple_requisitos', asignar: true,
  // comunicaciones y correo
  asunto: 'Aviso', cuerpo: 'Hola a todos', correos: ['uno@example.org', 'dos@example.org'],
  titulo: 'Noticia', extracto: 'Resumen', imagen_url: 'https://imagenes.example.org/n.png', enlace: 'https://example.org',
  archivo_url: 'https://archivos.example.org/lectio.pdf', subtitulo: 'Sub', historia: 'Historia', historia_fotos: ['https://imagenes.example.org/h.png'],
  horario: 'Lunes', descripcion: 'Descripción', direccion: 'Calle 3', telefono: '302', fotos: ['https://imagenes.example.org/s.png'],
  email: 'contacto@example.org', mensaje: 'Mensaje de contacto',
  // consejo, obras, pilar
  responsabilidades: ['Financiero'], rol: 'Financiero', tipo: 'principal', ciudadActual: 'Bogotá', punto: 'Comedor San José',
  nombre: '  Nuevo punto  ', pais: 'Colombia', departamento: 'Cundinamarca', ciudad: 'Bogotá',
  bucket: 'Comprobantes', path: 'carpeta/archivo.png',
  // CIO
  nit: '900', cliente_id: 'cliente-1', concepto: 'Concepto', fecha_inicio: '2026-01-01', proyecto_id: 'proyecto-1',
  valor: 50000, horas_estimadas: 3, fecha_facturacion: '2026-03-01', valor_facturado: 1000, producto_id: 'producto-1',
  fecha: '2026-03-10', hora_inicio: '08:00', hora_fin: '10:30', con_quien: 'Equipo', actividad: 'Reunión',
  // financiero
  correo: 'benefactor@example.org', providente_id: 'providentes-1', providente_otro: '', punto_servicio_id: '__otro__',
  punto_servicio_otro: 'Otro punto', mes_aporte: 'Marzo', comprobante_url: 'https://imagenes.example.org/a.png',
  numero_recibo: '15', forma_donacion: 'dinero', cuenta: 'banco', revisado: true, nombre_donante: 'Donante', cedula: '123',
  comentario: 'Gracias', documento_url: 'https://imagenes.example.org/c.png', saldo: 100000,
  // evaluación
  anio: 2026, evaluador_id: MIEMBRO_ID,
  evaluaciones: [{ evaluado_id: 'registros-2', p1: 5, p2: 4, p3: 3 }, { evaluado_id: MIEMBRO_ID, p1: 4, p2: 4, p3: 4, es_autoevaluacion: true }],
}

function rutasLegadas(fuente) {
  const rutas = []
  const patron = /^app\.(get|post|put|patch|delete)\('([^']+)'/gm
  let m
  while ((m = patron.exec(fuente))) rutas.push({ metodo: m[1].toUpperCase(), ruta: m[2] })
  return rutas
}

function rellenarRuta(ruta) {
  return ruta.replace(/:(\w+)/g, (_, nombre) => encodeURIComponent(PARAMETROS_RUTA[nombre] ?? nombre))
}

function json(cuerpo) {
  return { tipo: 'json', cuerpo }
}

function escenariosDeRuta({ metodo, ruta }) {
  const url = rellenarRuta(ruta)
  const conCuerpo = metodo !== 'GET'
  const escenarios = []
  for (const modo of MODOS) {
    escenarios.push({ nombre: `${modo} completo`, metodo, url, query: QUERY_COMPLETA, encabezados: ENCABEZADOS.todos, cuerpo: conCuerpo ? json(CUERPO_COMPLETO) : null, modo })
    escenarios.push({ nombre: `${modo} vacío`, metodo, url, query: {}, encabezados: ENCABEZADOS.todos, cuerpo: conCuerpo ? json({}) : null, modo })
  }
  if (conCuerpo) escenarios.push({ nombre: 'sin cuerpo', metodo, url, query: {}, encabezados: ENCABEZADOS.todos, cuerpo: null, modo: 'normal' })
  for (const variante of ['ninguno', 'soloAdmin', 'clavesMalas']) {
    escenarios.push({ nombre: `encabezados ${variante}`, metodo, url, query: QUERY_COMPLETA, encabezados: ENCABEZADOS[variante], cuerpo: conCuerpo ? json(CUERPO_COMPLETO) : null, modo: 'normal' })
  }
  return escenarios
}

// Escenarios que no salen del barrido genérico
function escenariosExtra() {
  const archivo = { nombre: 'foto.png', tipo: 'image/png', contenido: 'contenido-de-prueba' }
  const extra = []
  for (const modo of ['normal', 'error', 'lanza']) {
    extra.push({ nombre: `upload ${modo}`, metodo: 'POST', url: '/api/upload', query: {}, encabezados: {}, modo,
      cuerpo: { tipo: 'multipart', campos: { bucket: 'Comprobantes', carpeta: 'ingresos' }, archivo } })
    extra.push({ nombre: `upload con nombre ${modo}`, metodo: 'POST', url: '/api/upload', query: {}, encabezados: {}, modo,
      cuerpo: { tipo: 'multipart', campos: { bucket: 'Comprobantes', carpeta: 'ingresos', nombre: 'fijo.png' }, archivo } })
  }
  extra.push({ nombre: 'JSON mal formado', metodo: 'POST', url: '/api/login', query: {}, encabezados: {}, modo: 'normal', cuerpo: { tipo: 'crudo', cuerpo: '{mal' } })
  extra.push({ nombre: 'ruta inexistente', metodo: 'GET', url: '/api/no-existe', query: {}, encabezados: {}, modo: 'normal', cuerpo: null })
  extra.push({ nombre: 'login clave incorrecta', metodo: 'POST', url: '/api/login', query: {}, encabezados: {}, modo: 'normal',
    cuerpo: json({ numeroIdentificacion: '1000', clave: 'mala' }) })
  extra.push({ nombre: 'correo masivo como pilar sin admin', metodo: 'POST', url: '/api/admin/enviar-correo-masivo', query: {}, modo: 'normal',
    encabezados: { 'x-miembro-id': MIEMBRO_ID }, cuerpo: json(CUERPO_COMPLETO) })
  extra.push({ nombre: 'concepto consejo no avala', metodo: 'PUT', url: '/api/formacion/concepto-consejo/5', query: {}, modo: 'normal',
    encabezados: ENCABEZADOS.todos, cuerpo: json({ ...CUERPO_COMPLETO, avala: false }) })
  extra.push({ nombre: 'coordinador suplente', metodo: 'PUT', url: '/api/admin/consejo/miembro/5/coordinador', query: {}, modo: 'normal',
    encabezados: ENCABEZADOS.todos, cuerpo: json({ tipo: 'suplente', ciudadActual: 'Bogotá' }) })
  extra.push({ nombre: 'egreso costo financiero', metodo: 'POST', url: '/api/financiero/egresos', query: {}, modo: 'normal',
    encabezados: ENCABEZADOS.todos, cuerpo: json({ ...CUERPO_COMPLETO, tipo: 'costo_financiero', punto_servicio_id: 'punto-1' }) })
  extra.push({ nombre: 'cumpleaños rango que cruza el año', metodo: 'GET', url: '/api/miembro/cumpleanos', modo: 'normal',
    query: { desde: '2026-12-01', hasta: '2027-04-30', ciudad: 'Bogotá' }, encabezados: {}, cuerpo: null })
  extra.push({ nombre: 'registro de paciente', metodo: 'POST', url: '/api/registro', query: {}, modo: 'vacio',
    encabezados: {}, cuerpo: json({ ...CUERPO_COMPLETO, estadoConsagracion: 'paciente' }) })
  extra.push({ nombre: 'quitar rol financiero', metodo: 'PUT', url: '/api/admin/registros/5/rol-financiero', query: {}, modo: 'normal',
    encabezados: ENCABEZADOS.todos, cuerpo: json({ asignar: false }) })
  extra.push({ nombre: 'estado no permitido', metodo: 'PUT', url: '/api/formacion/estado/5', query: {}, modo: 'normal',
    encabezados: ENCABEZADOS.todos, cuerpo: json({ estado: 'otro' }) })
  return extra
}

module.exports = { rutasLegadas, escenariosDeRuta, escenariosExtra }
