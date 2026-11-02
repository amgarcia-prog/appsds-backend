// Arnés de caracterización: cada endpoint del index.js legado se llama con los mismos
// escenarios en la versión legada y en la actual, y se exige el mismo resultado:
// status, headers, cuerpo y efectos (consultas a Supabase, correos, storage y descargas).
//
// Única diferencia aceptada: los errores no controlados que la versión legada respondía
// con el HTML de Express ahora responden JSON { ok: false, mensaje } con el mismo status.
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const http = require('http')
const fakes = require('./fakes')
const apps = require('./apps')
const { rutasLegadas, escenariosDeRuta, escenariosExtra } = require('./escenarios')

fakes.instalar(apps.RAIZ)

const servidores = {}

before(async () => {
  const iniciar = (app) => new Promise((resolve) => {
    const servidor = http.createServer(app).listen(0, '127.0.0.1', () => resolve(servidor))
  })
  servidores.legada = await iniciar(apps.cargarLegada())
  servidores.actual = await iniciar(apps.cargarActual())
})

after(() => {
  for (const servidor of Object.values(servidores)) servidor.close()
})

function construirCuerpo(cuerpo) {
  if (!cuerpo) return { datos: null, headers: {} }
  if (cuerpo.tipo === 'json') return { datos: Buffer.from(JSON.stringify(cuerpo.cuerpo)), headers: { 'content-type': 'application/json' } }
  if (cuerpo.tipo === 'crudo') return { datos: Buffer.from(cuerpo.cuerpo), headers: { 'content-type': 'application/json' } }
  const limite = '----limite-prueba'
  let texto = ''
  for (const [nombre, valor] of Object.entries(cuerpo.campos)) {
    texto += `--${limite}\r\nContent-Disposition: form-data; name="${nombre}"\r\n\r\n${valor}\r\n`
  }
  const { nombre, tipo, contenido } = cuerpo.archivo
  texto += `--${limite}\r\nContent-Disposition: form-data; name="archivo"; filename="${nombre}"\r\nContent-Type: ${tipo}\r\n\r\n${contenido}\r\n--${limite}--\r\n`
  return { datos: Buffer.from(texto), headers: { 'content-type': `multipart/form-data; boundary=${limite}` } }
}

function peticion(servidor, esc) {
  const { datos, headers } = construirCuerpo(esc.cuerpo)
  const qs = new URLSearchParams(esc.query).toString()
  return new Promise((resolve) => {
    const req = http.request({
      host: '127.0.0.1',
      port: servidor.address().port,
      method: esc.metodo,
      path: esc.url + (qs ? `?${qs}` : ''),
      headers: { ...esc.encabezados, ...headers, ...(datos ? { 'content-length': datos.length } : {}) },
    }, (res) => {
      const trozos = []
      res.on('data', (c) => trozos.push(c))
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, cuerpo: Buffer.concat(trozos) }))
    })
    req.setTimeout(15000, () => { req.destroy(); resolve({ timeout: true }) })
    req.on('error', (e) => resolve({ errorRed: e.code }))
    req.end(datos || undefined)
  })
}

const esperarEfectosPendientes = () => new Promise((r) => setImmediate(() => setImmediate(r)))

function resumir(r) {
  if (r.timeout || r.errorRed) return { ...r }
  const headers = { ...r.headers }
  delete headers.date
  delete headers.connection
  delete headers['keep-alive']
  const tipo = headers['content-type'] || ''
  let cuerpo
  if (tipo.includes('application/json')) cuerpo = JSON.parse(r.cuerpo.toString('utf8'))
  else if (tipo.startsWith('text/')) cuerpo = r.cuerpo.toString('utf8')
  else cuerpo = { bytes: r.cuerpo.length, sha: fakes.sha(r.cuerpo) }
  return { status: r.status, headers, cuerpo }
}

async function ejecutar(servidor, esc) {
  fakes.reiniciar(esc.modo)
  const respuesta = resumir(await peticion(servidor, esc))
  await esperarEfectosPendientes()
  return { respuesta, efectos: fakes.estado.efectos }
}

function esErrorHtmlDeExpress(respuesta) {
  return respuesta.status >= 400
    && (respuesta.headers?.['content-type'] || '').startsWith('text/html')
    && !String(respuesta.cuerpo).includes('<pre>Cannot ')
}

// El HTML de error de Express incluye la traza con rutas de archivo; solo importa el mensaje
const mensajeErrorHtml = (respuesta) => String(respuesta.cuerpo).match(/<pre>(.*?)(<br>|<\/pre>)/)?.[1]

function comparar(legado, actual, contexto) {
  assert.deepStrictEqual(actual.efectos, legado.efectos, `Efectos distintos en ${contexto}`)
  if (esErrorHtmlDeExpress(legado.respuesta) && esErrorHtmlDeExpress(actual.respuesta)) {
    assert.equal(actual.respuesta.status, legado.respuesta.status, `Status distinto en ${contexto}`)
    assert.equal(mensajeErrorHtml(actual.respuesta), mensajeErrorHtml(legado.respuesta), `Error distinto en ${contexto}`)
    return
  }
  if (esErrorHtmlDeExpress(legado.respuesta)) {
    const r = actual.respuesta
    assert.equal(r.status, legado.respuesta.status, `Status distinto en ${contexto}`)
    assert.match(r.headers['content-type'], /application\/json/, `Se esperaba JSON en ${contexto}`)
    assert.equal(r.cuerpo.ok, false, `Se esperaba ok:false en ${contexto}`)
    if (r.status >= 500) assert.equal(r.cuerpo.mensaje, 'Error interno del servidor', `Mensaje distinto en ${contexto}`)
    else assert.equal(typeof r.cuerpo.mensaje, 'string', `Falta mensaje en ${contexto}`)
    return
  }
  assert.deepStrictEqual(actual.respuesta, legado.respuesta, `Respuesta distinta en ${contexto}`)
}

async function verificar(escenarios) {
  for (const esc of escenarios) {
    const legado = await ejecutar(servidores.legada, esc)
    const actual = await ejecutar(servidores.actual, esc)
    comparar(legado, actual, `${esc.metodo} ${esc.url} [${esc.nombre}]`)
  }
}

const rutas = rutasLegadas(apps.fuenteLegada())

test('el index.js legado expone todas las rutas esperadas', () => {
  assert.equal(rutas.length, 142)
})

for (const ruta of rutas) {
  test(`${ruta.metodo} ${ruta.ruta}`, () => verificar(escenariosDeRuta(ruta)))
}

test('escenarios adicionales', () => verificar(escenariosExtra()))
