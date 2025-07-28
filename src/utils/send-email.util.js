    import nodemailer from "nodemailer";
    import "dotenv/config.js";

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT),
      secure: process.env.EMAIL_SECURE === "true", // SSL 465
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

    export async function sendEmail({ to, subject, text, html }) {
      const mailOptions = {
        from: `"NY Barber" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        text,
        html,
      };

      await transporter.sendMail(mailOptions);
      console.log("✅  Correo enviado a:", to);
    }
