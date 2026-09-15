import { createTransport, type Transporter } from 'nodemailer'

let transport: Transporter | undefined

// Mailpit locally, a real provider on a server: only SMTP_URL changes.
// Created on first send, so importing this module needs no SMTP settings.
export const sendMail = (to: string, subject: string, text: string) => {
  transport ??= createTransport(process.env.SMTP_URL)
  return transport.sendMail({ from: process.env.MAIL_FROM, to, subject, text })
}
