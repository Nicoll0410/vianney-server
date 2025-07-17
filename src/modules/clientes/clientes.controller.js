import { response, request } from "express";
import { Cliente } from "./clientes.model.js";
import { filtros } from "../../utils/filtros.util.js";
import { Usuario } from "../usuarios/usuarios.model.js";
import { passwordUtils } from "../../utils/password.util.js";
import { customAlphabet } from "nanoid";
import { CodigosVerificacion } from "../usuarios/codigos_verificacion.model.js";
import { sendEmail } from "../../utils/send-email.util.js";
import { correos } from "../../utils/correos.util.js";
import { Rol } from "../roles/roles.model.js";
import { Cita } from "../citas/citas.model.js";
import { sequelize } from "../../database.js";

const FRONTEND_URL =
  process.env.FRONTEND_URL?.replace(/\/$/, "") || "http://localhost:19006";

class ClientesController {
  /* ─────────────────────── LISTAR ─────────────────────── */
  async get(req = request, res = response) {
    try {
      const { offset, limit, where, order } = filtros.obtenerFiltros({
        busqueda: req.query.search,
        modelo: Cliente,
        pagina: req.query.page,
      });

      const clientes = await Cliente.findAll({
        offset,
        limit,
        where,
        order,
        include: {
          model: Usuario,
          attributes: ["id", "email", "estaVerificado"],
        },
      });

      const total = await Cliente.count({ where });
      return res.json({ clientes, total });
    } catch (error) {
      return res.status(400).json({ mensaje: error.message });
    }
  }

  /* ─────────────────────── DETALLE ────────────────────── */
  async getById(req = request, res = response) {
    try {
      const cliente = await Cliente.findByPk(req.params.id, {
        include: {
          model: Usuario,
          attributes: ["id", "email", "estaVerificado"],
        },
      });

      if (!cliente) {
        return res.status(404).json({ mensaje: "Cliente no encontrado" });
      }

      return res.json({ cliente });
    } catch (error) {
      return res.status(400).json({ mensaje: error.message });
    }
  }

  /* ─────────────────────── CREAR ──────────────────────── */
  async create(req = request, res = response) {
    try {
      const { email, password: plainPassword } = req.body;

      /* ─── Validar duplicado ─── */
      const usuarioYaExiste = await Usuario.findOne({ where: { email } });
      if (usuarioYaExiste)
        throw new Error("Este email ya se encuentra registrado");

      /* ─── Buscar rol Cliente ─── */
      const clienteRol =
        (await Rol.findOne({ where: { nombre: "Cliente" } })) ??
        (await Rol.findOne({ where: { nombre: "Paciente" } })); // fallback
      if (!clienteRol) throw new Error("No se encontró el rol de Cliente");

      /* ─── Crear usuario + cliente ─── */
      const password = await passwordUtils.encrypt(plainPassword);
      const usuario = await Usuario.create({
        ...req.body,
        password,
        rolID: clienteRol.id,
      });

      const codigo = customAlphabet("0123456789", 6)();
      await CodigosVerificacion.create({ usuarioID: usuario.id, codigo });

      const cliente = await Cliente.create({
        ...req.body,
        usuarioID: usuario.id,
      });

      /* ─── Enviar email de verificación ─── */
      const verificationLink = `${FRONTEND_URL}/verify-email?email=${encodeURIComponent(
        email
      )}&code=${codigo}`;

      await sendEmail({
        to: email,
        subject: "Verifica tu cuenta de cliente",
        html: correos.envioCredenciales({
          codigo,
          email,
          password: plainPassword,
          verificationLink,
        }),
      });

      return res.status(201).json({
        mensaje: "Cliente registrado. Se envió un email de verificación.",
        cliente: {
          ...cliente.toJSON(),
          usuario: { email: usuario.email, estaVerificado: usuario.estaVerificado },
        },
      });
    } catch (error) {
      console.error({ error });
      return res.status(400).json({ mensaje: error.message });
    }
  }

