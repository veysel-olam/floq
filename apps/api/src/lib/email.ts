import nodemailer from 'nodemailer'
import { env } from './env.js'

interface MailOptions {
  to: string
  subject: string
  html: string
}

function createTransport() {
  if (!env.SMTP_HOST) return null
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  })
}

export async function sendEmail({ to, subject, html }: MailOptions): Promise<void> {
  if (!env.SMTP_HOST) {
    // Development: log to console instead of sending
    console.log('\n📧 EMAIL (dev — configure SMTP_HOST to send real emails)')
    console.log(`   To: ${to}`)
    console.log(`   Subject: ${subject}`)
    const urlMatch = /href="([^"]+)"/g.exec(html)
    if (urlMatch) console.log(`   Link: ${urlMatch[1]}`)
    console.log()
    return
  }

  const transport = createTransport()!
  await transport.sendMail({
    from: env.SMTP_FROM,
    to,
    subject,
    html,
  })
}

function baseHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#FAFAF8;font-family:'DM Sans',sans-serif;">
<div style="max-width:480px;margin:40px auto;background:#fff;border-radius:16px;border:1px solid #D8D7D2;overflow:hidden;">
  <div style="background:linear-gradient(135deg,#E8593C,#F2845C);padding:32px 32px 24px;text-align:center;">
    <h1 style="margin:0;color:#fff;font-size:28px;font-weight:800;letter-spacing:-0.5px;">floq</h1>
    <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Kendi ağın, kendi kuralların.</p>
  </div>
  <div style="padding:32px;">
    ${body}
  </div>
  <div style="padding:16px 32px 24px;text-align:center;border-top:1px solid #E8E7E3;">
    <p style="margin:0;font-size:11px;color:#9C9A92;">Bu e-postayı siz talep etmediyseniz güvenle görmezden gelebilirsiniz.</p>
  </div>
</div>
</body>
</html>`
}

export function passwordResetEmail(url: string): string {
  return baseHtml('Şifre Sıfırlama — Floq', `
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#1A1A18;">Şifreni sıfırla</h2>
    <p style="margin:0 0 24px;color:#3D3D3A;font-size:14px;line-height:1.6;">
      Floq hesabın için şifre sıfırlama isteği aldık. Aşağıdaki butona tıklayarak yeni şifreni belirleyebilirsin.
    </p>
    <a href="${url}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#E8593C,#F2845C);color:#fff;text-decoration:none;border-radius:99px;font-weight:700;font-size:14px;">
      Şifremi Sıfırla
    </a>
    <p style="margin:20px 0 0;font-size:12px;color:#9C9A92;">Bu bağlantı 1 saat içinde geçerliliğini yitirecek.</p>
  `)
}

export function emailVerificationEmail(url: string): string {
  return baseHtml('E-posta Doğrulama — Floq', `
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#1A1A18;">E-postanı doğrula</h2>
    <p style="margin:0 0 24px;color:#3D3D3A;font-size:14px;line-height:1.6;">
      Floq'a hoş geldin! Hesabını aktif etmek için e-posta adresini doğrula.
    </p>
    <a href="${url}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#E8593C,#F2845C);color:#fff;text-decoration:none;border-radius:99px;font-weight:700;font-size:14px;">
      E-postamı Doğrula
    </a>
    <p style="margin:20px 0 0;font-size:12px;color:#9C9A92;">Bu bağlantı 24 saat içinde geçerliliğini yitirecek.</p>
  `)
}
