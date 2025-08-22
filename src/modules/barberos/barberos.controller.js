/* ────────────────────────────────────────────────────────────
   src/modules/barberos/barberos.controller.js
   Controlador completo y funcional  – CEDULA ahora se devuelve
   explícitamente en los GET para que el frontend la muestre.
   ──────────────────────────────────────────────────────────── */
import { request, response } from "express";
import { Op } from "sequelize";

import { Barbero } from "./barberos.model.js";
import { Usuario } from "../usuarios/usuarios.model.js";
import { Rol } from "../roles/roles.model.js";
import { Cita } from "../citas/citas.model.js";
import { CodigosVerificacion } from "../usuarios/codigos_verificacion.model.js";

import { filtros } from "../../utils/filtros.util.js";
import { passwordUtils } from "../../utils/password.util.js";
import { sendEmail } from "../../utils/send-email.util.js";
import { correos } from "../../utils/correos.util.js";
import { HorarioBarbero } from "./horarioBarbero.model.js";
import { customAlphabet } from "nanoid";

/* ╔════════════════════════════════════════════════════════╗
   ║                     CONTROLADOR                        ║
   ╚════════════════════════════════════════════════════════╝ */
class BarberosController {
    /* ─────── LISTAR (paginado y búsqueda) ─────── */
    async get(req = request, res = response) {
        try {
            const { offset, limit: defaultLimit, where } = filtros.obtenerFiltros({
                busqueda: req.query.search,
                modelo: Barbero,
                pagina: req.query.page,
                camposBusqueda: ["nombre", "cedula", "telefono"],
            });

            // Verificar si se solicita todos los registros sin paginación
            const all = req.query.all === 'true';

            let queryOptions = {
                where,
                attributes: [
                    "id",
                    "nombre",
                    "cedula",
                    "telefono",
                    "fecha_nacimiento",
                    "fecha_de_contratacion",
                    "avatar",
                    "usuarioID",
                    "createdAt",
                    "updatedAt",
                ],
                include: [
                    {
                        model: Usuario,
                        attributes: ["id", "email", "estaVerificado"],
                        include: [
                            {
                                model: Rol,
                                as: "rol",
                                attributes: ["id", "nombre", "avatar"],
                            },
                        ],
                    },
                ],
                order: [["createdAt", "DESC"]],
            };

            let barberos;
            let total;

            if (all) {
                // Obtener todos los barberos sin paginación
                barberos = await Barbero.findAll(queryOptions);
                total = barberos.length;
            } else {
                // Aplicar paginación normal
                const limit = req.query.limit ? Number(req.query.limit) : defaultLimit;
                barberos = await Barbero.findAll({
                    ...queryOptions,
                    offset,
                    limit,
                });
                total = await Barbero.count({ where });
            }

            return res.json({ barberos, total });
        } catch (err) {
            console.error("BarberosController.get →", err);
            return res.status(500).json({
                mensaje: "Error interno del servidor al obtener barberos",
                error: err.message,
            });
        }
    }

    async getUsuarioByBarberoId(req = request, res = response) {
    try {
        const { id } = req.params;
        
        const barbero = await Barbero.findByPk(id, {
            include: [{
                model: Usuario,
                attributes: ["id", "email", "estaVerificado"]
            }]
        });

        if (!barbero) {
            return res.status(404).json({ 
                success: false, 
                message: "Barbero no encontrado" 
            });
        }

        if (!barbero.usuario) {
            return res.status(404).json({ 
                success: false, 
                message: "Usuario no encontrado para este barbero" 
            });
        }

        return res.json({ 
            success: true, 
            usuarioID: barbero.usuario.id 
        });
    } catch (err) {
        console.error("BarberosController.getUsuarioByBarberoId →", err);
        return res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: err.message,
        });
    }
}

