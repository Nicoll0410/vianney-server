import { response, request } from "express";
import { Usuario } from "../usuarios/usuarios.model.js";
import { Notificacion } from "./notifications.model.js";
import fetch from "node-fetch";
import { Cita } from "../citas/citas.model.js";
import { Servicio } from "../servicios/servicios.model.js";
import { Barbero } from "../barberos/barberos.model.js";
import { Cliente } from "../clientes/clientes.model.js";
import { UsuarioToken } from "./usuarios_tokens.model.js";

class NotificationsController {
    async saveToken(req = request, res = response) {
        try {
            const userId = req.user.id;
            const { token, dispositivo, sistemaOperativo } = req.body;
            
            if (!token) {
                return res.status(400).json({ 
                    success: false, 
                    message: "El token es requerido" 
                });
            }

            const usuario = await Usuario.findByPk(userId);
            if (!usuario) {
                return res.status(404).json({ 
                    success: false, 
                    message: "Usuario no encontrado" 
                });
            }

            const [usuarioToken, created] = await UsuarioToken.findOrCreate({
                where: { usuarioID: userId, token },
                defaults: { dispositivo, sistemaOperativo }
            });

            if (!created) {
                await usuarioToken.update({ dispositivo, sistemaOperativo });
            }

            return res.json({ 
                success: true, 
                message: "Token guardado correctamente", 
                data: { userId, token } 
            });
        } catch (error) {
            console.error("Error guardando token:", error);
            return res.status(500).json({ 
                success: false, 
                message: "Error en el servidor", 
                error: process.env.NODE_ENV === "development" ? error.message : null 
            });
        }
    }

    async createNotification(req = request, res = response) {
        try {
            const { usuarioID, titulo, cuerpo, tipo, relacionId } = req.body;
            
            // Validar que el usuario existe
            const usuario = await Usuario.findByPk(usuarioID);
            if (!usuario) {
                return res.status(404).json({
                    success: false,
                    message: "Usuario no encontrado"
                });
            }

            const notificacion = await Notificacion.create({
                usuarioID,
                titulo,
                cuerpo,
                tipo: tipo || "sistema",
                relacionId: relacionId || null,
                leido: false
            });

            // 👇 Nuevo: emitir evento socket
const io = req.app.get("io");
io.emit("newNotification", {
    usuarioID,
    titulo,
    cuerpo,
    notificacion
});


            return res.status(201).json({
                success: true,
                message: "Notificación creada exitosamente",
                data: notificacion
            });
        } catch (error) {
            console.error("Error creando notificación:", error);
            return res.status(500).json({
                success: false,
                message: "Error al crear notificación",
                error: process.env.NODE_ENV === "development" ? error.message : null
            });
        }
    }

