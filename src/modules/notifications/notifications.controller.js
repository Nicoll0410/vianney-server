    import { response, request } from "express";
    import { Usuario } from "../usuarios/usuarios.model.js";
    import { Notificacion } from "./notifications.model.js";
    import fetch from "node-fetch"; // para enviar notis a Expo Push API
    import { Cita } from "../citas/citas.model.js";
    import { Servicio } from "../servicios/servicios.model.js";
    import { Barbero } from "../barberos/barberos.model.js";
    import { Cliente } from "../clientes/clientes.model.js";

    class NotificationsController {
    // Guardar el token Expo en el usuario
    async saveToken(req = request, res = response) {
        try {
        const { userId, token } = req.body;
        if (!userId || !token) {
            return res.status(400).json({ msg: "Faltan datos" });
        }

        const usuario = await Usuario.findByPk(userId);
        if (!usuario) {
            return res.status(404).json({ msg: "Usuario no encontrado" });
        }

        usuario.expo_push_token = token;
        await usuario.save();

        return res.json({ msg: "Token guardado correctamente" });
        } catch (error) {
        console.error("Error guardando token:", error);
        res.status(500).json({ msg: "Error en el servidor" });
        }
    }

    // Nuevo método para crear notificación de cita
async createAppointmentNotification(citaId, tipo, options = {}) {
    try {
        console.log(`Creando notificación para cita ${citaId}, tipo: ${tipo}`);
        
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
                        as: 'usuario',
                        required: true
                    }]
                },
                { 
                    model: Cliente, 
                    as: "cliente" 
                },
            ],
            ...options
        });

        if (!cita) {
            console.error('Cita no encontrada para notificación');
            return null;
        }

        if (!cita.barbero || !cita.barbero.usuario) {
            console.error('Barbero no tiene usuario asociado');
            return null;
        }

        const usuarioId = cita.barbero.usuario.id;
        const fechaFormateada = new Date(cita.fecha).toLocaleDateString('es-ES', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
        });
        const horaFormateada = cita.hora.substring(0, 5);

        let titulo, cuerpo;
        
        if (tipo === "creacion") {
            titulo = "📅 Nueva cita agendada";
            cuerpo = `El cliente ${cita.cliente?.nombre || cita.pacienteTemporalNombre || 'un cliente'} ha agendado una cita para el ${fechaFormateada} a las ${horaFormateada}`;
        } else if (tipo === "cancelacion") {
            titulo = "❌ Cita cancelada";
            cuerpo = `La cita del ${fechaFormateada} a las ${horaFormateada} ha sido cancelada`;
        } else {
            return null;
        }

        // Crear notificación en BD
        const notificacion = await Notificacion.create({
            usuarioID: usuarioId,
            titulo,
            cuerpo,
            tipo: "cita",
            relacionId: cita.id,
            leido: false
        }, options);

        console.log(`Notificación creada en BD con ID: ${notificacion.id}`);

        // Obtener usuario completo con token push
        const usuario = await Usuario.findByPk(usuarioId);
        
        if (usuario?.expo_push_token) {
            console.log(`Enviando notificación push a usuario ${usuarioId}`);
            await this.sendPushNotification({
                userId: usuario.id,
                titulo,
                cuerpo,
                data: { 
                    type: "cita",
                    citaId: cita.id,
                    notificacionId: notificacion.id
                }
            });
        } else {
            console.log(`Usuario ${usuarioId} no tiene token push registrado`);
        }

        return notificacion;
    } catch (error) {
        console.error("Error en createAppointmentNotification:", error);
        if (options.transaction) {
            throw error; // Relanzar el error para que la transacción se maneje arriba
        }
        return null;
    }
}


    // Método mejorado para enviar notificaciones push
    async sendPushNotification({ userId, titulo, cuerpo, data = {} }) {
        try {
        const usuario = await Usuario.findByPk(userId);
        if (!usuario || !usuario.expo_push_token) {
            return { success: false, message: "Usuario sin token registrado" };
        }

        const message = {
            to: usuario.expo_push_token,
            sound: "default",
            title: titulo,
            body: cuerpo,
            data: { ...data, type: "cita" },
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
        return { success: true, data: result };
        } catch (error) {
        console.error("Error enviando notificación push:", error);
        return { success: false, error: error.message };
        }
    }

    // Enviar notificación push usando Expo y guardar en la tabla
    async sendNotification(req = request, res = response) {
        try {
        const { userId, titulo, cuerpo } = req.body;
        if (!userId || !titulo || !cuerpo) {
            return res.status(400).json({ msg: "Faltan datos" });
        }

        const usuario = await Usuario.findByPk(userId);
        if (!usuario || !usuario.expo_push_token) {
            return res.status(404).json({ msg: "Usuario sin token registrado" });
        }

        // Guardar en BD
        const notificacion = await Notificacion.create({
            usuarioID: userId,
            titulo,
            cuerpo,
        });

        // Enviar a Expo
        const mensaje = {
            to: usuario.expo_push_token,
            sound: "default",
            title: titulo,
            body: cuerpo,
            data: { notificacionId: notificacion.id },
        };

        const responseExpo = await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
            Accept: "application/json",
            "Accept-encoding": "gzip, deflate",
            "Content-Type": "application/json",
            },
            body: JSON.stringify(mensaje),
        });

        const data = await responseExpo.json();
        console.log("Respuesta Expo:", data);

        return res.json({
            msg: "Notificación enviada y guardada",
            notificacion,
            expoResponse: data,
        });
        } catch (error) {
        console.error("Error enviando notificación:", error);
        res.status(500).json({ msg: "Error en el servidor" });
        }
    }

    // Listar notificaciones de un usuario
  async getUserNotifications(req = request, res = response) {
    try {
        const { userId } = req.user; // Obtenido del JWT middleware
        
        const notificaciones = await Notificacion.findAll({
            where: { usuarioID: userId },
            order: [["createdAt", "DESC"]],
            include: [
                { model: Usuario, as: "usuario", attributes: ["nombre", "avatar"] },
            ],
        });

        return res.json({ notificaciones });
    } catch (error) {
        console.error("Error obteniendo notificaciones:", error);
        res.status(500).json({
            msg: "Error en el servidor",
            error: process.env.NODE_ENV === "development" ? error.message : null,
        });
    }
}