/* ─────── REENVIAR EMAIL DE VERIFICACIÓN ─────── */
async reenviarEmailVerificacion(req = request, res = response) {
    try {
        const { id } = req.params;
        
        // Buscar el barbero por ID
        const barbero = await Barbero.findByPk(id, {
            include: [{
                model: Usuario,
                attributes: ["id", "email", "estaVerificado"]
            }]
        });

        if (!barbero) {
            return res.status(404).json({ mensaje: 'Barbero no encontrado' });
        }

        if (!barbero.usuario) {
            return res.status(404).json({ mensaje: 'Usuario asociado no encontrado' });
        }

        if (barbero.usuario.estaVerificado) {
            return res.status(400).json({ mensaje: 'El barbero ya está verificado' });
        }

        // Generar nuevo código de verificación
        const codigo = customAlphabet("0123456789", 6)();
        
        // Eliminar códigos anteriores y crear uno nuevo
        await CodigosVerificacion.destroy({
            where: { usuarioID: barbero.usuario.id }
        });
        
        await CodigosVerificacion.create({
            usuarioID: barbero.usuario.id,
            codigo,
            expiracion: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 horas
        });

        // Generar link de verificación
        const verificationLink = `${process.env.FRONTEND_URL}/verify-email?email=${encodeURIComponent(barbero.usuario.email)}&code=${codigo}`;

        // Enviar email
        await sendEmail({
            to: barbero.usuario.email,
            subject: "Reenvío de verificación - NY Barber",
            html: correos.envioCredenciales({
                codigo,
                email: barbero.usuario.email,
                password: "******", // No enviamos la contraseña en reenvíos
                verificationLink,
                tipoUsuario: "barbero"
            }),
        });

        return res.json({ 
            mensaje: 'Email de verificación reenviado correctamente' 
        });

    } catch (err) {
        console.error("BarberosController.reenviarEmailVerificacion →", err);
        return res.status(500).json({
            mensaje: 'Error interno del servidor al reenviar email',
            error: err.message,
        });
    }
}

    /* ─────── OBTENER HORARIO BARBERO ─────── */
// Método getHorario (sin cambios necesarios)
async getHorario(req, res) {
    try {
        const horario = await HorarioBarbero.findOne({
            where: { barberoId: req.params.id }
        });

        if (!horario) {
            return res.json({
                horario: {
                    diasLaborales: {
                        lunes: { activo: false, horas: [] },
                        martes: { activo: false, horas: [] },
                        miercoles: { activo: false, horas: [] },
                        jueves: { activo: false, horas: [] },
                        viernes: { activo: false, horas: [] },
                        sabado: { activo: false, horas: [] },
                        domingo: { activo: false, horas: [] }
                    },
                    horarioAlmuerzo: {
                        inicio: '13:00',
                        fin: '14:00',
                        activo: true
                    },
                    excepciones: []
                }
            });
        }

        let horarioAlmuerzo = typeof horario.horarioAlmuerzo === 'string' ?
            JSON.parse(horario.horarioAlmuerzo) :
            horario.horarioAlmuerzo;

        if (!horarioAlmuerzo.inicio || !horarioAlmuerzo.fin) {
            horarioAlmuerzo = { inicio: '13:00', fin: '14:00', activo: true };
        }

        return res.json({
            horario: {
                id: horario.id,
                barberoId: horario.barberoId,
                diasLaborales: typeof horario.diasLaborales === 'string' ?
                    JSON.parse(horario.diasLaborales) : horario.diasLaborales,
                horarioAlmuerzo,
                excepciones: typeof horario.excepciones === 'string' ?
                    JSON.parse(horario.excepciones) : horario.excepciones || [],
                createdAt: horario.createdAt,
                updatedAt: horario.updatedAt
            }
        });
    } catch (err) {
        console.error("BarberosController.getHorario →", err);
        return res.status(500).json({
            mensaje: "Error al obtener horario",
            error: err.message,
        });
    }
}

