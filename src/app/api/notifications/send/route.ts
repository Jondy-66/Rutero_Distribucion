import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeAdminApp } from '@/lib/firebase/admin-config';

/**
 * API Route para envío de notificaciones por correo.
 * Implementa lógica de auditoría automática basada en la configuración de la base de datos.
 */
export async function POST(request: Request) {
  try {
    const { to, subject, title, message, details, type, eventKey, cc: manualCc } = await request.json();

    if (!to || !subject || !message) {
      return NextResponse.json({ success: false, message: 'Faltan campos obligatorios' }, { status: 400 });
    }

    // 1. Inicializar Admin SDK dentro del handler para asegurar carga de env vars
    const adminApp = initializeAdminApp();
    let autoCcList: string[] = [];

    if (adminApp) {
      try {
        const db = getFirestore(adminApp);
        const configSnap = await db.collection('system_config').doc('notifications').get();
        
        if (configSnap.exists) {
          const config = configSnap.data();
          
          // Validar si el protocolo de Copia de Auditoría (CC) está activo globalmente
          if (config?.enabledCc) {
            const key = eventKey || 'manual';
            // Verificar si este tipo de evento específico tiene el "check" de auditoría activado
            const isEventEnabled = config.ccEvents ? config.ccEvents[key] : true;

            if (isEventEnabled) {
              // Obtener lista de correos configurada (array o campo único por compatibilidad)
              if (Array.isArray(config.ccEmails)) {
                autoCcList = config.ccEmails;
              } else if (config.ccEmail) {
                autoCcList = [config.ccEmail];
              }
            }
          }
        }
      } catch (dbError) {
        console.warn('Advertencia: No se pudo cargar la configuración de CC desde Firestore, procediendo solo con destinatario principal.');
      }
    }

    // 2. Configurar transporte Nodemailer utilizando Gmail
    // Requiere EMAIL_USER y EMAIL_PASS (Contraseña de Aplicación)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // 3. Consolidar lista de copias (CC)
    // Se eliminan duplicados y se asegura que el destinatario principal no esté en el CC
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

    // Definir color del tema según la prioridad de la notificación
    const themeColor = type === 'alert' ? '#e11d48' : (type === 'success' ? '#16a34a' : '#011688');

    const mailOptions = {
      from: `"Routify Sistema" <${process.env.EMAIL_USER}>`,
      to: normalizedTo,
      cc: ccHeader || undefined,
      subject: subject,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff;">
          <div style="background-color: ${themeColor}; padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; letter-spacing: -1px;">Routify</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0 0; font-size: 12px; text-transform: uppercase; font-weight: bold; letter-spacing: 2px;">Notificación de Distribución</p>
          </div>
          <div style="padding: 40px 30px;">
            <h2 style="color: #1e293b; margin-top: 0; font-size: 20px;">${title || 'Comunicado del Sistema'}</h2>
            <p style="color: #475569; line-height: 1.6; font-size: 16px;">${message}</p>
            
            ${details ? `
              <div style="background-color: #f8fafc; border-left: 4px solid ${themeColor}; padding: 20px; margin: 25px 0; border-radius: 4px;">
                <p style="margin: 0; color: #1e293b; font-weight: bold; font-size: 14px; text-transform: uppercase; margin-bottom: 8px;">Detalles / Observaciones:</p>
                <p style="margin: 0; color: #64748b; font-style: italic; font-size: 15px;">"${details}"</p>
              </div>
            ` : ''}
            
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
              <p style="color: #94a3b8; font-size: 12px; margin-bottom: 5px;">Mensaje automático. Por favor no responder.</p>
              <p style="color: #94a3b8; font-size: 12px;">© 2026 Farmaenlace | Rutero Distribución</p>
            </div>
          </div>
        </div>
      `,
    };

    // 4. Ejecutar envío
    await transporter.sendMail(mailOptions);

    return NextResponse.json({ 
      success: true, 
      message: 'Notificación enviada correctamente.',
      auditCcCount: finalCcSet.size 
    });

  } catch (error: any) {
    console.error('Notification API Error:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Error al procesar el envío del correo.',
      error: error.message 
    }, { status: 500 });
  }
}