async getUserNotificationsById(req = request, res = response) {
    try {
        const { userId } = req.params;
        
        const notificaciones = await Notificacion.findAll({
            where: { usuarioID: userId },
            order: [["createdAt", "DESC"]],
            include: [
                { model: Usuario, as: "usuario", attributes: ["nombre", "avatar"] },
            ],
        });

        return res.json({ notificaciones });
    } catch (error) {
        console.error("Error obteniendo notificaciones:", error);
        res.status(500).json({
            msg: "Error en el servidor",
            error: process.env.NODE_ENV === "development" ? error.message : null,
        });
    }
}

async markAllAsRead(req = request, res = response) {
    try {
        const { userId } = req.user;
        
        await Notificacion.update(
            { leido: true },
            { where: { usuarioID: userId, leido: false } }
        );

        return res.json({ success: true, message: "Todas las notificaciones marcadas como leídas" });
    } catch (error) {
        console.error("Error marcando notificaciones como leídas:", error);
        res.status(500).json({ success: false, message: "Error en el servidor" });
    }
}

    // Marcar como leída
    async markAsRead(req = request, res = response) {
        try {
        const { id } = req.params;
        const notificacion = await Notificacion.findByPk(id);

        if (!notificacion) {
            return res.status(404).json({ msg: "Notificación no encontrada" });
        }

        notificacion.leido = true;
        await notificacion.save();

        return res.json({ msg: "Notificación marcada como leída", notificacion });
        } catch (error) {
        console.error("Error marcando como leída:", error);
        res.status(500).json({ msg: "Error en el servidor" });
        }
    }
    }

    export default new NotificationsController();
