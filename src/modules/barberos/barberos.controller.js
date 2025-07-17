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

import { customAlphabet } from "nanoid";

/* ╔════════════════════════════════════════════════════════╗
   ║                     CONTROLADOR                        ║
   ╚════════════════════════════════════════════════════════╝ */
class BarberosController {
  /* ─────── LISTAR (paginado y búsqueda) ─────── */
  async get(req = request, res = response) {
    try {
      /* filtros.obtenerFiltros entrega offset / limit por página    */
      const { offset, limit: defaultLimit, where } = filtros.obtenerFiltros({
        busqueda: req.query.search,
        modelo: Barbero,
        pagina:   req.query.page,
        camposBusqueda: ["nombre", "cedula", "telefono"],
      });

      /* Si viene &limit=… en query, sobrescribe                     */
      const limit = req.query.limit ? Number(req.query.limit) : defaultLimit;

      const barberos = await Barbero.findAll({
        offset,
        limit,             // ← nuevo
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
      });

      const total = await Barbero.count({ where });
      return res.json({ barberos, total });
    } catch (err) {
      console.error("BarberosController.get →", err);
      return res.status(500).json({
        mensaje: "Error interno del servidor al obtener barberos",
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

      await sendEmail({
        to: email,
        subject: "Confirmación de identidad",
        html: correos.envioCredenciales({
          codigo,
          email,
          password: plainPassword,
        }),
      });

      return res.status(201).json({
        mensaje: "Barbero registrado correctamente",
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
