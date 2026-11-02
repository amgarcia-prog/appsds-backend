// Configuración y constantes de la aplicación. Los valores fijos son los que ya usaba el
// index.js original; moverlos a variables de entorno cambiaría la configuración del despliegue.
module.exports = {
  PORT: process.env.PORT || 3001,
  FRONTEND_URL: 'https://appsds.vercel.app',
  LOGO_URL: 'https://gvdgqwxbkcauephznqfd.supabase.co/storage/v1/object/public/Comprobantes/Logos/Logo%20Servidores.jpg',
  ADMIN_KEY: 'SDS2026admin',
  CIO_KEY: 'CIO2026',
  REMITENTE: 'Servidores del Servidor <amgarcia@servidoresdelservidor.org>',
  CORREO_ADMINISTRACION: 'administracion@servidoresdelservidor.org',
  // Se lee en cada uso, como en el original
  get CORREO_INSTITUCIONAL() {
    return process.env.CORREO_INSTITUCIONAL
  },
}
