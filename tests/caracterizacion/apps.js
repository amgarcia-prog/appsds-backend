// Carga dos instancias de la API en el mismo proceso: la versión legada (index.js del
// commit anterior a la refactorización) y la versión actual del repositorio.
const path = require('path')
const Module = require('module')
const { execFileSync } = require('child_process')

const RAIZ = path.resolve(__dirname, '..', '..')

// Último commit con el index.js monolítico
const REF_LEGADO = 'bbf2628'

function fuenteLegada() {
  return execFileSync('git', ['show', `${REF_LEGADO}:index.js`], { cwd: RAIZ, encoding: 'utf8' })
}

// index.js llama a app.listen() al cargarse; se intercepta para quedarse con la app sin abrir el puerto
function capturarApp(cargar) {
  const express = require(require.resolve('express', { paths: [RAIZ] }))
  const listenOriginal = express.application.listen
  let app = null
  express.application.listen = function () {
    app = this
    return { close() {} }
  }
  try {
    cargar()
  } finally {
    express.application.listen = listenOriginal
  }
  if (!app) throw new Error('La aplicación no llamó a listen()')
  return app
}

function cargarLegada() {
  // Se compila con __dirname en la raíz para que encuentre pdfs/ y node_modules/
  const archivo = path.join(RAIZ, 'index.legado.js')
  return capturarApp(() => {
    const m = new Module(archivo, module)
    m.filename = archivo
    m.paths = Module._nodeModulePaths(RAIZ)
    m._compile(fuenteLegada(), archivo)
  })
}

function cargarActual() {
  return capturarApp(() => require(path.join(RAIZ, 'index.js')))
}

module.exports = { RAIZ, fuenteLegada, cargarLegada, cargarActual }
