import { response, request } from "express";
import { Cita } from "./citas.model.js";
import { Servicio } from "../servicios/servicios.model.js";
import { ServiciosPorInsumos } from "../servicios/servicios_insumos.model.js";
import { Barbero } from "../barberos/barberos.model.js";
import { Cliente } from "../clientes/clientes.model.js";
import { Usuario } from "../usuarios/usuarios.model.js";
import { Rol } from "../roles/roles.model.js";
import { filtros } from "../../utils/filtros.util.js";
import { BOOLEAN, literal, Op } from "sequelize";
import {
  add,
  addHours,
  isSaturday,
  isSunday,
  isToday,
  parse,
  parseISO,
} from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { format } from "mysql2";
import { correos } from "../../utils/correos.util.js";
import { sendEmail } from "../../utils/send-email.util.js";
import jwt from "jsonwebtoken";
import { Insumo } from "../insumos/insumos.model.js";
import { sequelize } from "../../database.js";
import { Notificacion } from "../notifications/notifications.model.js";

class CitasController {
  async get(req = request, res = response) {
    try {
      async function obtenerIdsRelacionados(Modelo, search) {
        const registros = await Modelo.findAll({
          attributes: ["id"],
          where: {
            [Op.or]: [
              {
                nombre: {
                  [Op.like]: `%${search}%`,
                },
              },
            ],
          },
        });
        return registros.map((registro) => registro["id"]);
      }

      const idsServicio = await obtenerIdsRelacionados(
        Servicio,
        req.query.search
      );
      const idsCliente = await obtenerIdsRelacionados(
        Cliente,
        req.query.search
      );
      const idsBarbero = await obtenerIdsRelacionados(
        Barbero,
        req.query.search
      );

      const allIds = Array.from(
        new Set([...idsServicio, ...idsCliente, ...idsBarbero])
      );

      const params = filtros.obtenerFiltros({
        busqueda: req.query.search,
        modelo: Cita,
        pagina: req.query.page,
      });

      const whereConditions = params.where[Op.or];

      if (allIds.length > 0) {
        whereConditions.push({
          [Op.or]: [
            { servicioID: { [Op.in]: idsServicio } },
            { pacienteID: { [Op.in]: idsCliente } },
            { barberoID: { [Op.in]: idsBarbero } },
          ],
        });
      }

      const queryOptions = {
        order: [["fecha", "DESC"]],
        where: {
          [Op.or]: whereConditions,
          estado: {
            [Op.in]: [
              "Pendiente",
              "Confirmada",
              "Completa",
              "Expirada",
              "Cancelada",
            ],
          },
        },
        include: [
          {
            model: Servicio,
            as: "servicio",
            required: false,
            attributes: [
              "nombre",
              "descripcion",
              "duracionMaxima",
              "duracionRedondeada",
            ],
          },
          {
            model: Cliente,
            as: "cliente",
            required: false,
            attributes: ["nombre", "avatar", "telefono"],
          },
          {
            model: Barbero,
            as: "barbero",
            required: false,
            attributes: ["nombre", "avatar"],
          },
        ],
      };

      if (req.query.all === "true") {
        const citas = await Cita.findAll(queryOptions);
        return res.json({ citas });
      } else {
        const citas = await Cita.findAll({
          ...params,
          ...queryOptions,
        });
        const total = await Cita.count({ ...params });
        return res.json({ citas, total });
      }
    } catch (error) {
      return res.status(400).json({
        mensaje: error.message,
      });
    }
  }

  async getAll(req = request, res = response) {
    try {
      async function obtenerIdsRelacionados(Modelo, search) {
        const registros = await Modelo.findAll({
          attributes: ["id"],
          where: {
            [Op.or]: [
              {
                nombre: {
                  [Op.like]: `%${search}%`,
                },
              },
            ],
          },
        });
        return registros.map((registro) => registro["id"]);
      }

      const idsServicio = await obtenerIdsRelacionados(
        Servicio,
        req.query.search
      );
      const idsCliente = await obtenerIdsRelacionados(
        Cliente,
        req.query.search
      );
      const idsBarbero = await obtenerIdsRelacionados(
        Barbero,
        req.query.search
      );

      const allIds = Array.from(
        new Set([...idsServicio, ...idsCliente, ...idsBarbero])
      );

      const params = filtros.obtenerFiltros({
        busqueda: req.query.search,
        modelo: Cita,
      });

      const whereConditions = params.where[Op.or];

      if (allIds.length > 0) {
        whereConditions.push({
          [Op.or]: [
            { servicioID: { [Op.in]: idsServicio } },
            { pacienteID: { [Op.in]: idsCliente } },
            { barberoID: { [Op.in]: idsBarbero } },
          ],
        });
      }

      const citas = await Cita.findAll({
        ...params,
        order: [["fecha", "DESC"]],
        where: { [Op.or]: whereConditions },
        include: [
          {
            model: Servicio,
            as: "servicio",
            required: false,
            attributes: ["nombre", "descripcion", "duracionMaxima"],
          },
          {
            model: Cliente,
            as: "cliente",
            required: false,
            attributes: ["nombre", "avatar", "telefono"],
          },
          {
            model: Barbero,
            as: "barbero",
            required: false,
            attributes: ["nombre", "avatar"],
          },
        ],
      });

      const total = await Cita.count({ ...params });
      return res.json({ citas, total });
    } catch (error) {
      return res.status(400).json({
        mensaje: error.message,
      });
    }
  }

