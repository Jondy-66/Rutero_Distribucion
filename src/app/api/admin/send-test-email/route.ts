
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

/**
 * API Route para envío de correos utilizando Nodemailer y Gmail.
 * Configura el transporte de forma segura mediante variables de entorno.
 */
export async function POST(request: Request) {
  try {
    const { to, subject, text } = await request.json();

    if (!to || !subject || !text) {
      return NextResponse.json({ success: false, message: 'Faltan campos obligatorios' }, { status: 400 });
    }

    // 1. Configurar el transporte usando Gmail y variables de entorno definidas en .env.local
    // Se utiliza EMAIL_USER para el correo remitente y EMAIL_PASS para la contraseña de aplicación.
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // 2. Definir el contenido del correo electrónico
    const mailOptions = {
      from: `"Administración Routify" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #f9f9f9;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #011688; margin: 0;">Routify</h1>
            <p style="color: #666; font-size: 14px; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">Prueba de Servidor de Correo</p>
          </div>
          <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <h2 style="color: #333; margin-top: 0;">Hola,</h2>
            <p style="color: #555; line-height: 1.6; font-size: 16px;">
              Este es un correo de prueba enviado desde el sistema <strong>Routify</strong> para validar la configuración de Nodemailer.
            </p>
            <div style="background-color: #f0f4ff; border-left: 4px solid #011688; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #333; font-style: italic;">"${text}"</p>
            </div>
            <p style="color: #888; font-size: 12px; margin-top: 30px;">
              Si has recibido este correo, significa que las variables <strong>EMAIL_USER</strong> y <strong>EMAIL_PASS</strong> están correctamente configuradas en tu servidor.
            </p>
          </div>
          <div style="text-align: center; margin-top: 20px; color: #999; font-size: 11px;">
            © 2026 Farmaenlace | Rutero Distribución. Todos los derechos reservados.
          </div>
        </div>
      `,
    };

    // 3. Ejecutar el envío
    await transporter.sendMail(mailOptions);

    return NextResponse.json({ 
      success: true, 
      message: 'Correo de prueba enviado con éxito a ' + to 
    });

  } catch (error: any) {
    console.error('Nodemailer Error:', error);
    
    let errorMessage = 'Error al procesar el envío del correo.';
    if (error.code === 'EAUTH') {
      errorMessage = 'Error de Autenticación: Verifica que EMAIL_USER y EMAIL_PASS sean correctos y que las "Contraseñas de Aplicación" estén activadas.';
    }

    return NextResponse.json(
      { success: false, message: errorMessage, details: error.message },
      { status: 500 }
    );
  }
}
