import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      taskTitle,
      category,
      location,
      deadlineText,
      priority,
      recipientEmails,
      taskId
    } = body;

    const user = process.env.SMTP_USER || process.env.EMAIL_USER;
    const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
    const adminEmail = process.env.ADMIN_ALERT_EMAIL || user;

    if (!user || !pass) {
      console.warn('⚠️ [Nodemailer] SMTP_USER or SMTP_PASS is missing in .env.local. Email notification skipped.');
      return NextResponse.json({
        success: false,
        message: 'SMTP credentials not configured. Please add SMTP_USER and SMTP_PASS to .env.local to enable real email delivery.'
      });
    }

    const recipients: string[] = [];
    if (adminEmail) recipients.push(adminEmail);
    if (Array.isArray(recipientEmails)) {
      recipientEmails.forEach((email: string) => {
        if (email && !recipients.includes(email)) {
          recipients.push(email);
        }
      });
    }

    if (recipients.length === 0) {
      return NextResponse.json({ success: false, message: 'No recipient email specified.' });
    }

    // Configure Nodemailer transporter (Gmail service default)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass,
      },
    });

    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location || 'Kerala')}`;
    const adminUrl = process.env.NEXT_PUBLIC_APP_URL 
      ? `${process.env.NEXT_PUBLIC_APP_URL}/admin`
      : 'http://localhost:3000/admin';

    const mailOptions = {
      from: `"LocalEnd Emergency SLA" <${user}>`,
      to: recipients.join(', '),
      subject: `🚨 [EMERGENCY SLA ALERT] ${category || 'Urgent Task'}: ${taskTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #fee2e2; box-shadow: 0 10px 25px -5px rgba(220, 38, 38, 0.1); }
            .header { background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); padding: 28px 24px; text-align: center; color: white; }
            .header h1 { margin: 0 0 8px 0; font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
            .header p { margin: 0; font-size: 14px; opacity: 0.9; }
            .badge { display: inline-block; background: rgba(255,255,255,0.25); padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; margin-top: 10px; text-transform: uppercase; }
            .content { padding: 28px 24px; }
            .alert-box { background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 8px; padding: 14px 16px; margin-bottom: 24px; font-size: 14px; color: #991b1b; }
            .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
            .detail-label { color: #64748b; font-weight: 500; }
            .detail-value { color: #0f172a; font-weight: 600; text-align: right; }
            .location-link { color: #2563eb; text-decoration: none; font-weight: 600; }
            .location-link:hover { text-decoration: underline; }
            .actions { margin-top: 32px; text-align: center; }
            .cta-button { display: inline-block; background: #ef4444; color: #ffffff !important; font-weight: 700; font-size: 15px; padding: 14px 28px; border-radius: 12px; text-decoration: none; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3); }
            .footer { background: #f8fafc; padding: 18px 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚨 Emergency SLA Alert</h1>
              <p>Immediate action required for unassigned emergency request</p>
              <span class="badge">${priority || 'URGENT'} PRIORITY</span>
            </div>
            <div class="content">
              <div class="alert-box">
                ⏰ <strong>Critical Time Window:</strong> This task is nearing its scheduled deadline (<strong>${deadlineText || 'Urgent'}</strong>) with no volunteer assigned. Direct dispatch is recommended immediately.
              </div>

              <div class="detail-row">
                <span class="detail-label">Task Title</span>
                <span class="detail-value">${taskTitle || 'Help Request'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Department / Category</span>
                <span class="detail-value">${category || 'General'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Deadline / Time Window</span>
                <span class="detail-value" style="color: #dc2626;">${deadlineText || 'Immediate'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Location</span>
                <span class="detail-value">
                  ${location || 'Not provided'}<br/>
                  <a href="${googleMapsUrl}" target="_blank" class="location-link">📍 View on Google Maps &rarr;</a>
                </span>
              </div>

              <div class="actions">
                <a href="${adminUrl}" class="cta-button">Open Admin Console & Dispatch &rarr;</a>
              </div>
            </div>
            <div class="footer">
              LocalEnd Automated SLA Monitor • Sent to verified platform specialists & administrators
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ SLA Alert Email sent successfully:', info.messageId);

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    console.error('❌ Failed to send SLA alert email:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to dispatch email'
    }, { status: 500 });
  }
}