  async getByBarberID(req = request, res = response) {
    try {
      const authHeader = req.header("Authorization");
      if (!authHeader)
        throw new Error("¡Ups! Parece que no tienes una sesión activa");
      if (!authHeader.startsWith("Bearer "))
        throw new Error("Formato del token invalido");

      const token = authHeader.split(" ")[1];
      const { email } = jwt.decode(token);
      const usuario = await Usuario.findOne({ where: { email } });
      const barbero = await Barbero.findOne({
        where: { usuarioID: usuario.id },
      });

      const obtenerIdsRelacionados = async (Modelo, search) => {
        const registros = await Modelo.findAll({
          attributes: ["id"],
          where: {
            [Op.or]: [{ nombre: { [Op.like]: `%${search}%` } }],
          },
        });
        return registros.map((r) => r.id);
      };

      const idsServicio = await obtenerIdsRelacionados(
        Servicio,
        req.query.search
      );
      const idsCliente = await obtenerIdsRelacionados(
        Cliente,
        req.query.search
      );
      const idsBarbero = await obtenerIdsRelacionados(
        Barbero,
        req.query.search
      );

      const allIds = Array.from(
        new Set([...idsServicio, ...idsCliente, ...idsBarbero])
      );

      const params = filtros.obtenerFiltros({
        busqueda: req.query.search,
        modelo: Cita,
        pagina: req.query.page,
      });

      const whereConditions = params.where[Op.or];

      if (allIds.length) {
        whereConditions.push({
          [Op.or]: [
            { servicioID: { [Op.in]: idsServicio } },
            { pacienteID: { [Op.in]: idsCliente } },
            { barberoID: { [Op.in]: idsBarbero } },
          ],
        });
      }

      const baseQuery = {
        order: [["fecha", "DESC"]],
        where: {
          [Op.or]: whereConditions,
          barberoID: barbero.id,
        },
        include: [
          {
            model: Servicio,
            as: "servicio",
            required: false,
            attributes: ["nombre", "descripcion", "duracionMaxima"],
          },
          {
            model: Cliente,
            as: "cliente",
            required: false,
            attributes: ["nombre", "avatar", "telefono"],
          },
          {
            model: Barbero,
            as: "barbero",
            required: false,
            attributes: ["nombre", "avatar"],
          },
        ],
      };

      if (req.query.all === "true") {
        const citas = await Cita.findAll(baseQuery);
        return res.json({ citas });
      }

      const citas = await Cita.findAll({
        ...params,
        ...baseQuery,
      });
      const total = await Cita.count({
        ...params,
        where: baseQuery.where,
      });

      return res.json({ citas, total });
    } catch (error) {
      return res.status(400).json({
        mensaje: error.message,
      });
    }
  }

  async getSells(req = request, res = response) {
    try {
      async function obtenerIdsRelacionados(Modelo, search) {
        const registros = await Modelo.findAll({
          attributes: ["id"],
          where: {
            [Op.or]: [
              {
                nombre: {
                  [Op.like]: `%${search}%`,
                },
              },
            ],
          },
        });
        return registros.map((registro) => registro["id"]);
      }

      const idsServicio = await obtenerIdsRelacionados(
        Servicio,
        req.query.search
      );
      const idsCliente = await obtenerIdsRelacionados(
        Cliente,
        req.query.search
      );
      const idsBarbero = await obtenerIdsRelacionados(
        Barbero,
        req.query.search
      );

      const allIds = Array.from(
        new Set([...idsServicio, ...idsCliente, ...idsBarbero])
      );

      const params = filtros.obtenerFiltros({
        busqueda: req.query.search,
        modelo: Cita,
        pagina: req.query.page,
      });

      const whereConditions = params.where[Op.or];

      if (allIds.length > 0) {
        whereConditions.push({
          [Op.or]: [
            { servicioID: { [Op.in]: idsServicio } },
            { pacienteID: { [Op.in]: idsCliente } },
            { barberoID: { [Op.in]: idsBarbero } },
          ],
        });
      }

      const citas = await Cita.findAll({
        ...params,
        order: [["fecha", "DESC"]],
        where: {
          [Op.or]: whereConditions,
          estado: "Completa",
        },
        include: [
          {
            model: Servicio,
            as: "servicio",
            required: false,
            attributes: ["nombre", "descripcion", "duracionMaxima", "precio"],
          },
          {
            model: Cliente,
            as: "cliente",
            required: false,
            attributes: ["nombre", "avatar", "telefono"],
          },
          {
            model: Barbero,
            as: "barbero",
            required: false,
            attributes: ["nombre", "avatar"],
          },
        ],
      });

      const total = await Cita.count({
        ...params,
        where: {
          [Op.or]: whereConditions,
          estado: "Completa",
        },
      });

      return res.json({ citas, total });
    } catch (error) {
      return res.status(400).json({
        mensaje: error.message,
      });
    }
  }

  async getInformationToCreate(req = request, res = response) {
    try {
      const servicios = await Servicio.findAll();
      const barberos = await Barbero.findAll({
        include: {
          model: Usuario,
          required: true,
          attributes: [],
          where: { estaVerificado: true },
          include: {
            model: Rol,
            as: "rol",
            where: { nombre: "Barbero" },
            required: true,
            attributes: [],
          },
        },
      });

      const clientes = await Cliente.findAll({
        include: {
          model: Usuario,
          required: true,
          attributes: [],
          where: { estaVerificado: true },
          include: {
            model: Rol,
            as: "rol",
            where: { nombre: "Cliente" },
            required: true,
            attributes: [],
          },
        },
      });

      return res.status(200).json({
        clientes,
        barberos,
        servicios,
      });
    } catch (error) {
      return res.status(400).json({
        mensaje: error.message,
      });
    }
  }

