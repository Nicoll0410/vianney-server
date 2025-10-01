import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

/**
 * FRONTEND_URL debe apuntar a la raíz pública de tu app
 *   ‑ en dev:  http://localhost:8081
 *   ‑ en prod: https://tu‑frontend.com
 * El enlace de verificación usa /verify‑email?email=…&code=…
 */
class Correos {
  /* ╔════════════════════════════════════════════╗
     ║ 1. Confirmación de identidad (registro app) ║
     ╚════════════════════════════════════════════╝ */
// Modificar la plantilla de confirmarIdentidad y envioCredenciales
confirmarIdentidad({ codigo, email, verificationLink }) {
  return `
<div style="font-family:Nunito,Arial,sans-serif;background:#f4f4f4;padding:40px 0;">
  <table align="center" cellpadding="0" cellspacing="0" style="max-width:500px;background:#ffffff;padding:32px 24px;border-radius:8px;">
    <tr>
      <td style="text-align:center;padding:20px;">
        <img src="https://i.postimg.cc/x1S3rTr1/vianney.png" alt="Logo" width="200">
      </td>
    </tr>
    <tr>
      <td style="padding:20px;">
        <h2 style="font-size:24px;margin:0 0 10px;">Confirmación de Identidad</h2>
        <p style="margin:10px 0;">Hola,</p>
        <p style="margin:10px 0;">Para verificar tu cuenta, utiliza el siguiente código en la aplicación:</p>
        <div style="text-align:center;margin:20px 0;font-size:24px;font-weight:bold;color:#333;">${codigo}</div>
        <p style="text-align:center;margin:20px 0;">
          <a href="${verificationLink}" 
             style="text-decoration:none;padding:12px 24px;font-size:16px;border-radius:8px;background:#000;color:#fff;display:inline-block;">
            Verificar cuenta
          </a>
        </p>
        <p style="margin:10px 0;">Gracias,<br>El equipo de Vianney The Barber</p>
      </td>
    </tr>
  </table>
</div>`;
}



  /* ╔══════════════════════════════════════════╗
     ║ 2. Recuperación de contraseña (no cambia) ║
     ╚══════════════════════════════════════════╝ */
  recuperarPassword({ codigo, email }) {
    const url = `${process.env.FRONTEND_URL}/auth/verify-recover-password?email=${encodeURIComponent(
      email
    )}&codigo=${codigo}`;

    return `
    <div style="font-family:Nunito,Arial,sans-serif;background:#f4f4f4;padding:40px 0;">
      <table align="center" cellpadding="0" cellspacing="0" style="max-width:500px;background:#ffffff;padding:32px 24px;border-radius:8px;">
        <tr>
          <td style="text-align:center;padding:20px;">
            <img src="https://i.postimg.cc/x1S3rTr1/vianney.png" alt="Logo" width="200">
          </td>
        </tr>
        <tr>
          <td style="padding:20px;">
            <h2 style="font-size:24px;margin:0 0 10px;">Recuperación de contraseña</h2>
            <p style="margin:10px 0;">Hola,</p>
            <p style="margin:10px 0;">Utiliza este código en la app para restablecer tu contraseña:</p>
            <div style="text-align:center;margin:20px 0;font-size:24px;font-weight:bold;color:#333;">${codigo}</div>
            <p style="margin:10px 0;">Si no solicitaste esto, ignora el correo.</p>
            <p style="margin:10px 0;">Gracias,<br>El equipo de Vianney The Barber</p>
          </td>
        </tr>
      </table>
    </div>`;
  }

  /* ╔══════════════════════════════════════════════════╗
     ║ 3. Envío de credenciales (cliente creado por admin) ║
     ╚══════════════════════════════════════════════════╝ */
envioCredenciales({ codigo, email, password, verificationLink }) {
  return `
<div style="font-family:Nunito,Arial,sans-serif;background:#f4f4f4;padding:40px 0;">
  <table align="center" cellpadding="0" cellspacing="0" style="max-width:500px;background:#ffffff;padding:32px 24px;border-radius:8px;">
    <tr>
      <td style="text-align:center;padding:20px;">
        <img src="https://i.postimg.cc/x1S3rTr1/vianney.png" alt="Logo" width="200">
      </td>
    </tr>
    <tr>
      <td style="padding:20px;">
        <h2 style="font-size:24px;margin:0 0 10px;">¡Bienvenido a NY Barber!</h2>
        <p style="margin:10px 0;">Un administrador ha creado una cuenta para ti. Por favor verifica tu correo electrónico:</p>
        <div style="text-align:center;margin:20px 0;font-size:24px;font-weight:bold;color:#333;">${codigo}</div>
        <p style="text-align:center;margin:20px 0;">
          <a href="${verificationLink}" 
             style="text-decoration:none;padding:12px 24px;font-size:16px;border-radius:8px;background:#000;color:#fff;display:inline-block;">
            Verificar cuenta
          </a>
        </p>
        <p style="margin:10px 0;font-size:14px;color:#666;">
          Credenciales temporales:<br>
          <strong>Email:</strong> ${email}<br>
          <strong>Contraseña:</strong> ${password}
        </p>
        <p style="margin:10px 0;">Gracias,<br>El equipo de Vianney The Barber</p>
      </td>
    </tr>
  </table>
</div>`;
}

