// Dobles de prueba para el arnés de caracterización: Supabase, Resend, descargas
// HTTP(S), fecha y aleatoriedad. Todo es determinista para que la versión legada
// y la actual produzcan exactamente las mismas respuestas y efectos.
const http = require('http')
const https = require('https')
const crypto = require('crypto')
const { EventEmitter } = require('events')
const { PassThrough } = require('stream')

// PNG de 1x1 que PDFKit puede incrustar (logo e imágenes de comprobantes)
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

// Modos de respuesta de los servicios externos durante una petición
//   normal      Supabase devuelve filas de ejemplo; Resend responde bien
//   vacio       Supabase no encuentra filas
//   error       Supabase devuelve { error }
//   lanza       Supabase lanza una excepción
//   sinPermiso  filas de ejemplo sin roles ni responsabilidades
//   correoFalla Resend devuelve { error }
//   correoLanza Resend lanza una excepción
const MODOS = ['normal', 'vacio', 'error', 'lanza', 'sinPermiso', 'correoFalla', 'correoLanza']

const estado = { modo: 'normal', efectos: [] }

function reiniciar(modo) {
  estado.modo = modo
  estado.efectos = []
}

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex')
const clonar = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)))

function fila(tabla, i, sinPermiso) {
  const otra = i === 1
  return {
    id: `${tabla}-${i + 1}`,
    created_at: `2026-0${i + 1}-10T10:00:00.000Z`,
    nombre: otra ? 'Hogar Santa Ana' : 'Comedor San José',
    ciudad: 'Bogotá',
    pais: 'Colombia',
    departamento: 'Cundinamarca',
    activo: true,
    // registros
    primer_nombre: otra ? 'Luis' : 'Ana',
    segundo_nombre: 'María',
    primer_apellido: otra ? 'Álvarez' : 'Zapata',
    segundo_apellido: 'Ruiz',
    numero_identificacion: otra ? '2000' : '1000',
    clave: sinPermiso ? 'otra-clave' : 'secreta',
    correo_electronico: otra ? 'luis@example.org' : 'ana@example.org',
    roles: sinPermiso ? [] : ['responsable_financiero', 'responsable_comunicaciones', 'responsable_comunicaciones_ciudad'],
    responsabilidades_consejo: sinPermiso ? [] : ['Formación y consagraciones', 'Obras y servicios', 'Coordinador principal del consejo', 'Financiero', 'Comunicaciones'],
    responsabilidades_pilar: sinPermiso ? [] : ['Comunicaciones', 'Organizacional', 'Servidor General'],
    estado_consagracion: sinPermiso ? 'paciente' : 'pilar',
    estado_proceso: 'pendiente_formacion',
    ciudad_donde_sirve: 'Bogotá',
    pais_servicio: 'Colombia',
    departamento_ciudad_servicio: 'Cundinamarca',
    pertenece_consejo: 'Si pertenezco',
    puntos_servicio: ['Comedor San José'],
    puntos_coordina: ['Comedor San José'],
    fecha_nacimiento: otra ? '1990-12-25' : '1985-03-15',
    historial_proceso: [],
    historial_formacion: [],
    reset_token_expira: sinPermiso ? '2000-01-01T00:00:00.000Z' : '2099-01-01T00:00:00.000Z',
    // finanzas
    fecha: otra ? '2026-03-20' : '2026-03-05',
    valor: otra ? 250000 : 1234567,
    cuenta: otra ? 'caja_menor' : 'banco',
    tipo: otra ? 'donacion_servicio' : 'aporte_consagrado',
    forma_donacion: otra ? 'especie' : 'dinero',
    numero_recibo: otra ? '12' : '7',
    concepto: 'Aporte mensual',
    mes_aporte: 'Marzo',
    providente: { nombre: 'Benefactor Uno', correo: 'benefactor@example.org', numero_identificacion: '900', telefono: '3001234567', direccion: 'Calle 1' },
    providente_otro: otra ? 'Donante anónimo' : null,
    punto: { nombre: 'Comedor San José' },
    punto_servicio_otro: null,
    creador: { primer_nombre: 'Ana', primer_apellido: 'Zapata' },
    editor: null,
    comprobante_url: otra ? 'http://imagenes.example.org/b.png' : 'https://imagenes.example.org/a.png',
    documento_url: otra ? 'http://imagenes.example.org/d.png' : 'https://imagenes.example.org/c.png',
    saldo: 150000,
    cuenta_bancaria: 'Cuenta de ahorros 123',
    correo: 'benefactor@example.org',
    atendido: false,
    revisado: false,
    // contenido
    subtitulo: 'Ciudad de servicio',
    historia: 'Historia de la ciudad',
    historia_fotos: ['https://imagenes.example.org/h.png'],
    fotos: [],
    orden: i,
    evaluado: { primer_nombre: 'Ana', segundo_nombre: 'María', primer_apellido: 'Zapata' },
  }
}