  async create(req = request, res = response) {
    const t = await sequelize.transaction();
    try {
      console.log(
        "Datos recibidos para crear cita:",
        JSON.stringify(req.body, null, 2)
      );

      // Validaciones mejoradas
      const requiredFields = ["barberoID", "servicioID", "fecha", "hora"];

      const missingFields = requiredFields.filter((field) => !req.body[field]);
      if (missingFields.length > 0) {
        await t.rollback();
        return res.status(400).json({
          mensaje: `Faltan campos requeridos: ${missingFields.join(", ")}`,
          camposFaltantes: missingFields,
        });
      }

      // Verificar que el barbero existe
      const barbero = await Barbero.findByPk(req.body.barberoID, {
        include: [{ model: Usuario, as: "usuario" }],
        transaction: t,
      });

      if (!barbero) {
        await t.rollback();
        return res.status(404).json({
          mensaje: "Barbero no encontrado",
          barberoID: req.body.barberoID,
        });
      }

      // Verificar que el servicio existe
      const servicio = await Servicio.findByPk(req.body.servicioID, {
        transaction: t,
      });
      if (!servicio) {
        await t.rollback();
        return res.status(404).json({
          mensaje: "Servicio no encontrado",
          servicioID: req.body.servicioID,
        });
      }

      // Validar cliente o cliente temporal
      if (!req.body.pacienteID && !req.body.pacienteTemporalNombre) {
        await t.rollback();
        return res.status(400).json({
          mensaje: "Se requiere pacienteID o pacienteTemporalNombre",
        });
      }

      // Si es cliente temporal, NO debe tener pacienteID
      if (req.body.pacienteTemporalNombre && req.body.pacienteID) {
        await t.rollback();
        return res.status(400).json({
          mensaje:
            "No se puede enviar pacienteID y pacienteTemporalNombre simultáneamente",
        });
      }

      // Formatear hora correctamente
      let hora = req.body.hora;
      if (!hora.includes(":")) {
        hora = `${hora}:00`;
      } else if (hora.split(":").length === 2) {
        hora = `${hora}:00`;
      }

      // Calcular duración y hora de fin
      const [horas, minutos] = servicio.duracionMaxima.split(":").map(Number);
      const duracionMinutos = horas * 60 + minutos;
      const horaFin = new Date(`2000-01-01T${hora}`);
      horaFin.setMinutes(horaFin.getMinutes() + duracionMinutos);

      const horaFinFormatted = `${horaFin
        .getHours()
        .toString()
        .padStart(2, "0")}:${horaFin
        .getMinutes()
        .toString()
        .padStart(2, "0")}:00`;

      // Verificar disponibilidad
      const citasSolapadas = await Cita.findAll({
        where: {
          barberoID: req.body.barberoID,
          fecha: req.body.fecha,
          estado: { [Op.notIn]: ["Cancelada", "Expirada"] },
        },
        transaction: t,
      });

      // Convertir a minutos para comparación
      const [horaH, horaM] = hora.split(":").map(Number);
      const horaFinH = horaFin.getHours();
      const horaFinM = horaFin.getMinutes();

      const inicioMinutos = horaH * 60 + horaM;
      const finMinutos = horaFinH * 60 + horaFinM;

      const tieneConflicto = citasSolapadas.some((cita) => {
        const [citaHoraH, citaHoraM] = cita.hora.split(":").map(Number);
        const [citaHoraFinH, citaHoraFinM] = cita.horaFin
          .split(":")
          .map(Number);

        const citaInicioMin = citaHoraH * 60 + citaHoraM;
        const citaFinMin = citaHoraFinH * 60 + citaHoraFinM;

        // Verificar si los rangos se solapan
        return (
          (inicioMinutos >= citaInicioMin && inicioMinutos < citaFinMin) ||
          (finMinutos > citaInicioMin && finMinutos <= citaFinMin) ||
          (inicioMinutos <= citaInicioMin && finMinutos >= citaFinMin)
        );
      });

      if (tieneConflicto) {
        await t.rollback();
        return res.status(400).json({
          mensaje: "El barbero ya tiene citas en ese horario",
          conflictoCon: citasSolapadas.map((c) => ({
            id: c.id,
            hora: c.hora,
            horaFin: c.horaFin,
            servicioID: c.servicioID,
          })),
        });
      }

      // Preparar datos de la cita
      const nuevaCita = {
        servicioID: req.body.servicioID,
        barberoID: req.body.barberoID,
        fecha: req.body.fecha,
        hora: hora,
        horaFin: horaFinFormatted,
        duracionReal: servicio.duracionMaxima,
        duracionRedondeada: `${Math.floor(duracionMinutos / 60)}:${(
          duracionMinutos % 60
        )
          .toString()
          .padStart(2, "0")}:00`,
        estado: "Confirmada",
        direccion: req.body.direccion || "En barbería",
      };

      // Asignar cliente
      if (req.body.pacienteID) {
        const cliente = await Cliente.findByPk(req.body.pacienteID, {
          transaction: t,
        });
        if (!cliente) {
          await t.rollback();
          return res.status(404).json({
            mensaje: "Cliente no encontrado",
            pacienteID: req.body.pacienteID,
          });
        }
        nuevaCita.pacienteID = req.body.pacienteID;
      } else {
        nuevaCita.pacienteTemporalNombre =
          req.body.pacienteTemporalNombre.trim();
        if (req.body.pacienteTemporalTelefono) {
          nuevaCita.pacienteTemporalTelefono =
            req.body.pacienteTemporalTelefono.trim();
        }
      }

      // Remover pacienteID si es undefined/null
      const datosFinales = { ...nuevaCita };
      if (
        datosFinales.pacienteID === null ||
        datosFinales.pacienteID === undefined
      ) {
        delete datosFinales.pacienteID;
      }

      // Crear la cita
      const citaCreada = await Cita.create(datosFinales, { transaction: t });

      // 🔔 SISTEMA DE NOTIFICACIONES MEJORADO
      try {
        const io = req.app.get("io");
        const userSockets = req.app.get("userSockets");
        
        // Obtener información completa para las notificaciones
        const citaCompleta = await Cita.findByPk(citaCreada.id, {
          include: [
            {
              model: Servicio,
              as: "servicio",
              attributes: ["nombre"]
            },
            {
              model: Barbero,
              as: "barbero",
              include: [{
                model: Usuario,
                as: "usuario",
                attributes: ["id"]
              }],
              attributes: ["id", "nombre"]
            },
            {
              model: Cliente,
              as: "cliente",
              include: [{
                model: Usuario,
                as: "usuario",
                attributes: ["id"]
              }],
              attributes: ["id", "nombre"]
            }
          ],
          transaction: t
        });

        // Obtener ID y rol del usuario que crea la cita
        const usuarioCreadorId = req.userId;
        const usuarioCreadorRol = req.userRol;
        
        // Formatear fecha y hora
        const fechaFormateada = new Date(citaCompleta.fecha).toLocaleDateString("es-ES", {
          weekday: "long",
          day: "numeric",
          month: "long"
        });
        
        const horaFormateada = citaCompleta.hora.substring(0, 5);
        const nombreServicio = citaCompleta.servicio.nombre;
        const nombreCliente = citaCompleta.cliente?.nombre || citaCompleta.pacienteTemporalNombre || "un cliente";
        const nombreBarbero = citaCompleta.barbero?.nombre || "un barbero";
        
        // 1. DETERMINAR QUIÉN CREÓ LA CITA Y QUIÉNES DEBEN SER NOTIFICADOS
        let destinatarios = [];

        if (usuarioCreadorRol === "administrador") {
          // Administrador crea → Notificar a barbero y cliente
          if (citaCompleta.barbero && citaCompleta.barbero.usuario) {
            destinatarios.push({
              userId: citaCompleta.barbero.usuario.id,
              tipo: "barbero"
            });
          }
          
          if (citaCompleta.cliente && citaCompleta.cliente.usuario) {
            destinatarios.push({
              userId: citaCompleta.cliente.usuario.id,
              tipo: "cliente"
            });
          }
        } 
        else if (usuarioCreadorRol === "barbero") {
          // Barbero crea → Notificar a administradores y cliente
          const administradores = await Usuario.findAll({
            where: { 
              rol_id: 1 // ID del rol administrador
            },
            attributes: ["id"],
            transaction: t
          });
          
          administradores.forEach(admin => {
            if (admin.id !== usuarioCreadorId) {
              destinatarios.push({
                userId: admin.id,
                tipo: "administrador"
              });
            }
          });
          
          if (citaCompleta.cliente && citaCompleta.cliente.usuario) {
            destinatarios.push({
              userId: citaCompleta.cliente.usuario.id,
              tipo: "cliente"
            });
          }
        } 
        else if (usuarioCreadorRol === "cliente") {
          // Cliente crea → Notificar a barbero y administradores
          if (citaCompleta.barbero && citaCompleta.barbero.usuario) {
            destinatarios.push({
              userId: citaCompleta.barbero.usuario.id,
              tipo: "barbero"
            });
          }
          
          const administradores = await Usuario.findAll({
            where: { 
              rol_id: 1 // ID del rol administrador
            },
            attributes: ["id"],
            transaction: t
          });
          
          administradores.forEach(admin => {
            if (admin.id !== usuarioCreadorId) {
              destinatarios.push({
                userId: admin.id,
                tipo: "administrador"
              });
            }
          });
        }

        // 2. ENVIAR NOTIFICACIONES A CADA DESTINATARIO
        for (const destinatario of destinatarios) {
          let titulo, cuerpo;
          
          switch (destinatario.tipo) {
            case "barbero":
              titulo = "📅 Nueva cita asignada";
              cuerpo = `Tienes una cita con ${nombreCliente} para ${nombreServicio} el ${fechaFormateada} a las ${horaFormateada}`;
              break;
              
            case "cliente":
              titulo = "✅ Cita confirmada";
              cuerpo = `Tu cita para ${nombreServicio} con ${nombreBarbero} ha sido confirmada para el ${fechaFormateada} a las ${horaFormateada}`;
              break;
              
            case "administrador":
              titulo = "📋 Nueva cita en el sistema";
              cuerpo = `Se ha creado una nueva cita para ${nombreCliente} con ${nombreBarbero} el ${fechaFormateada}`;
              break;
          }

          // Crear notificación en base de datos
          const notificacion = await Notificacion.create({
            usuarioID: destinatario.userId,
            titulo,
            cuerpo,
            tipo: "cita_creada",
            relacionId: citaCreada.id,
            leido: false
          }, { transaction: t });

          // Enviar notificación por Socket.io
          if (userSockets && userSockets.has(destinatario.userId)) {
            io.to(`user_${destinatario.userId}`).emit("nueva_notificacion", {
              ...notificacion.toJSON(),
              sound: true,
              vibrate: true
            });
            console.log(`📤 Notificación enviada por socket a usuario ${destinatario.userId}`);
          }

          // Enviar notificación push si está disponible
          try {
            const usuarioToken = await UsuarioToken.findOne({
              where: { usuarioID: destinatario.userId },
              transaction: t
            });
            
            if (usuarioToken) {
              const response = await fetch("https://exp.host/--/api/v2/push/send", {
                method: "POST",
                headers: {
                  Accept: "application/json",
                  "Accept-encoding": "gzip, deflate",
                  "Content-Type": "application/json"
                },
                body: JSON.stringify([{
                  to: usuarioToken.token,
                  sound: "default",
                  title: titulo,
                  body: cuerpo,
                  data: {
                    type: "nueva_cita",
                    citaId: citaCreada.id,
                    notificacionId: notificacion.id,
                    screen: "DetalleCita"
                  }
                }])
              });
              
              const result = await response.json();
              console.log(`📱 Notificación push enviada a usuario ${destinatario.userId}:`, result);
            }
          } catch (pushError) {
            console.error(`❌ Error enviando notificación push a usuario ${destinatario.userId}:`, pushError);
          }
        }

        console.log(`✅ Notificaciones enviadas a ${destinatarios.length} destinatarios`);

      } catch (notifError) {
        console.error("❌ Error en el sistema de notificaciones:", notifError);
        // No hacemos rollback por errores de notificación
      }

      await t.commit();

      return res.status(201).json({
        mensaje: "Cita creada exitosamente",
        cita: citaCreada,
      });
    } catch (error) {
      await t.rollback();
      console.error("Error completo al crear cita:", error);
      return res.status(500).json({
        mensaje: "Error interno al crear la cita",
        error: process.env.NODE_ENV === "development" ? error.message : null,
      });
    }
  }

