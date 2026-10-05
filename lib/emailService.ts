import nodemailer from 'nodemailer';

export type AlertNature = 
  | 'SLA_BREACH' 
  | 'URGENT_UNASSIGNED' 
  | 'DISPATCH_ASSIGNED' 
  | 'GENERAL_ALERT';

export interface SlaEmailPayload {
  // Alert Nature & Context
  alertNature?: AlertNature;
  alertTitle?: string;
  alertReason?: string;
  alertSeverity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'INFO';

  // Request / Task Details
  taskId?: string;
  taskTitle?: string;
  taskDescription?: string;
  category?: string;
  location?: string;
  coordinates?: { lat: number; lng: number } | null;
  scheduledDate?: string;
  scheduledTime?: string;
  deadlineText?: string;
  priority?: string;
  status?: string;

  // Specific Citizen (Requester) User Information
  requesterId?: string;
  requesterName?: string;
  requesterEmail?: string;
  requesterPhone?: string;
  requesterArea?: string;

  // Assigned Specialist / Employee Info (if dispatched or assigned)
  assignedHelperId?: string;
  assignedHelperName?: string;
  assignedHelperDepartment?: string;
  assignedHelperPhone?: string;
  assignedHelperEmail?: string;
  handshakeCode?: string;

  // Recipient details
  recipientEmails?: string[];
  recipientName?: string;
  recipientRole?: string;
}

/**
 * Shared utility to dispatch rich, detailed SLA and mission alerts via Nodemailer / Gmail SMTP.
 * Contains comprehensive citizen details, task parameters, and explicit alert nature.
 */
