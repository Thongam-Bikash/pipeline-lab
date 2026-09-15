import { createTransport, type Transporter } from 'nodemailer'

let transport: Transporter | undefined

// Mailpit locally, a real provider on a server: only SMTP_URL changes.
// Async, so a bad setting rejects for the caller to log instead of throwing mid-request.
export async function sendMail(to: string, subject: string, text: string) {
  transport ??= createTransport(process.env.SMTP_URL)
  return transport.sendMail({ from: process.env.MAIL_FROM, to, subject, text })
}
