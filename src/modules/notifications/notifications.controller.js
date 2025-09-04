import { response, request } from "express";
import { Usuario } from "../usuarios/usuarios.model.js";
import { Notificacion } from "./notifications.model.js";
import fetch from "node-fetch";
import { Cita } from "../citas/citas.model.js";
import { Servicio } from "../servicios/servicios.model.js";
import { Barbero } from "../barberos/barberos.model.js";
import { Cliente } from "../clientes/clientes.model.js";
import { UsuarioToken } from "./usuarios_tokens.model.js";
import { Rol } from "../roles/roles.model.js";

class NotificationsController {
  async saveToken(req = request, res = response) {
    try {
      const userId = req.user.id;
      const { token, dispositivo, sistemaOperativo } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: "El token es requerido",
        });
      }

      const usuario = await Usuario.findByPk(userId);
      if (!usuario) {
        return res.status(404).json({
          success: false,
          message: "Usuario no encontrado",
        });
      }

      const [usuarioToken, created] = await UsuarioToken.findOrCreate({
        where: { usuarioID: userId, token },
        defaults: { dispositivo, sistemaOperativo },
      });

      if (!created) {
        await usuarioToken.update({ dispositivo, sistemaOperativo });
      }

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

  async createNotification(req = request, res = response) {
    try {
      const { usuarioID, titulo, cuerpo, tipo, relacionId } = req.body;

      const usuario = await Usuario.findByPk(usuarioID);
      if (!usuario) {
        return res.status(404).json({
          success: false,
          message: "Usuario no encontrado",
        });
      }

      const notificacion = await Notificacion.create({
        usuarioID,
        titulo,
        cuerpo,
        tipo: tipo || "sistema",
        relacionId: relacionId || null,
        leido: false,
      });

      const io = req.app.get("io");
      io.emit("newNotification", {
        usuarioID,
        titulo,
        cuerpo,
        notificacion,
      });

      return res.status(201).json({
        success: true,
        message: "Notificación creada exitosamente",
        data: notificacion,
      });
    } catch (error) {
      console.error("Error creando notificación:", error);
      return res.status(500).json({
        success: false,
        message: "Error al crear notificación",
        error: process.env.NODE_ENV === "development" ? error.message : null,
      });
    }
  }

  async enviarNotificacionCitaTiempoReal(
    citaId,
    usuarioCreadorId,
    options = {}
  ) {
    try {
      const io = require("../../server").io;

      const cita = await Cita.findByPk(citaId, {
        include: [
          { model: Servicio, as: "servicio" },
          {
            model: Barbero,
            as: "barbero",
            include: [{ model: Usuario, as: "usuario" }],
          },
          {
            model: Cliente,
            as: "cliente",
            include: [{ model: Usuario, as: "usuario" }],
          },
        ],
        transaction: options.transaction,
      });

      if (!cita) {
        console.error("❌ Cita no encontrada para notificación");
        return;
      }

      const usuarioCreador = await Usuario.findByPk(usuarioCreadorId, {
        include: [{ model: Rol, as: "rol" }],
        transaction: options.transaction,
      });

      let destinatarios = [];
      const rolCreador = usuarioCreador.rol?.nombre;

      if (rolCreador === "administrador") {
        if (cita.barbero?.usuario?.id)
          destinatarios.push(cita.barbero.usuario.id);
        if (cita.cliente?.usuario?.id)
          destinatarios.push(cita.cliente.usuario.id);
      } else if (rolCreador === "barbero") {
        const administradores = await Usuario.findAll({
          include: [
            {
              model: Rol,
              as: "rol",
              where: { nombre: "administrador" },
            },
          ],
          transaction: options.transaction,
        });
        destinatarios = administradores.map((admin) => admin.id);
        if (cita.cliente?.usuario?.id)
          destinatarios.push(cita.cliente.usuario.id);
      } else if (rolCreador === "cliente") {
        if (cita.barbero?.usuario?.id)
          destinatarios.push(cita.barbero.usuario.id);
        const administradores = await Usuario.findAll({
          include: [
            {
              model: Rol,
              as: "rol",
              where: { nombre: "administrador" },
            },
          ],
          transaction: options.transaction,
        });
        destinatarios = [
          ...destinatarios,
          ...administradores.map((admin) => admin.id),
        ];
      }

      // Eliminar duplicados y al creador
      destinatarios = [...new Set(destinatarios)].filter(
        (id) => id !== usuarioCreadorId
      );

      const fechaFormateada = new Date(cita.fecha).toLocaleDateString("es-ES");
      const mensaje = `Nueva cita: ${cita.servicio?.nombre} - ${fechaFormateada} ${cita.hora}`;

      for (const destinatarioId of destinatarios) {
        const notificacion = await Notificacion.create(
          {
            usuarioID: destinatarioId,
            titulo: "📅 Nueva Cita",
            cuerpo: mensaje,
            tipo: "cita_creada",
            relacionId: cita.id,
            leido: false,
          },
          { transaction: options.transaction }
        );

        // Emitir por socket
io.to(`usuario_${destinatarioId}`).emit("nueva_notificacion", {
  id: notificacion.id,
  usuarioID: destinatarioId, // ← Usar la variable correcta
  titulo: "📅 Nueva Cita",
  cuerpo: mensaje,
  tipo: "cita_creada",
  relacionId: cita.id,
  leido: false,
  createdAt: notificacion.createdAt,
  updatedAt: notificacion.updatedAt,
  sound: true,
  cita: cita
});

        // 🎯 ENVIAR EVENTO ESPECIAL PARA ACTUALIZAR BADGE
        io.to(`usuario_${destinatarioId}`).emit("actualizar_badge", {
          usuarioID: destinatarioId,
          incrementar: true,
          cantidad: 1
        });

        console.log("✅ Notificación y badge enviados a usuario:", destinatarioId);

        // Push notification
        const usuarioDestino = await Usuario.findByPk(destinatarioId, {
          transaction: options.transaction,
        });

        if (usuarioDestino?.expo_push_token) {
          await this.sendPushNotification({
            userId: destinatarioId,
            titulo: "📅 Nueva Cita",
            cuerpo: mensaje,
            data: {
              type: "cita",
              citaId: cita.id,
              screen: "DetalleCita",
            },
          });
        }
      }
    } catch (error) {
      console.error("❌ Error en enviarNotificacionCitaTiempoReal:", error);
      throw error;
    }
  }

  async enviarNotificacionesCita(cita, usuarioCreador, options = {}) {
    try {
      console.log("🔔 Enviando notificaciones de cita para:", cita.id);

      const io = req.app.get("io");
      const citaCompleta = await Cita.findByPk(cita.id, {
        include: [
          { model: Servicio, as: "servicio" },
          {
            model: Barbero,
            as: "barbero",
            include: [{ model: Usuario, as: "usuario" }],
          },
          {
            model: Cliente,
            as: "cliente",
            include: [{ model: Usuario, as: "usuario" }],
          },
        ],
        transaction: options.transaction,
      });

      const rolCreador = usuarioCreador.rol?.nombre;
      let destinatarios = [];

      // Determinar destinatarios según quién creó la cita
      if (rolCreador === "administrador") {
        if (citaCompleta.barbero?.usuario) {
          destinatarios.push({
            usuario: citaCompleta.barbero.usuario,
            tipo: "barbero",
          });
        }
        if (citaCompleta.cliente?.usuario) {
          destinatarios.push({
            usuario: citaCompleta.cliente.usuario,
            tipo: "cliente",
          });
        }
      } else if (rolCreador === "barbero") {
        const administradores = await Usuario.findAll({
          include: [
            {
              model: Rol,
              as: "rol",
              where: { nombre: "administrador" },
            },
          ],
          transaction: options.transaction,
        });

        administradores.forEach((admin) => {
          destinatarios.push({ usuario: admin, tipo: "administrador" });
        });

        if (citaCompleta.cliente?.usuario) {
          destinatarios.push({
            usuario: citaCompleta.cliente.usuario,
            tipo: "cliente",
          });
        }
      } else if (rolCreador === "cliente") {
        if (citaCompleta.barbero?.usuario) {
          destinatarios.push({
            usuario: citaCompleta.barbero.usuario,
            tipo: "barbero",
          });
        }

        const administradores = await Usuario.findAll({
          include: [
            {
              model: Rol,
              as: "rol",
              where: { nombre: "administrador" },
            },
          ],
          transaction: options.transaction,
        });

        administradores.forEach((admin) => {
          destinatarios.push({ usuario: admin, tipo: "administrador" });
        });
      }

      const usuariosNotificados = new Set();
      const fechaFormateada = new Date(citaCompleta.fecha).toLocaleDateString(
        "es-ES"
      );

      for (const destinatario of destinatarios) {
        if (!usuariosNotificados.has(destinatario.usuario.id)) {
          usuariosNotificados.add(destinatario.usuario.id);

          let titulo, cuerpo;

          if (destinatario.tipo === "barbero") {
            titulo = "📅 Nueva cita asignada";
            cuerpo = `Tienes una nueva cita el ${fechaFormateada} a las ${citaCompleta.hora.substring(
              0,
              5
            )} para ${citaCompleta.servicio?.nombre || "servicio"}`;
          } else if (destinatario.tipo === "cliente") {
            titulo = "📅 Cita confirmada";
            cuerpo = `Tu cita ha sido confirmada para el ${fechaFormateada} a las ${citaCompleta.hora.substring(
              0,
              5
            )}`;
          } else {
            titulo = "📅 Nueva cita creada";
            cuerpo = `Se ha creado una nueva cita para el ${fechaFormateada} a las ${citaCompleta.hora.substring(
              0,
              5
            )}`;
          }

          // Crear notificación en BD
          const notificacion = await Notificacion.create(
            {
              usuarioID: destinatario.usuario.id,
              titulo,
              cuerpo,
              tipo: "cita_creada",
              relacionId: citaCompleta.id,
              leido: false,
            },
            { transaction: options.transaction }
          );

          // ✅ ENVIAR POR SOCKET - Notificación completa
          io.to(`usuario_${destinatario.usuario.id}`).emit(
            "nueva_notificacion",
            {
              ...notificacion.toJSON(),
              sound: true,
              cita: citaCompleta,
            }
          );

          // ✅ ENVIAR EVENTO ESPECIAL PARA ACTUALIZAR BADGE
          io.to(`usuario_${destinatario.usuario.id}`).emit("actualizar_badge", {
            usuarioID: destinatario.usuario.id,
            incrementar: true,
            cantidad: 1
          });

          console.log("✅ Notificación y badge enviados a usuario:", destinatario.usuario.id);

          // ✅ Enviar push notification
          if (destinatario.usuario.expo_push_token) {
            await this.sendPushNotification({
              userId: destinatario.usuario.id,
              titulo,
              cuerpo,
              data: {
                type: "cita",
                citaId: citaCompleta.id,
                notificacionId: notificacion.id,
                screen: "DetalleCita",
              },
            });
          }
        }
      }

      console.log(
        "✅ Notificaciones enviadas correctamente a",
        usuariosNotificados.size,
        "destinatarios"
      );
    } catch (error) {
      console.error("❌ Error enviando notificaciones de cita:", error);
      throw error;
    }
  }

  async createAppointmentNotification(citaId, tipo, options = {}) {
    try {
      console.log("🔔 CREANDO NOTIFICACIÓN - Cita ID:", citaId, "Tipo:", tipo);

      const cita = await Cita.findByPk(citaId, {
        include: [
          {
            model: Servicio,
            as: "servicio",
          },
          {
            model: Barbero,
            as: "barbero",
            include: [
              {
                model: Usuario,
                as: "usuario",
              },
            ],
          },
          {
            model: Cliente,
            as: "cliente",
          },
        ],
        transaction: options.transaction,
      });

      if (!cita?.barbero?.usuario) {
        console.error(
          "❌ No se pudo obtener información necesaria para la notificación"
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

      console.log("📝 Creando notificación con:", {
        usuarioID: usuarioId,
        titulo,
        cuerpo,
        leido: false,
      });

      const notificacion = await Notificacion.create(
        {
          usuarioID: usuarioId,
          titulo,
          cuerpo,
          tipo: "cita",
          relacionId: cita.id,
          leido: false,
        },
        { transaction: options.transaction }
      );

      const io = req.app.get("io");
      io.emit("newNotification", {
        usuarioID: usuarioId,
        titulo,
        cuerpo,
        notificacion,
      });

      console.log("✅ Notificación creada exitosamente:", notificacion.id);

      const usuario = await Usuario.findByPk(usuarioId);

      if (usuario?.expo_push_token) {
        console.log("📱 Enviando push notification...");
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
      } else {
        console.log("📵 Usuario no tiene token push registrado");
      }

      return notificacion;
    } catch (error) {
      console.error("❌ Error en createAppointmentNotification:", error);
      throw error;
    }
  }

  async sendPushNotification({ userId, titulo, cuerpo, data = {} }) {
    try {
      const tokens = await UsuarioToken.findAll({
        where: { usuarioID: userId },
      });

      if (!tokens.length) {
        console.log(`Usuario ${userId} no tiene tokens registrados`);
        return {
          success: false,
          message: "Usuario sin tokens registrados",
        };
      }

      const messages = tokens.map((t) => ({
        to: t.token,
        sound: "default",
        title: titulo,
        body: cuerpo,
        data: { ...data },
        channelId: "default",
      }));

      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
      });

      const result = await response.json();
      return { success: true, data: result };
    } catch (error) {
      console.error("Error enviando notificación push:", error);
      return { success: false, error: error.message };
    }
  }

  async getUserNotifications(req = request, res = response) {
    try {
      const userId = req.user.id;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "ID de usuario no proporcionado en el token",
        });
      }

      const notifications = await Notificacion.findAll({
        where: { usuarioID: userId },
        order: [["createdAt", "DESC"]],
        limit: 50,
      });

      const unreadCount = await Notificacion.count({
        where: {
          usuarioID: userId,
          leido: false,
        },
      });

      return res.json({
        success: true,
        data: { notifications, unreadCount },
      });
    } catch (error) {
      console.error("Error obteniendo notificaciones:", error);
      return res.status(500).json({
        success: false,
        message: "Error al obtener notificaciones",
        error: process.env.NODE_ENV === "development" ? error.message : null,
      });
    }
  }

  async getUnreadCount(req = request, res = response) {
    try {
      const userId = req.user.id;
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
      console.error("Error getting unread count:", error);
      return res.status(500).json({
        success: false,
        message: "Error al obtener conteo de no leídas",
      });
    }
  }

  async markAllAsRead(req = request, res = response) {
    try {
      const userId = req.user.id;

      await Notificacion.update(
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
        message: "Notificaciones marcadas como leídas",
      });
    } catch (error) {
      console.error("Error marking notifications as read:", error);
      return res.status(500).json({
        success: false,
        message: "Error al marcar notificaciones como leídas",
      });
    }
  }

  async sendTestNotification(req = request, res = response) {
    try {
      const { userId, title, body } = req.body;

      if (!userId || !title || !body) {
        return res.status(400).json({
          success: false,
          message: "Se requieren userId, title y body",
        });
      }

      const usuario = await Usuario.findByPk(userId);

      if (!usuario) {
        return res.status(404).json({
          success: false,
          message: "Usuario no encontrado",
        });
      }

      const result = await this.sendPushNotification({
        userId,
        titulo: title,
        cuerpo: body,
        data: {
          type: "test",
          screen: "Home",
        },
      });

      if (!result.success) {
        return res.status(500).json(result);
      }

      return res.json({
        success: true,
        message: "Notificación de prueba enviada",
        data: result.data,
      });
    } catch (error) {
      console.error("Error sending test notification:", error);
      return res.status(500).json({
        success: false,
        message: "Error al enviar notificación de prueba",
        error: error.message,
      });
    }
  }
}

export default new NotificationsController();