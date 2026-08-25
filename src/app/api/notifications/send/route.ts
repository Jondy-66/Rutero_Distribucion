import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeAdminApp } from '@/lib/firebase/admin-config';

/**
 * API Route para envío de notificaciones por correo.
 * Implementa transporte SMTP robusto con soporte para CC de auditoría.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { to, subject, title, message, details, type, eventKey, cc: manualCc } = body;

    if (!to || !subject || !message) {
      return NextResponse.json({ success: false, message: 'Faltan campos obligatorios' }, { status: 400 });
    }

    // 1. Validar Credenciales de Email
    const userEmail = process.env.EMAIL_USER;
    const userPass = process.env.EMAIL_PASS;

    if (!userEmail || !userPass) {
      console.error('CRITICAL: EMAIL_USER o EMAIL_PASS no configurados.');
      return NextResponse.json({ success: false, message: 'Configuración de servidor incompleta.' }, { status: 500 });
    }

    // 2. Cargar Configuración de Auditoría (CC)
    const adminApp = initializeAdminApp();
    let autoCcList: string[] = [];

    if (adminApp) {
      try {
        const db = getFirestore(adminApp);
        const configSnap = await db.collection('system_config').doc('notifications').get();
        
        if (configSnap.exists) {
          const config = configSnap.data();
          if (config?.enabledCc) {
            const key = eventKey || 'manual';
            const isEventEnabled = config.ccEvents ? config.ccEvents[key] : true;

            if (isEventEnabled) {
              if (Array.isArray(config.ccEmails)) {
                autoCcList = config.ccEmails;
              } else if (config.ccEmail) {
                autoCcList = [config.ccEmail];
              }
            }
          }
        }
      } catch (dbError) {
        console.warn('DB CC Config Warning:', dbError);
      }
    }

    // 3. Configurar transporte SMTP Seguro y Robusto
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, 
      pool: true, // Usar pool para mayor rendimiento
      auth: {
        user: userEmail,
        pass: userPass,
      },
      tls: {
        rejectUnauthorized: false // Mayor compatibilidad en servidores cloud
      }
    });

    // 4. Consolidar destinatarios de copia (CC)
    const finalCcSet = new Set<string>();
    const normalizedTo = to.trim().toLowerCase();

    if (manualCc && manualCc.trim().toLowerCase() !== normalizedTo) {
      finalCcSet.add(manualCc.trim().toLowerCase());
    }

    autoCcList.forEach(email => {
      const normalizedEmail = email.trim().toLowerCase();
      if (normalizedEmail && normalizedEmail !== normalizedTo) {
        finalCcSet.add(normalizedEmail);
      }
    });
    
    const ccHeader = Array.from(finalCcSet).join(', ');
    const themeColor = type === 'alert' ? '#e11d48' : (type === 'success' ? '#16a34a' : '#011688');

    const mailOptions = {
      from: `"Routify Sistema" <${userEmail}>`,
      to: normalizedTo,
      cc: ccHeader || undefined,
      subject: subject,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff;">
          <div style="background-color: ${themeColor}; padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; letter-spacing: -1px;">Routify</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0 0; font-size: 12px; text-transform: uppercase; font-weight: bold; letter-spacing: 2px;">Notificación Automática</p>
          </div>
          <div style="padding: 40px 30px;">
            <h2 style="color: #1e293b; margin-top: 0; font-size: 20px;">${title || 'Comunicado del Sistema'}</h2>
            <p style="color: #475569; line-height: 1.6; font-size: 16px;">${message}</p>
            
            ${details ? `
              <div style="background-color: #f8fafc; border-left: 4px solid ${themeColor}; padding: 20px; margin: 25px 0; border-radius: 4px;">
                <p style="margin: 0; color: #1e293b; font-weight: bold; font-size: 14px; text-transform: uppercase; margin-bottom: 8px;">Detalles:</p>
                <p style="margin: 0; color: #64748b; font-style: italic; font-size: 15px;">"${details}"</p>
              </div>
            ` : ''}
            
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
              <p style="color: #94a3b8; font-size: 11px;">Este es un mensaje automático. Por favor no responder.</p>
              <p style="color: #94a3b8; font-size: 11px;">© 2026 Farmaenlace | Rutero Distribución</p>
            </div>
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);

    return NextResponse.json({ 
      success: true, 
      messageId: info.messageId,
      auditCcCount: finalCcSet.size 
    });

  } catch (error: any) {
    console.error('Notification API Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message
    }, { status: 500 });
  }
}
