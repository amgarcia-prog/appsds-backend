# CLAUDE.md

Este archivo orienta a Claude Code (claude.ai/code) al trabajar con el código de este repositorio.

## Descripción general

API en Express 5 (CommonJS) para Servidores del Servidor, una comunidad católica organizada por ciudades. Da servicio a un frontend que vive en otro repositorio, desplegado en `https://appsds.vercel.app`; ese frontend no se toca desde aquí. Un mensaje del historial de commits indica que la API corre en Railway. Los datos y los archivos están en Supabase, y los correos salen por Resend.

Los términos del dominio, los identificadores, los mensajes de la API y los commits están en español. Mantén en español el código nuevo y los asuntos de los commits (en infinitivo y sin prefijo: `Agregar ...`, `Migrar ...`).

## Comandos

```sh
npm ci            # dependencias exactas del lockfile
node index.js     # escucha en PORT o en 3001
npm test          # arnés de caracterización (node --test, ~8 s)
node --test --test-name-pattern="financiero/ingresos"   # solo los endpoints cuyo nombre coincide
```

Si `node` no está en el PATH del shell, carga nvm primero: `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"`.

Variables requeridas en `.env`: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, `CORREO_INSTITUCIONAL`. Sin `SUPABASE_URL` el servidor no arranca; para una prueba local basta con valores ficticios y `GET /api/health`.

`.env` en realidad no está ignorado: `.gitignore` tiene bytes UTF-16 que dañan esa entrada. Nunca lo agregues al índice; usa `git add` con rutas explícitas.

No hay linter ni paso de compilación.

## Arquitectura

MVC sobre Express. Una petición recorre:

```
index.js → src/app.js → routes/ → middlewares/auth → controllers/ → services/ → models/ → Supabase / Resend / Storage
                                                          └→ views/ (correos, Excel, PDF, ZIP)
```

| Capa | Responsabilidad | No hace |
|---|---|---|
| `src/routes/` | URL completa (`/api/...`), middlewares y acción del controlador | Lógica |
| `src/controllers/` | Leer `req`, validar entrada, elegir status y cuerpo, escribir archivos en `res` | Consultas, reglas de negocio |
| `src/services/` | Casos de uso, reglas, cálculos; orquestan modelos y vistas | Leer `req` o escribir `res` |
| `src/models/` | Consultas exactas a Supabase, Storage, Resend, `pdfs/` y descargas HTTP | Reglas de negocio |
| `src/views/` | `correos.js` (HTML), `reportes/excel.js`, `reportes/recibo.js` (PDF y ZIP), `reportes/imagenes.js` | Consultas |
| `src/middlewares/` | `auth.js` (guards) y `errorHandler.js` | |
| `src/config/` | `env.js` (constantes), clientes de Supabase y Resend, multer | |
| `src/utils/` | `fechas.js` (`rangoMes`), `numLetras.js`, `respuestas.js` | |

Dependencias permitidas: routes → middlewares, controllers; controllers → services, views, utils; services → services, models, views, utils, config; models → config; middlewares → services. Solo `models/` y `config/` importan `config/supabase`. No hay ciclos; mantenlo así.

Inyección de dependencias: sin contenedor. Los clientes externos se crean una sola vez en `config/` y se obtienen con `require`; el arnés los sustituye en `require.cache`.

### Convenciones

- **Modelos** devuelven el `{ data, error }` de Supabase sin transformarlo. Un modelo por tabla (`registrosModel`, `ingresosModel`, ...); `movimientosModel` es la base común de ingresos y egresos.
- **Servicios** con varios desenlaces devuelven `{ resultado: 'no_encontrado' | 'ok' | ... }` y el controlador traduce cada uno a status y mensaje (ver `authController`, `evaluacionController`). Las escrituras simples devuelven `{ error }`.
- **Controladores**: `utils/respuestas.js` tiene `responderEscritura` (`{ ok: true }` o 500 con `error.message`) y `responderCreacion` (`{ ok: true, data }`).
- **Formas de respuesta**: cada ruta conserva la del sistema original y no se unifican: `{ ok, mensaje }` en la mayoría; `{ error }` en CIO, financiero, organizacional y pilar; listas que fallan devuelven `[]`.
- **Errores**: Express 5 envía las promesas rechazadas a `errorHandler`, que responde `{ ok: false, mensaje }` (500 con `'Error interno del servidor'`). Algunas rutas (contacto, recibos, reportes de imágenes, registro) atrapan sus propias excepciones con respuestas específicas.

### Agregar un endpoint

1. Consulta en el modelo de la tabla (o uno nuevo en `src/models/`).
2. Lógica en el servicio del módulo.
3. Validación y respuesta en el controlador.
4. Ruta completa en el router del módulo, con su guard. Si es un módulo nuevo, agrega el router a la lista de `src/app.js`.
5. El arnés solo cubre las rutas del sistema original: prueba el endpoint nuevo aparte.