  /* ╔══════════════════════════════════════════════╗
     ║ 4. Notificación de cita cancelada (sin cambio) ║
     ╚══════════════════════════════════════════════╝ */
  citaCancelada({ fecha, hora, razon }) {
    const fechaFormateada = format(parseISO(fecha), "d 'de' MMMM 'de' yyyy", { locale: es });
    const horaFormateada = format(parseISO(`1970-01-01T${hora}`), "hh:mm a", { locale: es });

    return `
    <div style="font-family:Nunito,Arial,sans-serif;background:#f4f4f4;padding:40px 0;">
      <table align="center" cellpadding="0" cellspacing="0" style="max-width:500px;background:#ffffff;padding:32px 24px;border-radius:8px;">
        <tr>
          <td style="text-align:center;padding:20px;">
            <img src="https://i.postimg.cc/x1S3rTr1/vianney.png" alt="Logo" width="200">
          </td>
        </tr>
        <tr>
          <td style="padding:20px;">
            <h2 style="font-size:24px;margin:0 0 10px;">Cita cancelada</h2>
            <p style="margin:10px 0;">Tu cita del ${fechaFormateada} a las ${horaFormateada} ha sido cancelada.</p>
            <p style="margin:10px 0;">Razón: ${razon}</p>
            <p style="margin:10px 0;">Si tienes dudas, contáctanos.</p>
            <p style="margin:10px 0;">Gracias,<br>El equipo de Vianney The Barber</p>
          </td>
        </tr>
      </table>
    </div>`;
  }
    /* ╔══════════════════════════════════════════════╗
     ║ 5. NOTIFICACIONES DE CITAS PARA BARBEROS      ║
     ╚══════════════════════════════════════════════╝ */
  notificacionCitaBarbero({ tipo, cliente_nombre, fecha_hora, servicio_nombre, motivo_cancelacion }) {
    const fechaFormateada = format(fecha_hora, "d 'de' MMMM 'de' yyyy", { locale: es });
    const horaFormateada = format(fecha_hora, "hh:mm a", { locale: es });
    
    if (tipo === 'creacion') {
      return `
      <div style="font-family:Nunito,Arial,sans-serif;background:#f4f4f4;padding:40px 0;">
        <table align="center" cellpadding="0" cellspacing="0" style="max-width:500px;background:#ffffff;padding:32px 24px;border-radius:8px;">
          <tr>
            <td style="text-align:center;padding:20px;">
              <img src="https://i.postimg.cc/x1S3rTr1/vianney.png" alt="Logo" width="200">
            </td>
          </tr>
          <tr>
            <td style="padding:20px;">
              <h2 style="font-size:24px;margin:0 0 10px;">Nueva cita programada</h2>
              <p style="margin:10px 0;">Se ha agendado una nueva cita con los siguientes detalles:</p>
              <ul style="margin:10px 0;padding-left:20px;">
                <li><strong>Cliente:</strong> ${cliente_nombre}</li>
                <li><strong>Fecha:</strong> ${fechaFormateada}</li>
                <li><strong>Hora:</strong> ${horaFormateada}</li>
                <li><strong>Servicio:</strong> ${servicio_nombre}</li>
              </ul>
              <p style="margin:10px 0;">Por favor, revisa tu agenda para confirmar disponibilidad.</p>
              <p style="margin:10px 0;">Gracias,<br>El equipo de Vianney The Barber</p>
            </td>
          </tr>
        </table>
      </div>`;
    } else if (tipo === 'cancelacion') {
      return `
      <div style="font-family:Nunito,Arial,sans-serif;background:#f4f4f4;padding:40px 0;">
        <table align="center" cellpadding="0" cellspacing="0" style="max-width:500px;background:#ffffff;padding:32px 24px;border-radius:8px;">
          <tr>
            <td style="text-align:center;padding:20px;">
              <img src="https://i.postimg.cc/x1S3rTr1/vianney.png" alt="Logo" width="200">
            </td>
          </tr>
          <tr>
            <td style="padding:20px;">
              <h2 style="font-size:24px;margin:0 0 10px;">Cita cancelada</h2>
              <p style="margin:10px 0;">Se ha cancelado una cita con los siguientes detalles:</p>
              <ul style="margin:10px 0;padding-left:20px;">
                <li><strong>Cliente:</strong> ${cliente_nombre}</li>
                <li><strong>Fecha:</strong> ${fechaFormateada}</li>
                <li><strong>Hora:</strong> ${horaFormateada}</li>
                <li><strong>Servicio:</strong> ${servicio_nombre}</li>
                <li><strong>Motivo:</strong> ${motivo_cancelacion || 'No especificado'}</li>
              </ul>
              <p style="margin:10px 0;">Gracias,<br>El equipo de Vianney The Barber</p>
            </td>
          </tr>
        </table>
      </div>`;
    }
  }
}

export const correos = new Correos();