// En barberos.controller.js - Método updateHorario modificado
async updateHorario(req, res) {
    try {
        const { diasLaborales, horarioAlmuerzo, excepciones } = req.body;

        // Validación y normalización del horario de almuerzo
        const validatedAlmuerzo = {
            inicio: horarioAlmuerzo?.inicio || '13:00',
            fin: horarioAlmuerzo?.fin || '14:00',
            activo: horarioAlmuerzo?.activo !== false
        };

        // Validar que la hora de fin sea posterior a la de inicio
        const [inicioH, inicioM] = validatedAlmuerzo.inicio.split(':').map(Number);
        const [finH, finM] = validatedAlmuerzo.fin.split(':').map(Number);

        const inicioTotal = inicioH * 60 + inicioM;
        const finTotal = finH * 60 + finM;

        if (finTotal <= inicioTotal) {
            return res.status(400).json({
                mensaje: "La hora de fin debe ser posterior a la hora de inicio"
            });
        }

        // Validar que el almuerzo sea mínimo 30 minutos
        if ((finTotal - inicioTotal) < 30) {
            return res.status(400).json({
                mensaje: "El horario de almuerzo debe ser de al menos 30 minutos"
            });
        }

        // Validar días laborales
        const diasValidos = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
        const diasLaboralesValidados = {};
        
        diasValidos.forEach(dia => {
            diasLaboralesValidados[dia] = {
                activo: diasLaborales[dia]?.activo || false,
                horas: Array.isArray(diasLaborales[dia]?.horas) ? 
                    diasLaborales[dia].horas.filter(h => typeof h === 'string') : []
            };
        });

        // Validar excepciones
        const excepcionesValidadas = Array.isArray(excepciones) ? 
            excepciones.filter(ex => ex.fecha && typeof ex.activo === 'boolean') : [];

        // Actualizar el horario y devolver el barbero completo con sus relaciones
        // Actualizar el horario con cache deshabilitado
        const [horario, created] = await HorarioBarbero.upsert({
            barberoId: req.params.id,
            diasLaborales: diasLaboralesValidados,
            horarioAlmuerzo: validatedAlmuerzo,
            excepciones: excepcionesValidadas
        }, {
            returning: true,
            // Asegurar que no hay caché
            individualHooks: true,
            hooks: true
        });

        // Obtener el barbero actualizado sin caché
        const barberoActualizado = await Barbero.findByPk(req.params.id, {
            include: [
                {
                    model: Usuario,
                    attributes: ["id", "email", "estaVerificado"],
                    include: [
                        {
                            model: Rol,
                            as: "rol",
                            attributes: ["id", "nombre", "avatar"],
                        },
                    ],
                },
                {
                    model: HorarioBarbero
                }
            ],
            // Deshabilitar caché
            logging: console.log, // Para depuración
            benchmark: true,     // Para depuración
            plain: true,
            raw: false
        });

        // Headers para evitar caché en el cliente
        res.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.header('Pragma', 'no-cache');
        res.header('Expires', '0');

        return res.json({
            mensaje: "Horario actualizado correctamente",
            barbero: barberoActualizado,
            horario: {
                id: horario.id,
                barberoId: horario.barberoId,
                diasLaborales: typeof horario.diasLaborales === 'string' ?
                    JSON.parse(horario.diasLaborales) : horario.diasLaborales,
                horarioAlmuerzo: validatedAlmuerzo,
                excepciones: typeof horario.excepciones === 'string' ?
                    JSON.parse(horario.excepciones) : horario.excepciones || [],
                createdAt: horario.createdAt,
                updatedAt: horario.updatedAt
            }
        });
    } catch (err) {
        console.error("BarberosController.updateHorario →", err);
        return res.status(500).json({
            mensaje: "Error al actualizar horario",
            error: err.message,
        });
    }
}