  async createByPatient(req = request, res = response) {
    try {
      const authHeader = req.header("Authorization");
      if (!authHeader)
        throw new Error("¡Ups! Parece que no tienes una sesión activa");
      if (!authHeader.startsWith("Bearer "))
        throw new Error("Formato del token invalido");

      const token = authHeader.split(" ")[1];
      const { email } = jwt.decode(token);
      const usuario = await Usuario.findOne({ where: { email } });
      const cliente = await Cliente.findOne({
        where: { usuarioID: usuario.id },
      });

      const { duracionMaxima } = await Servicio.findByPk(req.body.servicioID, {
        attributes: ["duracionMaxima"],
      });

      const horaObj = parse(req.body.hora.toUpperCase(), "h:mm a", new Date());
      const [svcH, svcM, svcS] = duracionMaxima.split(":").map(Number);
      const horaFinObj = add(horaObj, {
        hours: svcH,
        minutes: svcM,
        seconds: svcS,
      });

      const hora = format(horaObj, "HH:mm:ss");
      const horaFin = format(horaFinObj, "HH:mm:ss");

      const cita = await Cita.create({
        ...req.body,
        pacienteID: cliente.id,
        direccion: req.body.direccion || "En barbería",
        hora,
        horaFin,
      });

      return res.status(201).json({
        mensaje: "Cita registrada correctamente",
        cita,
      });
    } catch (error) {
      return res.status(400).json({
        mensaje: error.message,
      });
    }
  }