    async createAppointmentNotification(citaId, tipo, options = {}) {
        try {
            console.log("🔔 CREANDO NOTIFICACIÓN - Cita ID:", citaId, "Tipo:", tipo);
            
            const cita = await Cita.findByPk(citaId, {
                include: [
                    { 
                        model: Servicio, 
                        as: "servicio" 
                    },
                    { 
                        model: Barbero, 
                        as: "barbero", 
                        include: [{ 
                            model: Usuario, 
                            as: "usuario" 
                        }] 
                    },
                    { 
                        model: Cliente, 
                        as: "cliente" 
                    }
                ],
                transaction: options.transaction
            });

            if (!cita?.barbero?.usuario) {
                console.error("❌ No se pudo obtener información necesaria para la notificación");
                return null;
            }

            const usuarioId = cita.barbero.usuario.id;
            const fechaFormateada = new Date(cita.fecha).toLocaleDateString("es-ES", {
                weekday: "long",
                day: "numeric",
                month: "long"
            });
            
            const horaFormateada = cita.hora.substring(0, 5);
            let titulo, cuerpo;

            if (tipo === "creacion") {
                titulo = "📅 Nueva cita agendada";
                cuerpo = `El cliente ${cita.cliente?.nombre || cita.pacienteTemporalNombre || "un cliente"} ha agendado una cita para el ${fechaFormateada} a las ${horaFormateada}`;
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
                leido: false
            });

            const notificacion = await Notificacion.create({
                usuarioID: usuarioId,
                titulo,
                cuerpo,
                tipo: "cita",
                relacionId: cita.id,
                leido: false
            }, { transaction: options.transaction });

            const io = req.app.get("io");
io.emit("newNotification", {
    usuarioID: usuarioId,
    titulo,
    cuerpo,
    notificacion
});

            console.log("✅ Notificación creada exitosamente:", notificacion.id);

            // Obtener usuario con token push
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
                        screen: "DetalleCita"
                    }
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
                where: { usuarioID: userId }
            });

            if (!tokens.length) {
                console.log(`Usuario ${userId} no tiene tokens registrados`);
                return { 
                    success: false, 
                    message: "Usuario sin tokens registrados" 
                };
            }

            const messages = tokens.map(t => ({
                to: t.token,
                sound: "default",
                title: titulo,
                body: cuerpo,
                data: { ...data },
                channelId: "default"
            }));

            const response = await fetch("https://exp.host/--/api/v2/push/send", {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Accept-encoding": "gzip, deflate",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(messages)
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
                    message: "ID de usuario no proporcionado en el token" 
                });
            }

            const notifications = await Notificacion.findAll({
                where: { usuarioID: userId },
                order: [["createdAt", "DESC"]],
                limit: 50
            });

            const unreadCount = await Notificacion.count({
                where: { 
                    usuarioID: userId, 
                    leido: false 
                }
            });

            return res.json({ 
                success: true, 
                data: { notifications, unreadCount } 
            });
        } catch (error) {
            console.error("Error obteniendo notificaciones:", error);
            return res.status(500).json({ 
                success: false, 
                message: "Error al obtener notificaciones", 
                error: process.env.NODE_ENV === "development" ? error.message : null 
            });
        }
    }

    async getUnreadCount(req = request, res = response) {
        try {
            const userId = req.user.id;
            const count = await Notificacion.count({
                where: { 
                    usuarioID: userId, 
                    leido: false 
                }
            });

            return res.json({ 
                success: true, 
                count 
            });
        } catch (error) {
            console.error("Error getting unread count:", error);
            return res.status(500).json({ 
                success: false, 
                message: "Error al obtener conteo de no leídas" 
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
                        leido: false 
                    } 
                }
            );

            return res.json({ 
                success: true, 
                message: "Notificaciones marcadas como leídas" 
            });
        } catch (error) {
            console.error("Error marking notifications as read:", error);
            return res.status(500).json({ 
                success: false, 
                message: "Error al marcar notificaciones como leídas" 
            });
        }
    }

    async sendTestNotification(req = request, res = response) {
        try {
            const { userId, title, body } = req.body;
            
            if (!userId || !title || !body) {
                return res.status(400).json({ 
                    success: false, 
                    message: "Se requieren userId, title y body" 
                });
            }

            const usuario = await Usuario.findByPk(userId);
            
            if (!usuario) {
                return res.status(404).json({ 
                    success: false, 
                    message: "Usuario no encontrado" 
                });
            }

            const result = await this.sendPushNotification({
                userId,
                titulo: title,
                cuerpo: body,
                data: { 
                    type: "test", 
                    screen: "Home" 
                }
            });

            if (!result.success) {
                return res.status(500).json(result);
            }

            return res.json({ 
                success: true, 
                message: "Notificación de prueba enviada", 
                data: result.data 
            });
        } catch (error) {
            console.error("Error sending test notification:", error);
            return res.status(500).json({ 
                success: false, 
                message: "Error al enviar notificación de prueba", 
                error: error.message 
            });
        }
    }
}

export default new NotificationsController();