// Método addExcepcion (sin cambios necesarios)
async addExcepcion(req, res) {
    try {
        const { fecha, motivo, activo } = req.body;

        if (!fecha || typeof activo === 'undefined') {
            return res.status(400).json({ mensaje: "Datos incompletos" });
        }

        const horario = await HorarioBarbero.findOne({
            where: { barberoId: req.params.id }
        });

        if (!horario) {
            return res.status(404).json({ mensaje: "Horario no encontrado" });
        }

        const excepciones = horario.excepciones || [];
        excepciones.push({ fecha, motivo, activo });

        await horario.update({ excepciones });

        return res.json({
            mensaje: "Excepción añadida correctamente",
            horario
        });
    } catch (err) {
        console.error("BarberosController.addExcepcion →", err);
        return res.status(500).json({
            mensaje: "Error al añadir excepción",
            error: err.message,
        });
    }
}
    /* ─────── OBTENER POR ID ─────── */
    async getById(req = request, res = response) {
        try {
            /* 👇  Igual: devolvemos cedula explícitamente                */
            const barbero = await Barbero.findByPk(req.params.id, {
                attributes: [
                    "id",
                    "nombre",
                    "cedula",
                    "telefono",
                    "fecha_nacimiento",
                    "fecha_de_contratacion",
                    "avatar",
                    "usuarioID",
                    "createdAt",
                    "updatedAt",
                ],
                include: [
                    {
                        model: Usuario,
                        attributes: ["id", "email", "estaVerificado"],
                        include: [
                            { model: Rol, as: "rol", attributes: ["id", "nombre", "avatar"] },
                        ],
                    },
                ],
            });

            if (!barbero)
                return res.status(404).json({ mensaje: "Barbero no encontrado" });

            return res.json({ barbero });
        } catch (err) {
            console.error("BarberosController.getById →", err);
            return res.status(500).json({
                mensaje: "Error interno del servidor al obtener barbero",
                error: err.message,
            });
        }
    }

    /* ─────── CREAR ─────── */
    async create(req = request, res = response) {
        try {
            const {
                nombre,
                cedula,
                telefono,
                fecha_nacimiento,
                fecha_de_contratacion,
                email,
                password: plainPassword,
                rolID,
                avatar,
            } = req.body;

            /* Validación mínima */
            if (
                !nombre ||
                !cedula ||
                !telefono ||
                !fecha_nacimiento ||
                !fecha_de_contratacion ||
                !email ||
                !plainPassword
            ) {
                return res
                    .status(400)
                    .json({ mensaje: "Todos los campos obligatorios deben estar completos" });
            }

            /* ¿Email duplicado? */
            const emailDuplicado = await Usuario.findOne({ where: { email } });
            if (emailDuplicado)
                return res
                    .status(400)
                    .json({ mensaje: "Este email ya se encuentra registrado" });

            /* Crear usuario */
            const password = await passwordUtils.encrypt(plainPassword);
            const usuario = await Usuario.create({
                email,
                password,
                rolID: rolID || 2, // 2 = BARBERO por defecto
            });

            /* Crear barbero */
            const barbero = await Barbero.create({
                nombre,
                cedula,
                telefono,
                fecha_nacimiento,
                fecha_de_contratacion,
                avatar: avatar || null,
                usuarioID: usuario.id,
            });

            /* Código + correo verificación */
            const codigo = customAlphabet("0123456789", 6)();
            await CodigosVerificacion.create({ usuarioID: usuario.id, codigo });

            // Generar link de verificación
            const verificationLink = `${process.env.FRONTEND_URL}/verify-email?email=${encodeURIComponent(email)}&code=${codigo}`;

            await sendEmail({
                to: email,
                subject: "Confirmación de identidad - NY Barber",
                html: correos.envioCredenciales({
                    codigo,
                    email,
                    password: plainPassword,
                    verificationLink, // Incluir el link en el correo
                    tipoUsuario: "barbero" // Para personalizar el mensaje
                }),
            });

            return res.status(201).json({
                mensaje: "Barbero registrado correctamente. Se ha enviado un email de verificación.",
                barbero: {
                    ...barbero.toJSON(),
                    usuario: {
                        email: usuario.email,
                        estaVerificado: usuario.estaVerificado,
                        rol: await usuario.getRol(),
                    },
                },
            });
        } catch (err) {
            console.error("BarberosController.create →", err);
            return res.status(500).json({
                mensaje: "Error interno del servidor al crear barbero",
                error: err.message,
            });
        }
    }
    /* ─────── ACTUALIZAR ─────── */
    async update(req = request, res = response) {
        try {
            const barbero = await Barbero.findByPk(req.params.id);
            if (!barbero)
                return res.status(404).json({ mensaje: "Barbero no encontrado" });

            const usuario = await Usuario.findByPk(barbero.usuarioID, {
                include: [{ model: Rol, as: "rol" }],
            });
            if (!usuario)
                return res
                    .status(404)
                    .json({ mensaje: "Usuario asociado no encontrado" });

            /* rolID (opcional) */
            if (req.body.rolID) {
                const rolCheck = await Rol.findByPk(req.body.rolID);
                if (!rolCheck)
                    return res.status(400).json({ mensaje: "El rol especificado no existe" });
                await usuario.update({ rolID: req.body.rolID });
            }

            /* email (opcional) */
            if (req.body.email && req.body.email !== usuario.email) {
                const repetido = await Usuario.findOne({
                    where: { email: req.body.email, id: { [Op.ne]: usuario.id } },
                });
                if (repetido)
                    return res
                        .status(400)
                        .json({ mensaje: "El nuevo email ya está en uso" });
                await usuario.update({ email: req.body.email });
            }

            /* Datos barbero */
            await barbero.update({
                nombre: req.body.nombre ?? barbero.nombre,
                cedula: req.body.cedula ?? barbero.cedula,
                telefono: req.body.telefono ?? barbero.telefono,
                fecha_nacimiento:
                    req.body.fecha_nacimiento ?? barbero.fecha_nacimiento,
                fecha_de_contratacion:
                    req.body.fecha_de_contratacion ?? barbero.fecha_de_contratacion,
                avatar: req.body.avatar ?? barbero.avatar,
            });

            return res.json({
                mensaje: "Barbero actualizado correctamente",
                barbero: {
                    ...barbero.toJSON(),
                    usuario: {
                        email: usuario.email,
                        estaVerificado: usuario.estaVerificado,
                        rol: await usuario.getRol(),
                    },
                },
            });
        } catch (err) {
            console.error("BarberosController.update →", err);
            return res.status(500).json({
                mensaje: "Error interno del servidor al actualizar barbero",
                error: err.message,
            });
        }
    }

    /* ─────── ELIMINAR ─────── */
    async delete(req = request, res = response) {
        try {
            const barbero = await Barbero.findByPk(req.params.id);
            if (!barbero)
                return res.status(404).json({ mensaje: "Barbero no encontrado" });

            const tieneCitas = await Cita.count({
                where: { barberoID: barbero.id },
            });
            if (tieneCitas > 0)
                return res.status(400).json({
                    mensaje:
                        "No se puede eliminar el barbero porque tiene citas asociadas",
                });

            await Usuario.destroy({ where: { id: barbero.usuarioID } });
            await barbero.destroy();

            return res.json({ mensaje: "Barbero eliminado correctamente" });
        } catch (err) {
            console.error("BarberosController.delete →", err);
            return res.status(500).json({
                mensaje: "Error interno del servidor al eliminar barbero",
                error: err.message,
            });
        }
    }
}

export const barberosController = new BarberosController();