  async update(req = request, res = response) {
    try {
      const citaExiste = await Cita.findByPk(req.params.id);
      if (!citaExiste)
        throw new Error("Ups, parece que no encontramos esta cita");

      // No obligamos pacienteID en update: se puede asignar pacienteID o datos temporales
      const datos = { ...req.body };

      // Si actualizaron hora -> recalcular horaFin si servicio cambió/esta presente
      if (datos.hora && datos.servicioID) {
        const { duracionMaxima } = await Servicio.findByPk(datos.servicioID, {
          attributes: ["duracionMaxima"],
        });

        if (duracionMaxima) {
          const horaObj = parse(datos.hora.toUpperCase(), "h:mm a", new Date());
          const [svcH, svcM, svcS] = duracionMaxima.split(":").map(Number);
          const horaFinObj = add(horaObj, {
            hours: svcH,
            minutes: svcM,
            seconds: svcS,
          });
          datos.hora = format(horaObj, "HH:mm:ss");
          datos.horaFin = format(horaFinObj, "HH:mm:ss");
        }
      }

      const citaActualizada = await citaExiste.update(datos);

      return res.json({
        mensaje: "Cita actualizada correctamente",
        citaActualizada,
      });
    } catch (error) {
      return res.status(400).json({
        mensaje: error.message,
      });
    }
  }

  async delete(req = request, res = response) {
    try {
      const id = req.params.id;
      const cita = await Cita.findByPk(id);
      if (!cita) throw new Error("Ups, parece que no encontramos esta cita");

      const citaEliminada = await cita.destroy({
        where: { id },
      });

      return res.json({
        mensaje: "Cita eliminada correctamente",
        citaEliminada,
      });
    } catch (error) {
      return res.status(400).json({
        mensaje: error.message,
      });
    }
  }

  async getAvailabilityOfBarber(req = request, res = response) {
    try {
      const { servicioID, barberoID, fecha } = req.query;
      const fechaParsed = parseISO(fecha);

      if (isSaturday(fechaParsed) || isSunday(fechaParsed)) {
        return res.json([]);
      }

      const servicio = await Servicio.findOne({
        where: { id: servicioID },
        attributes: ["duracionMaxima", "duracionRedondeada"],
      });

      if (!servicio) {
        throw new Error("Servicio no encontrado");
      }

      const citasDelBarbero = await Cita.findAll({
        where: { barberoID, fecha },
        attributes: ["hora", "horaFin"],
      });

      // Usamos la duración redondeada para calcular disponibilidad
      const [hRed, mRed] = servicio.duracionRedondeada.split(":").map(Number);
      const duracionMaxima = hRed + mRed / 60;

      const citas = citasDelBarbero.map(({ hora, horaFin }) => ({
        horaInicial: convertirHoraAFraccion(hora),
        horaFinal: convertirHoraAFraccion(horaFin),
      }));

      const horasDisponibles = calcularHorasDisponibles(
        citas,
        duracionMaxima,
        fecha
      );

      return res.json(horasDisponibles);
    } catch (error) {
      return res.status(400).json({
        mensaje: error.message,
      });
    }
  }

