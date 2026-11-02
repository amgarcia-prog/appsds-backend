// Plantillas HTML de los correos que envía el backend

// Encabezado azul y pie con el sitio web, compartidos por los correos a miembros
const conMarcoInstitucional = (contenido) => `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #1e40af; padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 20px;">Servidores del Servidor</h1>
            <p style="color: #bfdbfe; margin: 4px 0 0; font-size: 14px;">Donum Christi Comunidad Apostólica</p>
          </div>
          <div style="padding: 32px 24px;">
${contenido}
          </div>
          <div style="background-color: #f9fafb; padding: 16px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">www.servidoresdelservidor.org</p>
          </div>
        </div>
      `

const bienvenida = (nombreCompleto) => conMarcoInstitucional(`
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
            <p style="color: #1f2937; font-weight: bold;">Equipo Servidores del Servidor</p>`)

const recuperacionClave = (nombre, enlace) => conMarcoInstitucional(`
            <p style="font-size: 16px; color: #1f2937;">Servido sea Jesucristo,</p>
            <p style="font-size: 16px; color: #1f2937;">Estimado(a) <strong>${nombre}</strong>,</p>
            <p style="color: #4b5563;">Recibimos una solicitud para restablecer tu clave de acceso al portal. Haz clic en el siguiente botón para crear una clave nueva. Este enlace vence en 1 hora.</p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${enlace}" style="background-color: #1e40af; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Crear nueva clave</a>
            </div>
            <p style="color: #9ca3af; font-size: 13px;">Si tú no solicitaste esto, puedes ignorar este correo — tu clave actual seguirá funcionando.</p>
            <p style="color: #1f2937; font-weight: bold;">Equipo Servidores del Servidor</p>`)

const contacto = ({ nombre, email, asunto, mensaje }) => `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #1e40af; padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 20px;">Nuevo mensaje de contacto</h1>
          </div>
          <div style="padding: 24px; color: #1f2937;">
            <p><strong>Nombre:</strong> ${nombre}</p>
            <p><strong>Correo:</strong> ${email}</p>
            ${asunto ? `<p><strong>Asunto:</strong> ${asunto}</p>` : ''}
            <p><strong>Mensaje:</strong></p>
            <p style="white-space: pre-wrap;">${mensaje}</p>
          </div>
        </div>
      `

const masivo = (cuerpo) =>
  `<div style="font-family:sans-serif;max-width:600px;margin:auto"><p style="white-space:pre-line">${cuerpo}</p><hr style="margin-top:32px"><p style="color:#888;font-size:12px">Servidores del Servidor</p></div>`

const reciboDonacion = (nombre, numRecibo) => `
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
      `

module.exports = { bienvenida, recuperacionClave, contacto, masivo, reciboDonacion }
