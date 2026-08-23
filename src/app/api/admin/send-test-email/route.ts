import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

/**
 * API Route para envío de correos de prueba.
 * Utilizada para validar la conectividad SMTP con Gmail.
 */
export async function POST(request: Request) {
  try {
    const { to, subject, text } = await request.json();

    if (!to || !subject || !text) {
      return NextResponse.json({ success: false, message: 'Faltan campos obligatorios' }, { status: 400 });
    }

    const userEmail = process.env.EMAIL_USER;
    const userPass = process.env.EMAIL_PASS;

    if (!userEmail || !userPass) {
      return NextResponse.json({ success: false, message: 'Configuración faltante: EMAIL_USER o EMAIL_PASS.' }, { status: 500 });
    }

    // Configuración SMTP Segura
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: userEmail,
        pass: userPass,
      },
    });

    const mailOptions = {
      from: `"Administración Routify" <${userEmail}>`,
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
              Si has recibido este correo, las variables <strong>EMAIL_USER</strong> y <strong>EMAIL_PASS</strong> están correctamente configuradas.
            </p>
          </div>
          <div style="text-align: center; margin-top: 20px; color: #999; font-size: 11px;">
            © 2026 Farmaenlace | Rutero Distribución
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ 
      success: true, 
      message: 'Correo de prueba enviado con éxito a ' + to 
    });

  } catch (error: any) {
    console.error('Nodemailer Error:', error);
    return NextResponse.json(
      { success: false, message: 'Fallo al enviar correo: ' + error.message, code: error.code },
      { status: 500 }
    );
  }
}