  async confirmDate(req = request, res = response) {
    try {
      const { id } = req.params;
      const cita = await Cita.findByPk(id);
      if (!cita) throw new Error("Ups, no encontramos esta cita");

      const serviciosPorInsumo = await ServiciosPorInsumos.findAll({
        where: { servicioID: cita.servicioID },
      });

      serviciosPorInsumo.forEach(async ({ insumoID, unidades }) => {
        const insumo = await Insumo.findByPk(insumoID);
        await insumo.decrement({ cantidad: unidades });
        if (insumo.cantidad < 0) {
          insumo.cantidad = 0;
          insumo.save();
        }
      });

      await cita.update({ estado: "Completa" });

      return res.json({
        mensaje: "Cita confirmada correctamente",
      });
    } catch (error) {
      return res.status(400).json({
        mensaje: error.message,
      });
    }
  }

  async expireDate(req = request, res = response) {
    try {
      const { id } = req.params;
      const cita = await Cita.findByPk(id);
      if (!cita) throw new Error("Ups, no encontramos esta cita");

      await cita.update({ estado: "Expirada" });

      return res.json({
        mensaje: "Cita expirada correctamente",
      });
    } catch (error) {
      return res.status(400).json({
        mensaje: error.message,
      });
    }
  }

  async cancelDate(req = request, res = response) {
    const t = await sequelize.transaction();
    try {
      const { id } = req.params;
      const cita = await Cita.findByPk(id, {
        transaction: t,
        include: [
          {
            model: Barbero,
            as: "barbero",
            include: [{ model: Usuario, as: "usuario" }],
          },
        ],
      });

      if (!cita) {
        await t.rollback();
        return res.status(404).json({ mensaje: "Cita no encontrada" });
      }

      // Verificar que la cita no esté ya completada o expirada
      if (cita.estado === "Completa" || cita.estado === "Expirada") {
        await t.rollback();
        return res.status(400).json({
          mensaje: `No se puede cancelar una cita en estado ${cita.estado}`,
        });
      }

      // Verificar si la cita ya pasó
      const ahora = new Date();
      const fechaCita = new Date(`${cita.fecha}T${cita.hora}`);

      if (fechaCita < ahora) {
        await t.rollback();
        return res.status(400).json({
          mensaje: "No se puede cancelar una cita que ya pasó",
        });
      }

      // Cambiar estado a cancelada
      await cita.update({ estado: "Cancelada" }, { transaction: t });

      // Enviar notificación de cancelación
      try {
        const io = req.app.get("io");
        const userSockets = req.app.get("userSockets");
        
        // Obtener información completa para las notificaciones
        const citaCompleta = await Cita.findByPk(id, {
          include: [
            {
              model: Servicio,
              as: "servicio",
              attributes: ["nombre"]
            },
            {
              model: Barbero,
              as: "barbero",
              include: [{
                model: Usuario,
                as: "usuario",
                attributes: ["id"]
              }],
              attributes: ["id", "nombre"]
            },
            {
              model: Cliente,
              as: "cliente",
              include: [{
                model: Usuario,
                as: "usuario",
                attributes: ["id"]
              }],
              attributes: ["id", "nombre"]
            }
          ],
          transaction: t
        });

        // Formatear fecha y hora
        const fechaFormateada = new Date(citaCompleta.fecha).toLocaleDateString("es-ES", {
          weekday: "long",
          day: "numeric",
          month: "long"
        });
        
        const horaFormateada = citaCompleta.hora.substring(0, 5);
        const nombreServicio = citaCompleta.servicio.nombre;
        const nombreCliente = citaCompleta.cliente?.nombre || citaCompleta.pacienteTemporalNombre || "un cliente";
        const nombreBarbero = citaCompleta.barbero?.nombre || "un barbero";
        
        // Notificar a todos los involucrados
        const destinatarios = [];
        
        // Notificar al barbero
        if (citaCompleta.barbero && citaCompleta.barbero.usuario) {
          destinatarios.push({
            userId: citaCompleta.barbero.usuario.id,
            tipo: "barbero"
          });
        }
        
        // Notificar al cliente (si tiene usuario)
        if (citaCompleta.cliente && citaCompleta.cliente.usuario) {
          destinatarios.push({
            userId: citaCompleta.cliente.usuario.id,
            tipo: "cliente"
          });
        }
        
        // Notificar a administradores
        const administradores = await Usuario.findAll({
          where: { 
            rol_id: 1 // ID del rol administrador
          },
          attributes: ["id"],
          transaction: t
        });
        
        administradores.forEach(admin => {
          destinatarios.push({
            userId: admin.id,
            tipo: "administrador"
          });
        });

        // Enviar notificaciones a cada destinatario
        for (const destinatario of destinatarios) {
          let titulo, cuerpo;
          
          switch (destinatario.tipo) {
            case "barbero":
              titulo = "❌ Cita cancelada";
              cuerpo = `La cita con ${nombreCliente} para ${nombreServicio} el ${fechaFormateada} a las ${horaFormateada} ha sido cancelada`;
              break;
              
            case "cliente":
              titulo = "❌ Cita cancelada";
              cuerpo = `Tu cita para ${nombreServicio} con ${nombreBarbero} del ${fechaFormateada} a las ${horaFormateada} ha sido cancelada`;
              break;
              
            case "administrador":
              titulo = "❌ Cita cancelada";
              cuerpo = `La cita de ${nombreCliente} con ${nombreBarbero} del ${fechaFormateada} ha sido cancelada`;
              break;
          }

          // Crear notificación en base de datos
          const notificacion = await Notificacion.create({
            usuarioID: destinatario.userId,
            titulo,
            cuerpo,
            tipo: "cita_cancelada",
            relacionId: citaCompleta.id,
            leido: false
          }, { transaction: t });

          // Enviar notificación por Socket.io
          if (userSockets && userSockets.has(destinatario.userId)) {
            io.to(`user_${destinatario.userId}`).emit("nueva_notificacion", {
              ...notificacion.toJSON(),
              sound: true,
              vibrate: true
            });
            console.log(`📤 Notificación de cancelación enviada por socket a usuario ${destinatario.userId}`);
          }
        }

        console.log(`✅ Notificaciones de cancelación enviadas a ${destinatarios.length} destinatarios`);

      } catch (notifError) {
        console.error("❌ Error en el sistema de notificaciones de cancelación:", notifError);
      }

      await t.commit();

      return res.json({
        mensaje:
          "Cita cancelada correctamente. El horario ahora está disponible.",
        cita,
      });
    } catch (error) {
      await t.rollback();
      console.error("Error en cancelDate:", error);
      return res.status(500).json({
        mensaje: "Error interno al cancelar la cita",
        error: process.env.NODE_ENV === "development" ? error.message : null,
      });
    }
  }