  /* ─────────────────────── ACTUALIZAR ─────────────────── */
  async update(req = request, res = response) {
    try {
      const cliente = await Cliente.findByPk(req.params.id, {
        include: { model: Usuario },
      });
      if (!cliente) throw new Error("Cliente no encontrado");

      const clienteActualizado = await cliente.update(req.body);
      if (req.body.email && cliente.usuario) {
        await cliente.usuario.update({ email: req.body.email });
      }

      return res.json({
        mensaje: "Cliente actualizado correctamente",
        cliente: {
          ...clienteActualizado.toJSON(),
          usuario: cliente.usuario,
        },
      });
    } catch (error) {
      return res.status(400).json({ mensaje: error.message });
    }
  }

  /* ────────────────── ACTUALIZAR POR EMAIL ────────────── */
  async updateByEmail(req = request, res = response) {
    try {
      const usuario = await Usuario.findOne({
        where: { email: req.body.email },
        include: { model: Cliente },
      });
      if (!usuario) throw new Error("Usuario no encontrado");
      if (!usuario.cliente) throw new Error("Cliente no encontrado para este usuario");

      const clienteActualizado = await usuario.cliente.update(req.body);

      return res.json({
        mensaje: "Cliente actualizado correctamente",
        cliente: clienteActualizado,
        usuario: {
          id: usuario.id,
          email: usuario.email,
          estaVerificado: usuario.estaVerificado,
        },
      });
    } catch (error) {
      return res.status(400).json({ mensaje: error.message });
    }
  }

  /* ─────────────────────── ELIMINAR ───────────────────── */
  async delete(req = request, res = response) {
    const t = await sequelize.transaction();
    try {
      const cliente = await Cliente.findByPk(req.params.id, {
        include: { model: Usuario },
        transaction: t,
      });
      if (!cliente) {
        await t.rollback();
        return res.status(404).json({ mensaje: "Cliente no encontrado" });
      }

      const citasRelacionadas = await Cita.count({
        where: { pacienteID: cliente.id },
        transaction: t,
      });
      if (citasRelacionadas > 0) {
        await t.rollback();
        return res.status(400).json({
          mensaje:
            "No se puede eliminar este cliente porque tiene citas relacionadas",
        });
      }

      const usuarioID = cliente.usuarioID;
      await cliente.destroy({ transaction: t });
      if (usuarioID)
        await Usuario.destroy({ where: { id: usuarioID }, transaction: t });

      await t.commit();
      return res.json({
        mensaje: "Cliente y usuario eliminados correctamente",
      });
    } catch (error) {
      await t.rollback();
      return res.status(400).json({ mensaje: error.message });
    }
  }

  /* ──────────────── REENVIAR VERIFICACIÓN ─────────────── */
  async reenviarVerificacion(req = request, res = response) {
    try {
      const cliente = await Cliente.findByPk(req.params.id, {
        include: { model: Usuario },
      });
      if (!cliente) throw new Error("Cliente no encontrado");
      if (!cliente.usuario) throw new Error("Usuario asociado no encontrado");
      if (cliente.usuario.estaVerificado)
        throw new Error("Este cliente ya está verificado");

      const codigo = customAlphabet("0123456789", 6)();
      await CodigosVerificacion.create({ usuarioID: cliente.usuario.id, codigo });

      const verificationLink = `${FRONTEND_URL}/verify-email?email=${encodeURIComponent(
        cliente.usuario.email
      )}&code=${codigo}`;

      await sendEmail({
        to: cliente.usuario.email,
        subject: "Confirmación de identidad - Reenvío",
        html: correos.envioCredenciales({
          codigo,
          email: cliente.usuario.email,
          password: "La contraseña que ingresó al registrarse",
          verificationLink,
        }),
      });

      return res.json({
        mensaje: "Correo de verificación reenviado correctamente",
      });
    } catch (error) {
      return res.status(400).json({ mensaje: error.message });
    }
  }
}

export const clientesController = new ClientesController();