export async function sendSlaAlertEmail(payload: SlaEmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const {
      taskId,
      taskTitle,
      taskDescription,
      category,
      location,
      scheduledDate,
      scheduledTime,
      deadlineText,
      priority = 'URGENT',
      status = 'OPEN',
      alertNature = 'SLA_BREACH',
      alertTitle,
      alertReason,
      alertSeverity = 'CRITICAL',
      requesterId,
      requesterName = 'Community Citizen',
      requesterEmail,
      requesterPhone,
      requesterArea,
      assignedHelperName,
      assignedHelperDepartment,
      assignedHelperPhone,
      handshakeCode,
      recipientEmails,
      recipientName,
      recipientRole
    } = payload;

    const user = process.env.SMTP_USER || process.env.EMAIL_USER;
    const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
    const adminEmail = process.env.ADMIN_ALERT_EMAIL || user;

    if (!user || !pass) {
      console.warn('⚠️ [Nodemailer] SMTP_USER or SMTP_PASS is missing in .env.local. Email notification skipped.');
      return {
        success: false,
        error: 'SMTP credentials not configured in .env.local'
      };
    }

    const recipients: string[] = [];
    if (adminEmail && !recipients.includes(adminEmail)) {
      recipients.push(adminEmail);
    }
    if (Array.isArray(recipientEmails)) {
      recipientEmails.forEach((email: string) => {
        if (email && typeof email === 'string' && !recipients.includes(email.trim())) {
          recipients.push(email.trim());
        }
      });
    }

    if (recipients.length === 0) {
      return { success: false, error: 'No recipient email specified.' };
    }

    // Configure Nodemailer transporter (Gmail service default)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass,
      },
    });

    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location || 'Local Area')}`;
    const adminUrl = process.env.NEXT_PUBLIC_APP_URL 
      ? `${process.env.NEXT_PUBLIC_APP_URL}/admin`
      : 'http://localhost:3000/admin';
    const taskUrl = taskId && process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/tasks?reqId=${taskId}`
      : adminUrl;

    // Determine alert styling & narrative by nature
    let headerGradient = 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)';
    let badgeText = '🚨 SLA DEADLINE BREACH';
    let alertHeadline = alertTitle || 'Urgent SLA Escalation Alert';
    let alertExplanation = alertReason || 
      `This alert was triggered because the request is nearing its deadline (${deadlineText || 'Urgent'}) with 0 confirmed specialists or volunteers assigned. Immediate intervention is required to meet the community service level agreement.`;

    if (alertNature === 'DISPATCH_ASSIGNED') {
      headerGradient = 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)';
      badgeText = '👷 DIRECT MISSION DISPATCH';
      alertHeadline = alertTitle || 'Direct Specialist Mission Assignment';
      alertExplanation = alertReason || 
        `An administrator has directly dispatched a specialized technician to this urgent task. Please coordinate with the citizen and verify the 4-digit handshake code upon completion.`;
    } else if (alertNature === 'URGENT_UNASSIGNED') {
      headerGradient = 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)';
      badgeText = '⚡ HIGH PRIORITY ALERT';
      alertHeadline = alertTitle || 'High Priority Unattended Help Request';
      alertExplanation = alertReason || 
        `A citizen has registered a high-priority emergency need requiring immediate department evaluation. No specialists are currently assigned.`;
    }

    // Dynamic Subject Line
    const subjectPrefix = alertNature === 'DISPATCH_ASSIGNED'
      ? `👷 [DISPATCH ASSIGNED]`
      : alertNature === 'URGENT_UNASSIGNED'
      ? `⚡ [URGENT ALERT]`
      : `🚨 [SLA BREACH ALERT]`;

    const subject = `${subjectPrefix} ${category || 'Service'}: "${taskTitle || 'Help Request'}" (Citizen: ${requesterName})`;

    // Formatted Schedule
    const formattedSchedule = scheduledDate
      ? `${scheduledDate}${scheduledTime ? ` at ${scheduledTime}` : ''}`
      : deadlineText || 'Immediate response required';

    // HTML Template
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${alertHeadline}</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
            background-color: #f1f5f9; 
            margin: 0; 
            padding: 24px 12px; 
            color: #0f172a; 
            line-height: 1.5;
          }
          .container { 
            max-width: 620px; 
            margin: 0 auto; 
            background: #ffffff; 
            border-radius: 16px; 
            overflow: hidden; 
            border: 1px solid #e2e8f0; 
            box-shadow: 0 10px 30px -5px rgba(15, 23, 42, 0.08); 
          }
          .header { 
            background: ${headerGradient}; 
            padding: 32px 24px 28px; 
            text-align: center; 
            color: #ffffff; 
          }
          .header h1 { 
            margin: 0 0 8px 0; 
            font-size: 22px; 
            font-weight: 800; 
            letter-spacing: -0.02em; 
            color: #ffffff;
          }
          .header p { 
            margin: 0; 
            font-size: 14px; 
            opacity: 0.95; 
            color: #f8fafc;
          }
          .badge { 
            display: inline-block; 
            background: rgba(255,255,255,0.22); 
            padding: 5px 14px; 
            border-radius: 9999px; 
            font-size: 11px; 
            font-weight: 800; 
            letter-spacing: 0.06em;
            margin-top: 14px; 
            text-transform: uppercase; 
            color: #ffffff;
            border: 1px solid rgba(255,255,255,0.3);
          }
          .content { 
            padding: 24px 24px 28px; 
          }
          
          /* Nature of Alert Callout */
          .alert-nature-box { 
            background: #fef2f2; 
            border-left: 4px solid #ef4444; 
            border-radius: 8px; 
            padding: 16px; 
            margin-bottom: 24px; 
            font-size: 13px; 
            color: #991b1b; 
          }
          .alert-nature-box.blue {
            background: #eff6ff; 
            border-left-color: #3b82f6; 
            color: #1e40af;
          }
          .alert-nature-box.amber {
            background: #fffbeb; 
            border-left-color: #f59e0b; 
            color: #92400e;
          }
          .alert-nature-title {
            font-weight: 700;
            font-size: 13px;
            margin-bottom: 4px;
            display: flex;
            align-items: center;
            gap: 6px;
          }

          /* Card Sections */
          .section-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 16px 18px;
            margin-bottom: 18px;
          }
          .section-heading {
            font-size: 12px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #475569;
            margin-top: 0;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 8px;
          }
          .detail-grid {
            display: table;
            width: 100%;
          }
          .detail-row { 
            display: table-row; 
          }
          .detail-label { 
            display: table-cell;
            padding: 7px 12px 7px 0;
            color: #64748b; 
            font-weight: 600; 
            font-size: 13px;
            width: 38%;
            vertical-align: top;
          }
          .detail-value { 
            display: table-cell;
            padding: 7px 0;
            color: #0f172a; 
            font-weight: 600; 
            font-size: 13px;
            vertical-align: top;
          }
          .description-box {
            background: #ffffff;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 12px 14px;
            font-size: 13px;
            color: #334155;
            font-style: italic;
            margin-top: 8px;
            line-height: 1.5;
          }
          .tag-pill {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 700;
          }
          .tag-urgent { background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; }
          .tag-high { background: #ffedd5; color: #c2410c; border: 1px solid #fdba74; }
          .tag-normal { background: #e0f2fe; color: #0284c7; border: 1px solid #7dd3fc; }
          
          .code-box {
            background: #ecfdf5;
            border: 2px dashed #059669;
            border-radius: 10px;
            padding: 12px 16px;
            text-align: center;
            margin: 12px 0 6px 0;
          }
          .code-digits {
            font-family: ui-monospace, Menlo, Monaco, Consolas, monospace;
            font-size: 26px;
            font-weight: 800;
            color: #065f46;
            letter-spacing: 0.25em;
          }

          .link-primary { color: #2563eb; text-decoration: none; font-weight: 600; }
          .link-primary:hover { text-decoration: underline; }
          
          .actions { 
            margin-top: 24px; 
            text-align: center; 
          }
          .cta-button { 
            display: inline-block; 
            background: #2563eb; 
            color: #ffffff !important; 
            font-weight: 700; 
            font-size: 14px; 
            padding: 12px 26px; 
            border-radius: 10px; 
            text-decoration: none; 
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25); 
            margin: 4px;
          }
          .cta-button-danger {
            background: #dc2626;
            box-shadow: 0 4px 12px rgba(220, 38, 38, 0.25);
          }
          .cta-secondary {
            display: inline-block;
            background: #f1f5f9;
            color: #334155 !important;
            font-weight: 600;
            font-size: 13px;
            padding: 10px 18px;
            border-radius: 8px;
            text-decoration: none;
            border: 1px solid #cbd5e1;
            margin: 4px;
          }
          .footer { 
            background: #f8fafc; 
            padding: 20px 24px; 
            text-align: center; 
            font-size: 11px; 
            color: #64748b; 
            border-top: 1px solid #e2e8f0; 
          }
        </style>
      </head>
      <body>
        <div class="container">
          <!-- Main Alert Banner Header -->
          <div class="header">
            <h1>${alertHeadline}</h1>
            <p>Direct notification sent from LocalEnd Emergency Response Network</p>
            <span class="badge">${badgeText}</span>
          </div>

          <div class="content">
            <!-- Alert Nature & Trigger Explanation Box -->
            <div class="alert-nature-box ${alertNature === 'DISPATCH_ASSIGNED' ? 'blue' : alertNature === 'URGENT_UNASSIGNED' ? 'amber' : ''}">
              <div class="alert-nature-title">
                ${alertNature === 'DISPATCH_ASSIGNED' ? 'ℹ️ Alert Nature: Specialist Assignment' : '⚠️ Alert Nature: Immediate Intervention Triggered'}
              </div>
              <div>${alertExplanation}</div>
              ${deadlineText ? `<div style="margin-top: 8px; font-weight: 700;">⏱️ Execution Window: <span style="text-decoration: underline;">${deadlineText}</span></div>` : ''}
            </div>

            <!-- Specific Citizen (Requester) Information -->
            <div class="section-card">
              <div class="section-heading">
                <span>👤 Citizen (Requester) Profile</span>
                <span style="font-size: 10px; color: #059669; font-weight: 700;">VERIFIED CITIZEN</span>
              </div>
              <div class="detail-grid">
                <div class="detail-row">
                  <span class="detail-label">Full Name:</span>
                  <span class="detail-value">${requesterName}</span>
                </div>
                ${requesterPhone ? `
                <div class="detail-row">
                  <span class="detail-label">Phone Contact:</span>
                  <span class="detail-value">
                    <a href="tel:${requesterPhone.replace(/\\D/g, '')}" class="link-primary" style="font-family: monospace; font-size: 14px;">
                      📞 ${requesterPhone}
                    </a>
                  </span>
                </div>` : ''}
                ${requesterEmail ? `
                <div class="detail-row">
                  <span class="detail-label">Email Address:</span>
                  <span class="detail-value">
                    <a href="mailto:${requesterEmail}" class="link-primary">✉️ ${requesterEmail}</a>
                  </span>
                </div>` : ''}
                ${requesterArea ? `
                <div class="detail-row">
                  <span class="detail-label">Home Neighborhood:</span>
                  <span class="detail-value">📍 ${requesterArea}</span>
                </div>` : ''}
                ${requesterId ? `
                <div class="detail-row">
                  <span class="detail-label">Member UID:</span>
                  <span class="detail-value" style="font-family: monospace; font-size: 11px; color: #64748b;">${requesterId}</span>
                </div>` : ''}
              </div>
            </div>

            <!-- Specific Task & Incident Details -->
            <div class="section-card">
              <div class="section-heading">
                <span>📋 Task & Incident Parameters</span>
                <span>
                  <span class="tag-pill ${priority === 'URGENT' ? 'tag-urgent' : priority === 'HIGH' ? 'tag-high' : 'tag-normal'}">
                    ${priority} PRIORITY
                  </span>
                </span>
              </div>
              <div class="detail-grid">
                <div class="detail-row">
                  <span class="detail-label">Task Title:</span>
                  <span class="detail-value">${taskTitle || 'Help Request'}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Department / Field:</span>
                  <span class="detail-value">🛠️ ${category || 'General Support'}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Target Schedule:</span>
                  <span class="detail-value">📅 ${formattedSchedule}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Current Status:</span>
                  <span class="detail-value" style="text-transform: uppercase; font-weight: 700;">${status}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Service Location:</span>
                  <span class="detail-value">
                    📍 ${location || 'Neighborhood Location'}<br/>
                    <a href="${googleMapsUrl}" target="_blank" class="link-primary" style="font-size: 12px;">
                      View Pin on Google Maps &rarr;
                    </a>
                  </span>
                </div>
              </div>

              ${taskDescription ? `
              <div style="margin-top: 10px;">
                <span class="detail-label" style="display: block; margin-bottom: 2px;">Incident Description:</span>
                <div class="description-box">
                  "${taskDescription}"
                </div>
              </div>` : ''}
            </div>

            <!-- Handshake / Assigned Specialist (if available) -->
            ${assignedHelperName || handshakeCode ? `
            <div class="section-card" style="background: #f0fdf4; border-color: #bbf7d0;">
              <div class="section-heading" style="color: #166534; border-bottom-color: #dcfce7;">
                <span>🤝 Assigned Specialist & Verification</span>
                <span style="font-size: 10px; color: #15803d; font-weight: 700;">ACTIVE MISSION</span>
              </div>
              <div class="detail-grid">
                ${assignedHelperName ? `
                <div class="detail-row">
                  <span class="detail-label">Assigned Technician:</span>
                  <span class="detail-value">${assignedHelperName} (${assignedHelperDepartment || category || 'Specialist'})</span>
                </div>` : ''}
                ${assignedHelperPhone ? `
                <div class="detail-row">
                  <span class="detail-label">Technician Phone:</span>
                  <span class="detail-value">
                    <a href="tel:${assignedHelperPhone.replace(/\\D/g, '')}" class="link-primary" style="font-family: monospace;">
                      ${assignedHelperPhone}
                    </a>
                  </span>
                </div>` : ''}
              </div>

              ${handshakeCode ? `
              <div class="code-box">
                <div style="font-size: 11px; font-weight: 700; color: #047857; text-transform: uppercase; margin-bottom: 4px;">
                  🔒 4-Digit Handshake Completion Code
                </div>
                <div class="code-digits">${handshakeCode}</div>
                <div style="font-size: 11px; color: #065f46; margin-top: 4px;">
                  Share this code with the technician upon mission completion to verify closure.
                </div>
              </div>` : ''}
            </div>` : ''}

            <!-- Recommended Actions -->
            <div class="actions">
              <a href="${adminUrl}" class="cta-button ${alertNature === 'SLA_BREACH' ? 'cta-button-danger' : ''}">
                Open Admin Console &rarr;
              </a>
              ${requesterPhone ? `
              <a href="tel:${requesterPhone.replace(/\\D/g, '')}" class="cta-secondary">
                📞 Call Requester
              </a>` : ''}
              <a href="${googleMapsUrl}" target="_blank" class="cta-secondary">
                📍 Open Map
              </a>
            </div>
          </div>

          <!-- Email Footer -->
          <div class="footer">
            <p style="margin: 0 0 6px 0; font-weight: 600; color: #475569;">
              LocalEnd Automated Alert System • Hyperlocal Direct Community Mesh
            </p>
            <p style="margin: 0;">
              This notification was generated automatically based on platform SLA and request priority rules. Sent to verified emergency responders & administrators.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Plain text alternative
    const text = `
=====================================================
${alertHeadline.toUpperCase()}
=====================================================
Nature of Alert: ${badgeText}
${alertExplanation}
Time Window: ${deadlineText || 'Immediate'}

-----------------------------------------------------
1. CITIZEN (REQUESTER) DETAILS
-----------------------------------------------------
Full Name: ${requesterName}
Phone: ${requesterPhone || 'Not provided'}
Email: ${requesterEmail || 'Not provided'}
Neighborhood Area: ${requesterArea || location || 'Not provided'}
Member ID: ${requesterId || 'N/A'}

-----------------------------------------------------
2. TASK & INCIDENT PARAMETERS
-----------------------------------------------------
Task Title: ${taskTitle || 'Help Request'}
Department / Category: ${category || 'General'}
Priority: ${priority}
Target Schedule: ${formattedSchedule}
Current Status: ${status}
Location: ${location || 'Not provided'}
Google Maps: ${googleMapsUrl}
Description:
"${taskDescription || 'No description provided.'}"

${handshakeCode ? `
-----------------------------------------------------
3. HANDSHAKE COMPLETION CODE: ${handshakeCode}
-----------------------------------------------------
Assigned Specialist: ${assignedHelperName || 'Technician'} (${assignedHelperDepartment || 'Specialist'})
` : ''}

-----------------------------------------------------
ACTIONS & MANAGEMENT
-----------------------------------------------------
Admin Console: ${adminUrl}
Map Directions: ${googleMapsUrl}

LocalEnd Automated SLA Monitor
    `.trim();

    const mailOptions = {
      from: `"LocalEnd Emergency SLA" <${user}>`,
      to: recipients.join(', '),
      subject,
      text,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ [Nodemailer] Alert email sent successfully. Message ID: ${info.messageId} | Nature: ${alertNature}`);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('❌ Failed to send SLA alert email:', error);
    return {
      success: false,
      error: error.message || 'Failed to dispatch email'
    };
  }
}