  async markAllAsRead(req = request, res = response) {
    try {
      const { userId } = req.params;
      if (!userId) {
        return res.status(400).json({ msg: "Se requiere el ID de usuario" });
      }

      await Notificacion.update(
        { leido: true },
        { where: { usuarioID: userId, leido: false } }
      );

      return res.json({ msg: "Todas las notificaciones marcadas como leídas" });
    } catch (error) {
      console.error("Error marcando notificaciones como leídas:", error);
      res.status(500).json({ msg: "Error en el servidor" });
    }
  }

  async getPatientDates(req = request, res = response) {
    try {
      const authHeader = req.header("Authorization");
      if (!authHeader)
        throw new Error("¡Ups! Parece que no tienes una sesión activa");
      if (!authHeader.startsWith("Bearer "))
        throw new Error("Formato del token invalido");

      const token = authHeader.split(" ")[1];
      const { email } = jwt.decode(token);
      const usuario = await Usuario.findOne({ where: { email } });
      const cliente = await Cliente.findOne({
        where: { usuarioID: usuario.id },
      });

      const citas = await Cita.findAll({
        where: { pacienteID: cliente.id },
        include: [
          {
            model: Cliente,
            as: "cliente",
            include: [
              {
                model: Usuario,
                as: "usuario",
              },
            ],
          },
          {
            model: Barbero,
            as: "barbero",
          },
          {
            model: Servicio,
            as: "servicio",
          },
        ],
        order: [
          [
            literal(
              "estado='Expirada', estado='Cancelada', estado='Completa', estado='Pendiente'"
            ),
          ],
          ["fecha", "ASC"],
          ["hora", "ASC"],
        ],
      });

      return res.json({
        citas,
      });
    } catch (error) {
      return res.status(400).json({
        mensaje: error.message,
      });
    }
  }

