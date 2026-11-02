# Propuesta de arquitectura MVC del backend

Estado: implementada en la rama `feature/backend-mvc`. La arquitectura vigente está documentada en `CLAUDE.md`; las diferencias con esta propuesta están al final.

## 1. Diagnóstico de la arquitectura actual

- **Tecnologías**: Node.js con Express 5.2 (CommonJS), `@supabase/supabase-js` 2.x (base de datos y Storage), Resend 6 (correo), ExcelJS 4, PDFKit 0.19, archiver 6, multer 2, cors, dotenv. `xlsx` está declarada pero no se usa; se conserva.
- **Estructura**: un solo proyecto con un único `index.js` de 2.795 líneas. No hay capas: cada handler valida, autoriza, consulta Supabase, aplica reglas, arma correos HTML o archivos y responde.
- **Endpoints**: 142 rutas agrupadas por prefijo (`/api/formacion`, `/api/financiero`, `/api/cio`, ...).
- **Autorización**: 6 middlewares (`verificarAdmin`, `verificarCIO`, `verificarComunicaciones`, `verificarComunicacionesConsejo`, `verificarPilarOrganizacional`, `verificarFinanciero`) más verificaciones dentro de los handlers.
- **Pruebas**: no existen. `npm test` es un marcador que falla.
- **Patrones**: solo middlewares de Express; no hay servicios, repositorios ni manejo central de errores.

## 2. Problemas y oportunidades

| Problema | Ejemplo | Mejora |
|---|---|---|
| Responsabilidades mezcladas | Los reportes Excel consultan, calculan saldos, dan formato y escriben la respuesta en una sola función | Separar consulta (model), cálculo (service) y formato (view) |
| Duplicación | Rango de mes ×10, arreglo `MESES` ×8, cálculo de saldo ×4, nombre del responsable ×6, encabezado y pie de correo ×2 | Utilidades y servicios compartidos |
| Reglas de roles repartidas | `/api/login` y cada guard derivan los roles por separado | Un único `rolesService` |
| Constantes dispersas | `FRONTEND_URL`, `LOGO_URL`, claves fijas | `config/env.js` |
| Sin manejo central de errores | Una excepción devuelve el HTML de Express con la traza | `errorHandler` que responde JSON |
| Sin red de seguridad | Ningún cambio se puede verificar | Arnés de caracterización con `node:test` |

**Fuera de alcance** (cambiarlos alteraría reglas de negocio o contratos): claves en texto plano, `x-miembro-id` aceptado sin verificar, claves de admin y CIO fijas en el código, rutas sin guard y `select('*')` que devuelve `clave` y `reset_token`.

## 3. Arquitectura propuesta

MVC con las piezas idiomáticas de Express:

- **Routes**: declaran URL, middlewares y la acción del controlador. Sin lógica.
- **Controllers** (presentación HTTP): leen `req`, validan la entrada, llaman al servicio y deciden status y cuerpo. No consultan la base de datos.
- **Services** (aplicación): casos de uso y reglas de negocio. Coordinan modelos y vistas.
- **Models** (acceso a datos): consultas a Supabase y Storage, y descargas externas. Son la única capa que conoce el cliente Supabase. Devuelven `{ data, error }` tal como lo entrega Supabase.
- **Views**: lo que el backend genera para el exterior además del JSON: correos HTML, Excel, PDF y ZIP. No hay vistas de interfaz de usuario.
- **Middlewares**: autorización y manejo central de errores.

## 4. Diagrama de dependencias

```
              index.js (arranque)
                   │
                src/app.js ──► middlewares/errorHandler
                   │
                routes/* ──► middlewares/auth ──► services/rolesService
                   │
              controllers/* ──► views/* (escribir archivos en la respuesta)
                   │
               services/* ──► views/*, utils/*
                   │
                models/* ──► config/ (supabase, resend)
```

Prohibido: routes o controllers que importen `config/supabase`; models que importen services; dependencias circulares.

## 5. Estructura de carpetas

```
index.js                 carga .env, arranca src/app y escucha en PORT
src/
  app.js                 express(), cors, json, routers, errorHandler
  config/                env.js, supabase.js, resend.js, upload.js
  middlewares/           auth.js, errorHandler.js
  routes/                <modulo>Routes.js
  controllers/           <modulo>Controller.js
  services/              <modulo>Service.js, rolesService.js, historialService.js
  models/                <tabla>Model.js, storageModel.js, imagenesModel.js
  views/                 correos.js, reportes/excel.js, reportes/pdf.js
  utils/                 fechas.js, numLetras.js
tests/caracterizacion/   arnés que compara la versión legada con la actual
```

