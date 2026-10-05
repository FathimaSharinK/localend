import nodemailer from 'nodemailer';

const user = 'fathimasharin18@gmail.com';
const pass = 'gzen esbk pkdh frez';

console.log('Testing SMTP connection with Gmail for:', user);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user,
    pass,
  },
});

async function main() {
  try {
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully!');

    const info = await transporter.sendMail({
      from: `"LocalEnd Emergency SLA" <${user}>`,
      to: user,
      subject: '🚨 [LocalEnd Test] Emergency SLA Email Notification Setup Successful!',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 2px solid #ef4444; border-radius: 8px;">
          <h2 style="color: #dc2626;">🚨 LocalEnd SLA Notification System is Active</h2>
          <p>This is a verification test to confirm your Gmail alert setup is working.</p>
          <hr style="border: none; border-top: 1px solid #fee2e2; margin: 16px 0;" />
          <p><strong>Configured Email:</strong> ${user}</p>
          <p><strong>SLA Threshold:</strong> 50 Minutes before deadline</p>
          <p><strong>Urgent Tasks:</strong> Immediate automatic alert</p>
          <br />
          <p style="color: #16a34a; font-weight: bold;">✅ You will now receive automatic email alerts whenever an emergency or SLA escalation is triggered on LocalEnd.</p>
        </div>
      `,
    });

    console.log('✅ Test email sent successfully! Message ID:', info.messageId);
  } catch (err) {
    console.error('❌ Failed to send email:', err);
  }
}

main();