  async getDiary(req = request, res = response) {
    try {
      const { fecha } = req.query;
      if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        return res.status(400).json({
          error: "Formato de fecha inválido. Use YYYY-MM-DD",
        });
      }

      const barberosBase = await Barbero.findAll({
        attributes: ["id", "nombre", "avatar"],
        order: [["nombre", "ASC"]],
      });

      const barberoMap = {};
      barberosBase.forEach((b) => {
        barberoMap[b.id] = {
          id: b.id,
          name: b.nombre,
          avatar: b.avatar,
          schedule: [],
        };
      });

      const citasDia = await Cita.findAll({
        where: { fecha },
        include: [
          {
            model: Barbero,
            as: "barbero",
            attributes: ["id", "nombre", "avatar"],
          },
          {
            model: Servicio,
            as: "servicio",
            attributes: ["id", "nombre", "duracionMaxima", "precio"],
          },
          {
            model: Cliente,
            as: "cliente",
            attributes: ["id", "nombre", "telefono"],
            include: [{ model: Usuario, as: "usuario", attributes: ["email"] }],
          },
        ],
      });

      const toDecimal = (hms) => {
        const [h, m] = hms.split(":").map(Number);
        return h + m / 60;
      };

      citasDia.forEach((cita) => {
        const barberoID = cita.barbero?.id;
        if (!barberoID) return;

        const start = toDecimal(cita.hora);
        const duracionRaw = cita.servicio?.duracionMaxima || "01:00:00";
        const [dh, dm] = duracionRaw.split(":").map(Number);
        const end = start + dh + dm / 60;

        barberoMap[barberoID].schedule.push({
          id: cita.id,
          start,
          end,
          servicio: {
            id: cita.servicio?.id || null,
            nombre: cita.servicio?.nombre || "",
            duracion: duracionRaw,
            precio: cita.servicio?.precio || 0,
          },
          cliente: {
            id: cita.cliente?.id || null,
            nombre: cita.cliente?.nombre || cita.pacienteTemporalNombre || "",
            telefono:
              cita.cliente?.telefono || cita.pacienteTemporalTelefono || "",
            email: cita.cliente?.usuario?.email || "",
          },
          estado: cita.estado,
        });
      });

      return res.status(200).json(Object.values(barberoMap));
    } catch (error) {
      console.error("Error en getDiary:", error);
      return res.status(500).json({
        error: "Error al obtener el diario de citas",
        detalle:
          process.env.NODE_ENV === "development"
            ? { message: error.message, stack: error.stack }
            : null,
      });
    }
  }

  async getAvailableServices(req, res) {
    let { fecha, hora, barberoID } = req.query;
    hora = Number(hora);

    if (!fecha || !hora || !barberoID) {
      return res
        .status(400)
        .json({ error: "fecha, hora y barberoID son requeridos" });
    }

    const hourDecimal = parseFloat(hora);
    const startHour =
      Math.floor(hourDecimal) >= 10
        ? Math.floor(hourDecimal)
        : "0" + Math.floor(hourDecimal);
    const startMinutes = (hourDecimal % 1) * 60;
    const startTime = `${startHour}:${
      startMinutes === 0 ? "00" : startMinutes
    }:00`;

    try {
      const citas = await Cita.findAll({
        where: {
          fecha,
          barberoID,
        },
        include: [
          {
            model: Servicio,
            as: "servicio",
          },
        ],
      });

      const barbero = await Barbero.findByPk(barberoID);
      const serviciosNoFiltrados = await Servicio.findAll();

      if (citas.length === 0) {
        const servicios = serviciosNoFiltrados.filter(({ duracionMaxima }) => {
          const duracion = convertirHoraAFraccion(duracionMaxima);
          const posibleHoraFinal = hora + duracion;
          return posibleHoraFinal <= 17;
        });

        return res.json({ servicios, barbero });
      }

      const servicios = serviciosNoFiltrados.filter(({ duracionMaxima }) => {
        const duracion = convertirHoraAFraccion(duracionMaxima);
        const posibleHoraFinal = hora + duracion;

        const noExisteConflicto = citas.every(
          ({ hora: horaInicio, horaFin }) => {
            const horaEnFraccion = convertirHoraAFraccion(horaInicio);
            const horaFinEnFraccion = convertirHoraAFraccion(horaFin);

            return (
              (posibleHoraFinal <= horaEnFraccion ||
                hora >= horaFinEnFraccion) &&
              posibleHoraFinal <= 17
            );
          }
        );

        return noExisteConflicto;
      });

      return res.status(200).json({ servicios, barbero });
    } catch (error) {
      console.log({ error });
      return res.status(400).json({
        mensaje: error.message,
      });
    }
  }
}

// Función para redondear la duración a intervalos de 30 minutos
function redondearDuracion(duracionStr) {
  const [h, m] = duracionStr.split(":").map(Number);
  const totalMinutos = h * 60 + m;

  if (totalMinutos <= 30) return 30;
  if (totalMinutos <= 60) return 60;
  if (totalMinutos <= 90) return 90;
  return Math.ceil(totalMinutos / 30) * 30;
}

function convertirDuracionAHoras(duracion) {
  const [horas, minutos, segundos] = duracion.split(":").map(Number);
  return horas + minutos / 60 + segundos / 3600;
}

function convertirHoraAFraccion(hora) {
  const [horas, minutos] = hora.split(":").map(Number);
  return horas + minutos / 60;
}

function convertirHora24a12(hora24) {
  const [hora, minutos] = hora24.split(":").map(Number);
  const period = hora >= 12 ? "PM" : "AM";
  const hora12 = hora % 12 || 12;
  return `${hora12}:${minutos.toString().padStart(2, "0")} ${period}`;
}

function calcularHorasDisponibles(citas, duracionMaxima, fecha) {
  const horasDisponibles = [];
  const HORA_INICIAL = 8;
  let horaActual = HORA_INICIAL;
  const HORA_FINAL = 17;
  const TIEMPO_IMPREVISTOS = 1;
  const isProduction = process.env.ENVIRONMENT === "PROD";
  const esHoy = isToday(parseISO(fecha));

  if (esHoy) {
    horaActual = new Date().getHours() + TIEMPO_IMPREVISTOS * 2;
    if (isProduction) {
      horaActual += 5;
    }
  }

  while (horaActual < HORA_FINAL) {
    const horaFormateada = Number.isInteger(horaActual)
      ? convertirHora24a12(`${horaActual}:00`)
      : convertirHora24a12(
          `${Math.floor(horaActual)}:${(horaActual % 1) * 60}`
        );

    const tieneCita = citas.some(({ horaInicial, horaFinal }) => {
      return (
        (horaActual >= horaInicial - TIEMPO_IMPREVISTOS &&
          horaActual < horaFinal + TIEMPO_IMPREVISTOS) ||
        (horaActual + duracionMaxima > horaInicial - TIEMPO_IMPREVISTOS &&
          horaActual + duracionMaxima <= horaFinal + TIEMPO_IMPREVISTOS) ||
        (horaActual <= horaInicial - TIEMPO_IMPREVISTOS &&
          horaActual + duracionMaxima >= horaFinal + TIEMPO_IMPREVISTOS)
      );
    });

    if (!tieneCita && horaActual + duracionMaxima <= HORA_FINAL) {
      horasDisponibles.push(horaFormateada);
    }

    horaActual += 0.5;
  }

  return horasDisponibles;
}

export const citasController = new CitasController();