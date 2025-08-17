import { response, request } from "express";
import { Usuario } from "../usuarios/usuarios.model.js";
import { Notificacion } from "./notifications.model.js";
import fetch from "node-fetch";
import { Cita } from "../citas/citas.model.js";
import { Servicio } from "../servicios/servicios.model.js";
import { Barbero } from "../barberos/barberos.model.js";
import { Cliente } from "../clientes/clientes.model.js";

class NotificationsController {
  async saveToken(req = request, res = response) {
    try {
      const { userId, token } = req.body;
      if (!userId || !token) {
        return res
          .status(400)
          .json({ success: false, message: "Faltan datos requeridos" });
      }

      const usuario = await Usuario.findByPk(userId);
      if (!usuario) {
        return res
          .status(404)
          .json({ success: false, message: "Usuario no encontrado" });
      }

      usuario.expo_push_token = token;
      await usuario.save();

      return res.json({
        success: true,
        message: "Token guardado correctamente",
        data: { userId, token },
      });
    } catch (error) {
      console.error("Error guardando token:", error);
      return res.status(500).json({
        success: false,
        message: "Error en el servidor",
        error: process.env.NODE_ENV === "development" ? error.message : null,
      });
    }
  }

  // Mejora el método createAppointmentNotification
  async createAppointmentNotification(citaId, tipo, options = {}) {
    try {
      const cita = await Cita.findByPk(citaId, {
        include: [
          { model: Servicio, as: "servicio" },
          {
            model: Barbero,
            as: "barbero",
            include: [{ model: Usuario, as: "usuario" }],
          },
          { model: Cliente, as: "cliente" },
        ],
        transaction: options.transaction,
      });

      if (!cita?.barbero?.usuario) {
        console.error(
          "No se pudo obtener información necesaria para la notificación"
        );
        return null;
      }

      const usuarioId = cita.barbero.usuario.id;
      const fechaFormateada = new Date(cita.fecha).toLocaleDateString("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      const horaFormateada = cita.hora.substring(0, 5);

      let titulo, cuerpo;

      if (tipo === "creacion") {
        titulo = "📅 Nueva cita agendada";
        cuerpo = `El cliente ${
          cita.cliente?.nombre || cita.pacienteTemporalNombre || "un cliente"
        } ha agendado una cita para el ${fechaFormateada} a las ${horaFormateada}`;
      } else if (tipo === "cancelacion") {
        titulo = "❌ Cita cancelada";
        cuerpo = `La cita del ${fechaFormateada} a las ${horaFormateada} ha sido cancelada`;
      } else {
        return null;
      }

      const notificacion = await Notificacion.create(
        {
          usuarioID: usuarioId,
          titulo,
          cuerpo,
          tipo: "cita",
          relacionId: cita.id,
          leido: false,
        },
        options
      );

      // Obtener usuario con token push
      const usuario = await Usuario.findByPk(usuarioId);

      if (usuario?.expo_push_token) {
        await this.sendPushNotification({
          userId: usuario.id,
          titulo,
          cuerpo,
          data: {
            type: "cita",
            citaId: cita.id,
            notificacionId: notificacion.id,
            screen: "DetalleCita",
          },
        });
      }

      return notificacion;
    } catch (error) {
      console.error("Error en createAppointmentNotification:", error);
      throw error;
    }
  }
  async sendPushNotification({ userId, titulo, cuerpo, data = {} }) {
    try {
      const usuario = await Usuario.findByPk(userId);
      if (!usuario?.expo_push_token) {
        console.log(`Usuario ${userId} no tiene token push registrado`);
        return { success: false, message: "Usuario sin token registrado" };
      }

      const message = {
        to: usuario.expo_push_token,
        sound: "default",
        title: titulo,
        body: cuerpo,
        data: { ...data },
        channelId: "default",
      };

      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      });

      const result = await response.json();

      if (result.data?.status === "error") {
        console.error("Error en Expo API:", result.data.message);
        return { success: false, error: result.data.message };
      }

      return { success: true, data: result };
    } catch (error) {
      console.error("Error enviando notificación push:", error);
      return { success: false, error: error.message };
    }
  }

  // Añade este método al controlador para obtener notificaciones con paginación
  async getUserNotifications(req = request, res = response) {
    try {
      const { userId } = req.user;
      const { limit = 20, offset = 0 } = req.query;

      const { count, rows: notificaciones } =
        await Notificacion.findAndCountAll({
          where: { usuarioID: userId },
          order: [["createdAt", "DESC"]],
          limit: parseInt(limit),
          offset: parseInt(offset),
          include: [
            {
              model: Usuario,
              as: "usuario",
              attributes: ["id", "nombre", "email"],
            },
          ],
        });

      const unreadCount = await Notificacion.count({
        where: {
          usuarioID: userId,
          leido: false,
        },
      });

      return res.json({
        success: true,
        data: {
          notificaciones,
          total: count,
          unreadCount,
        },
      });
    } catch (error) {
      console.error("Error obteniendo notificaciones:", error);
      return res.status(500).json({
        success: false,
        message: "Error en el servidor",
        error: process.env.NODE_ENV === "development" ? error.message : null,
      });
    }
  }

  async markAllAsRead(req = request, res = response) {
    try {
      const { userId } = req.user;

      const [updatedCount] = await Notificacion.update(
        { leido: true },
        {
          where: {
            usuarioID: userId,
            leido: false,
          },
        }
      );

      return res.json({
        success: true,
        message: `Se marcaron ${updatedCount} notificaciones como leídas`,
      });
    } catch (error) {
      console.error("Error marcando notificaciones como leídas:", error);
      return res.status(500).json({
        success: false,
        message: "Error en el servidor",
      });
    }
  }

  async getUnreadCount(req = request, res = response) {
    try {
      const { userId } = req.user;

      const count = await Notificacion.count({
        where: {
          usuarioID: userId,
          leido: false,
        },
      });

      return res.json({
        success: true,
        count,
      });
    } catch (error) {
      console.error("Error obteniendo conteo de notificaciones:", error);
      return res.status(500).json({
        success: false,
        message: "Error en el servidor",
      });
    }
  }
}

export default new NotificationsController();