function responder(tabla, ops) {
  const metodos = ops.map(([m]) => m)
  const esSingle = metodos.includes('single')
  const escribe = ['insert', 'update', 'delete', 'upsert'].some(m => metodos.includes(m))
  const lee = metodos.includes('select')
  switch (estado.modo) {
    case 'lanza': throw new Error(`Caída simulada de Supabase en ${tabla}`)
    case 'error': return { data: null, error: { message: `Error simulado en ${tabla}` } }
    case 'vacio':
      if (esSingle) return { data: null, error: { message: 'Sin filas', code: 'PGRST116' } }
      return { data: lee && !escribe ? [] : null, error: null }
    default: {
      const sinPermiso = estado.modo === 'sinPermiso'
      if (escribe && !lee) return { data: null, error: null }
      if (esSingle) return { data: fila(tabla, 0, sinPermiso), error: null }
      if (lee) return { data: [fila(tabla, 0, sinPermiso), fila(tabla, 1, sinPermiso)], error: null }
      return { data: null, error: null }
    }
  }
}

// Constructor de consultas que registra la cadena completa y la resuelve al ser esperada
function consulta(tabla) {
  const ops = []
  const proxy = new Proxy({}, {
    get(_, prop) {
      if (prop === 'then') {
        return (resolve, reject) => {
          estado.efectos.push({ tipo: 'supabase', tabla, ops: clonar(ops) })
          return Promise.resolve().then(() => responder(tabla, ops)).then(resolve, reject)
        }
      }
      if (typeof prop === 'symbol') return undefined
      return (...args) => { ops.push([prop, clonar(args)]); return proxy }
    },
  })
  return proxy
}

const clienteSupabase = {
  from: (tabla) => consulta(tabla),
  storage: {
    from: (bucket) => ({
      async upload(nombre, buffer, opciones) {
        estado.efectos.push({ tipo: 'storage.upload', bucket, nombre, sha: sha(buffer), opciones: clonar(opciones) })
        if (estado.modo === 'lanza') throw new Error('Caída simulada de Storage')
        if (estado.modo === 'error') return { data: null, error: { message: 'Error simulado de Storage' } }
        return { data: { path: nombre }, error: null }
      },
      getPublicUrl(nombre) {
        estado.efectos.push({ tipo: 'storage.getPublicUrl', bucket, nombre })
        return { data: { publicUrl: `https://almacen.example.org/${bucket}/${nombre}` } }
      },
      async remove(rutas) {
        estado.efectos.push({ tipo: 'storage.remove', bucket, rutas: clonar(rutas) })
        if (estado.modo === 'lanza') throw new Error('Caída simulada de Storage')
        if (estado.modo === 'error') return { data: null, error: { message: 'Error simulado de Storage' } }
        return { data: [], error: null }
      },
    }),
  },
}

// El HTML de los correos se compara sin espacios repetidos: la sangría no es parte del contrato
const normalizarHtml = (html) => (typeof html === 'string' ? html.replace(/\s+/g, ' ').trim() : html)

class ResendFalso {
  constructor() {
    this.emails = {
      async send(datos) {
        const copia = clonar({ ...datos, attachments: undefined })
        copia.html = normalizarHtml(copia.html)
        if (datos.attachments) {
          copia.attachments = datos.attachments.map(a => ({ filename: a.filename, sha: sha(Buffer.from(a.content, 'base64')) }))
        }
        estado.efectos.push({ tipo: 'correo', datos: copia })
        if (estado.modo === 'correoLanza') throw new Error('Caída simulada de Resend')
        if (estado.modo === 'correoFalla') return { data: null, error: { message: 'Error simulado de Resend' } }
        return { data: { id: 'correo-1' }, error: null }
      },
    }
  }
}

function getFalso(url, callback) {
  const req = new EventEmitter()
  req.setTimeout = () => req
  req.destroy = () => {}
  estado.efectos.push({ tipo: 'descarga', url: String(url) })
  process.nextTick(() => {
    const respuesta = new PassThrough()
    respuesta.statusCode = 200
    respuesta.headers = {}
    callback(respuesta)
    respuesta.end(PNG)
  })
  return req
}

const FECHA_FIJA = Date.parse('2026-03-15T15:30:00.000Z')

function instalar(raiz) {
  // Módulos de servicios externos reemplazados antes de cargar cualquier versión de la app
  const reemplazar = (nombre, exportaciones) => {
    const ruta = require.resolve(nombre, { paths: [raiz] })
    require.cache[ruta] = { id: ruta, filename: ruta, loaded: true, exports: exportaciones, children: [], paths: [] }
  }
  reemplazar('@supabase/supabase-js', { createClient: () => clienteSupabase })
  reemplazar('resend', { Resend: ResendFalso })

  http.get = getFalso
  https.get = getFalso

  crypto.randomBytes = (n, cb) => {
    const buf = Buffer.alloc(n, 0xab)
    if (cb) { process.nextTick(cb, null, buf); return undefined }
    return buf
  }

  const DateReal = Date
  class DateFija extends DateReal {
    constructor(...args) { if (args.length === 0) super(FECHA_FIJA); else super(...args) }
    static now() { return FECHA_FIJA }
  }
  globalThis.Date = DateFija

  process.env.CORREO_INSTITUCIONAL = 'institucional@example.org'
  process.env.SUPABASE_URL = 'https://supabase.example.org'
  process.env.SUPABASE_SECRET_KEY = 'clave-falsa'
  process.env.RESEND_API_KEY = 'clave-falsa'

  for (const metodo of ['log', 'error', 'warn', 'info']) console[metodo] = () => {}
}

module.exports = { MODOS, estado, reiniciar, instalar, sha }