Módulos: `auth`, `miembro`, `formacion` (con junta), `admin`, `comunicaciones`, `miCiudad`, `consejo`, `obras`, `general`, `cio`, `pilar` (con organizacional), `financiero`, `evaluacion`.

## 6. Responsabilidades

| Capa | Hace | No hace |
|---|---|---|
| Route | URL + middlewares + acción | Lógica |
| Controller | Validar entrada, elegir status, dar forma a la respuesta | Consultar la base de datos, reglas de negocio |
| Service | Reglas, cálculos, orquestar modelos, correos y reportes | Leer `req` o escribir `res` |
| Model | Consultas exactas a Supabase y Storage | Reglas de negocio |
| View | Plantillas de correo, Excel, PDF, ZIP | Consultas |

## 7. Archivos

- **Crear**: todo `src/`, `tests/caracterizacion/`, `.ai/plans/architecture-proposal.md`.
- **Modificar**: `index.js` (solo arranque), `package.json` (script `test`, sin dependencias nuevas), `CLAUDE.md` (documentación final; cumple el papel de `AGENTE.md`, que no existe).
- **Temporal**: `src/routes/legado.js` guarda las rutas aún no migradas y se elimina en la última etapa.
- **Eliminar**: nada más. `sql/` y `pdfs/` no cambian.

## 8. Impacto sobre los endpoints

Ninguno en rutas, métodos, parámetros, headers, códigos ni cuerpos. Única diferencia, decidida explícitamente: una excepción no controlada responde `500 { ok: false, mensaje: 'Error interno del servidor' }` en JSON en lugar del HTML de Express (y los errores 4xx de Express, como JSON mal formado, responden `{ ok: false, mensaje }` con el mismo status).

## 9. Impacto sobre la inyección de dependencias

Sin contenedor: los módulos CommonJS reciben sus dependencias con `require` desde `config/`. Los clientes de Supabase y Resend se crean una sola vez en `config/`, lo que permite sustituirlos en las pruebas mediante `require.cache`.

## 10. Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Cambiar una consulta sin notarlo | El arnés compara la cadena exacta de cada consulta a Supabase |
| Cambiar un cuerpo, header o archivo | El arnés compara status, headers, JSON y hash de PDF, Excel y ZIP en 2.500+ escenarios |
| Romper el orden de las rutas | Se conservan las rutas completas; ninguna ruta de un módulo se solapa con otra |
| Perder datos que los guards dejan en `req` | Se mantienen `req.ciudadFinanciero` y `req.ciudadComunicaciones` |
| Unificar sin querer las respuestas de error | Cada controlador conserva la forma exacta de su ruta (`{ ok, mensaje }`, `{ error }`, `[]`) |
| Tocar datos reales | El arnés usa dobles; nunca llama a Supabase ni a Resend |

## 11. Plan de migración por etapas

Cada etapa termina con el arnés en verde, el servidor arrancando y un commit propio.

0. Arnés de caracterización y esta propuesta.
1. Esqueleto: `src/app.js`, `config/`, middlewares, utilidades y servicios compartidos. Las rutas pasan sin cambios a `src/routes/legado.js`.
2. Módulos pequeños: `general`, `comunicaciones`, `miCiudad`, `cio`, `evaluacion`.
3. `obras`, `consejo`, `pilar`, `admin`.
4. `auth` y `miembro`.
5. `formacion` y `junta`.
6. `financiero`: movimientos y consultas; recibos; reportes.
7. Eliminar `legado.js` y actualizar `CLAUDE.md`.

## Diferencias entre la propuesta y la implementación

- Las vistas de reportes quedaron como `views/reportes/excel.js`, `recibo.js` (PDF y ZIP) e `imagenes.js` en lugar de `pdf.js` y `zip.js`.
- No se creó `HttpError`: los servicios devuelven `{ resultado }` y los controladores lo traducen, lo que deja los status y mensajes en la capa de presentación.
- Se agregaron modelos para todo acceso externo: `correoModel` (Resend), `documentosModel` (`pdfs/`), `imagenesModel` (logo y comprobantes) y `movimientosModel` (base común de ingresos y egresos).
- Se agregaron `utils/respuestas.js` (respuestas repetidas de los controladores) y el middleware `exigirMiembroId`, que reemplaza el chequeo de `x-miembro-id` repetido en decenas de handlers.
- El PNG de prueba del arnés no tiene canal alfa: con alfa, PDFKit procesa la imagen con zlib asíncrono y el orden de los objetos del PDF variaba entre corridas.
