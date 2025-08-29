import nodemailer from "nodemailer";
import "dotenv/config.js";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: process.env.EMAIL_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.verify((err) => {
  if (err) {
    console.error("❌  Error SMTP:", err);
  } else {
    console.log("📧  SMTP listo para enviar correos");
  }
});

// Función auxiliar para obtener la URL base correcta
const getBaseUrl = () => {
  // En producción, usa FRONTEND_URL desde las variables de entorno
  if (process.env.NODE_ENV === 'production' || process.env.ENVIRONMENT === 'PROD') {
    return process.env.FRONTEND_URL || 'https://nmbarberapp-seven.vercel.app';
  }
  // En desarrollo, usa localhost
  return process.env.FRONTEND_URL || 'http://localhost:8081';
};

export async function sendEmail({ to, subject, text, html }) {
  const mailOptions = {
    from: `"NY Barber" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
    html,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("✅  Correo enviado a:", to);
    return true;
  } catch (error) {
    console.error("❌  Error enviando correo:", error);
    throw error;
  }
}
