
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

/**
 * API Route genérica para envío de notificaciones por correo.
 * Soporta diferentes tipos de mensajes y destinatarios.
 */
export async function POST(request: Request) {
  try {
    const { to, subject, title, message, details, type } = await request.json();

    if (!to || !subject || !message) {
      return NextResponse.json({ success: false, message: 'Faltan campos obligatorios' }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Definir colores según el tipo de notificación
    const themeColor = type === 'alert' ? '#e11d48' : (type === 'success' ? '#16a34a' : '#011688');

    const mailOptions = {
      from: `"Notificaciones Routify" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff;">
          <div style="background-color: ${themeColor}; padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; letter-spacing: -1px;">Routify</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0 0; font-size: 12px; text-transform: uppercase; font-weight: bold; letter-spacing: 2px;">Sistema de Distribución</p>
          </div>
          <div style="padding: 40px 30px;">
            <h2 style="color: #1e293b; margin-top: 0; font-size: 20px;">${title || 'Notificación del Sistema'}</h2>
            <p style="color: #475569; line-height: 1.6; font-size: 16px;">${message}</p>
            
            ${details ? `
              <div style="background-color: #f8fafc; border-left: 4px solid ${themeColor}; padding: 20px; margin: 25px 0; border-radius: 4px;">
                <p style="margin: 0; color: #1e293b; font-weight: bold; font-size: 14px; text-transform: uppercase; margin-bottom: 8px;">Detalles adicionales:</p>
                <p style="margin: 0; color: #64748b; font-style: italic; font-size: 15px;">"${details}"</p>
              </div>
            ` : ''}
            
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
              <p style="color: #94a3b8; font-size: 12px; margin-bottom: 5px;">Este es un mensaje automático, por favor no respondas a este correo.</p>
              <p style="color: #94a3b8; font-size: 12px;">© 2026 Farmaenlace | Rutero Distribución</p>
            </div>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ success: true, message: 'Notificación enviada correctamente.' });

  } catch (error: any) {
    console.error('Notification API Error:', error);
    return NextResponse.json(
      { success: false, message: 'Error al enviar la notificación.', details: error.message },
      { status: 500 }
    );
  }
}
