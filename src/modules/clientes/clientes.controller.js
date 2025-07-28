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

      const all = req.query.all === 'true';

      let queryOptions = {
        where,
        order,
        attributes: ['id', 'nombre', 'telefono', 'avatar', 'usuarioID', 'fecha_nacimiento'],
        include: {
          model: Usuario,
          attributes: ["id", "email", "estaVerificado"],
        },
      };

      let clientes;
      let total;

      if (all) {
        clientes = await Cliente.findAll(queryOptions);
        total = clientes.length;
      } else {
        queryOptions = { ...queryOptions, offset, limit };
        clientes = await Cliente.findAll(queryOptions);
        total = await Cliente.count({ where });
      }

      // Depuración: Verificar avatares
      console.log('Clientes obtenidos:', clientes.map(c => ({
        id: c.id,
        nombre: c.nombre,
        tieneAvatar: !!c.avatar,
        avatarLength: c.avatar?.length || 0
      })));

      return res.json({ clientes, total });
    } catch (error) {
      console.error('Error al listar clientes:', error);
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
      const { email, password: plainPassword, avatarBase64 } = req.body;

      // Validación extendida del avatar
      if (avatarBase64) {
        if (typeof avatarBase64 !== 'string') {
          return res.status(400).json({ mensaje: "Formato de avatar inválido" });
        }

        const cleanAvatar = avatarBase64.trim();
        
        if (!cleanAvatar.startsWith('data:image/')) {
          return res.status(400).json({ 
            mensaje: "El avatar debe ser una imagen en formato base64",
            formato_recibido: cleanAvatar.substring(0, 50) + '...'
          });
        }

        if (cleanAvatar.length > 8 * 1024 * 1024) {
          return res.status(400).json({ mensaje: "El avatar es demasiado grande (máximo 8MB)" });
        }
      }

      // Validar email duplicado
      const usuarioYaExiste = await Usuario.findOne({ where: { email } });
      if (usuarioYaExiste) {
        return res.status(400).json({ mensaje: "Este email ya se encuentra registrado" });
      }

      // Obtener rol Cliente
      const clienteRol = await Rol.findOne({ where: { nombre: "Cliente" } });
      if (!clienteRol) {
        return res.status(400).json({ mensaje: "No se encontró el rol de Cliente" });
      }

      // Crear usuario
      const password = await passwordUtils.encrypt(plainPassword);
      const usuario = await Usuario.create({
        ...req.body,
        password,
        rolID: clienteRol.id,
      });

      // Generar código de verificación
      const codigo = customAlphabet("0123456789", 6)();
      await CodigosVerificacion.create({ usuarioID: usuario.id, codigo });

      // Crear cliente con el avatar (limpio si existe)
      const avatarClean = avatarBase64 ? avatarBase64.trim() : null;
      const cliente = await Cliente.create({
        ...req.body,
        usuarioID: usuario.id,
        avatar: avatarClean
      });

      // Verificar que se guardó correctamente
      const clienteCreado = await Cliente.findByPk(cliente.id, {
        attributes: ['id', 'nombre', 'avatar']
      });

      console.log('Cliente creado en BD:', {
        id: clienteCreado.id,
        nombre: clienteCreado.nombre,
        tieneAvatar: !!clienteCreado.avatar,
        avatarLength: clienteCreado.avatar?.length || 0
      });

      // Enviar email de verificación
      const verificationLink = `${FRONTEND_URL}/verify-email?email=${encodeURIComponent(email)}&code=${codigo}`;
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
        mensaje: "Cliente registrado correctamente",
        cliente: {
          ...cliente.toJSON(),
          avatar: clienteCreado.avatar, // Forzar envío del avatar
          usuario: {
            email: usuario.email,
            estaVerificado: usuario.estaVerificado
          }
        }
      });
    } catch (error) {
      console.error('Error al crear cliente:', error);
      return res.status(500).json({ 
        mensaje: "Error interno del servidor",
        detalle: error.message 
      });
    }
  }

  /* ─────────────────────── ACTUALIZAR ─────────────────── */
  async update(req = request, res = response) {
    try {
      const cliente = await Cliente.findByPk(req.params.id, {
        include: { model: Usuario },
      });
      
      if (!cliente) {
        return res.status(404).json({ mensaje: "Cliente no encontrado" });
      }

      // Manejo del avatar
      const { avatarBase64, ...rest } = req.body;

      if (avatarBase64) {
        if (typeof avatarBase64 !== 'string') {
          return res.status(400).json({ mensaje: "Formato de avatar inválido" });
        }

        const cleanAvatar = avatarBase64.trim();
        
        if (!cleanAvatar.startsWith('data:image/')) {
          return res.status(400).json({ 
            mensaje: "El avatar debe ser una imagen en formato base64",
            formato_recibido: cleanAvatar.substring(0, 50) + '...'
          });
        }

        if (cleanAvatar.length > 8 * 1024 * 1024) {
          return res.status(400).json({ mensaje: "El avatar es demasiado grande (máximo 8MB)" });
        }

        rest.avatar = cleanAvatar;
      }

      const clienteActualizado = await cliente.update(rest);
      
      if (req.body.email && cliente.usuario) {
        await cliente.usuario.update({ email: req.body.email });
      }

      // Verificar actualización
      const clienteActualizadoConAvatar = await Cliente.findByPk(cliente.id, {
        attributes: ['id', 'nombre', 'avatar']
      });

      console.log('Cliente actualizado:', {
        id: clienteActualizadoConAvatar.id,
        tieneAvatar: !!clienteActualizadoConAvatar.avatar,
        avatarLength: clienteActualizadoConAvatar.avatar?.length || 0
      });

      return res.json({
        mensaje: "Cliente actualizado correctamente",
        cliente: {
          ...clienteActualizado.toJSON(),
          avatar: clienteActualizadoConAvatar.avatar,
          usuario: cliente.usuario,
        },
      });
    } catch (error) {
      console.error('Error al actualizar cliente:', error);
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