### Autenticación

No hay sesiones ni tokens. `POST /api/login` compara `clave` en texto plano y devuelve el miembro con sus roles. Luego el frontend envía el UUID del miembro en `x-miembro-id`, y el servidor lo acepta como identidad sin verificarlo.

- `middlewares/auth.js`: `verificarFinanciero`, `verificarComunicaciones`, `verificarComunicacionesConsejo` y `verificarPilarOrganizacional` consultan al miembro en cada petición; `verificarAdmin` (`x-admin-key`) y `verificarCIO` (`x-cio-key`) comparan con claves fijas de `config/env.js`; `exigirMiembroId(cuerpo401)` solo exige que llegue el header.
- Muchas rutas no tienen guard o solo usan `exigirMiembroId` (`/api/formacion/*`, `/api/obras/*`, `/api/consejo/*`, `/api/upload`, `/api/evaluacion/*`). No supongas que una ruta está protegida por su prefijo.
- Los permisos salen del arreglo `registros.roles` y de las etiquetas en español de `responsabilidades_consejo` y `responsabilidades_pilar`. Todas esas reglas están en `services/rolesService.js` (`rolesDeMiembro` para el login y los predicados de cada guard).

### Modelo de datos

`registros` es la tabla central: miembros, claves, roles y estado del proceso. Dos campos se confunden con facilidad:

- `estado_consagracion` es la condición del miembro (por ejemplo `paciente`, `servita`, `pilar`).
- `estado_proceso` es la etapa del proceso de consagración; las transiciones están documentadas en `services/formacionService.js`.

Cada cambio de `estado_proceso` debe llamar a `agregarHistorial` (`services/historialService.js`), que agrega una entrada al arreglo JSON `historial_proceso`.

`select('*')` sobre `registros` incluye `clave` y `reset_token`; quítalos de cualquier respuesta nueva.

### Alcance por ciudad

La mayoría de los datos operativos se separan por una columna de texto `ciudad`. Los guards dejan la ciudad del miembro en `req.ciudadFinanciero` o `req.ciudadComunicaciones`, y toda consulta e inserción de esos módulos debe filtrar por ella; nunca tomes la ciudad del cliente. Según la tabla se compara con `.eq` o con `.ilike`; sigue lo que hace el modelo correspondiente.

### Finanzas

Cada `ingreso` y `egreso` pertenece a una `cuenta` (`banco`, `caja_menor`, `consumo_caja_menor`, `especie`). Los saldos se calculan con `financieroService.saldoAnterior` (saldo inicial + ingresos − egresos anteriores) y el siguiente número de recibo con `recibosService.proximoNumero` (el mayor `numero_recibo` de la ciudad + 1).

Los reportes mensuales están en `reportesService` + `reportesController`. Los tres de movimiento comparten `excel.movimientoDeCuenta`: para una cuenta nueva basta con sus columnas en `COLUMNAS_MOVIMIENTO` (vista y servicio), una entrada en el controlador y la ruta.

## Arnés de caracterización

`tests/caracterizacion/` carga en el mismo proceso el `index.js` original (commit `bbf2628`, leído con `git show`) y la versión actual, y llama a cada una de las 142 rutas originales con ~18 escenarios: modos de Supabase (filas, vacío, error, excepción, sin permisos), fallas de Resend y variantes de headers y cuerpo. Exige igualdad en status, headers, cuerpo (hash para Excel, PDF y ZIP) y efectos: la cadena exacta de cada consulta a Supabase, los correos, Storage y las descargas. Supabase, Resend, HTTP(S), la fecha y `crypto.randomBytes` son dobles en `fakes.js`: nunca toca servicios reales.

La única diferencia aceptada es la del manejador de errores: donde el original respondía el HTML de Express, ahora debe responder JSON `{ ok: false, mensaje }` con el mismo status.

Si cambias el comportamiento de una ruta a propósito, el arnés fallará: declara la diferencia esperada en `comparar()` (`caracterizacion.test.js`), con la razón en un comentario, en lugar de debilitar la comparación general.

## Cambios en la base de datos

`sql/` es un conjunto de scripts escritos a mano, sin herramienta de migraciones ni orden definido, así que nada en este repositorio los aplica; hay que ejecutarlos en Supabase por separado. Crea un archivo nuevo por cada cambio de esquema y activa `enable row level security` en toda tabla nueva. El backend usa la clave de service role, que ignora RLS, así que no hacen falta políticas.

`reportes_donacion.sql` y `reportes_donacion_completo.sql` crean la misma tabla; el segundo además tiene `cedula`, `correo` y `direccion`.
