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
      raw: false
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

    const clientesProcesados = clientes.map(cliente => {
      const clienteData = cliente.get({ plain: true });
      
      // ✅ CORREGIR FECHA: Ajustar la fecha para compensar zona horaria
      let fechaNacimientoCorregida = clienteData.fecha_nacimiento;
      if (fechaNacimientoCorregida) {
        try {
          const fecha = new Date(fechaNacimientoCorregida);
          // Añadir un día para compensar la conversión de zona horaria
          fecha.setDate(fecha.getDate() + 1);
          fechaNacimientoCorregida = fecha.toISOString().split('T')[0];
        } catch (error) {
          console.error('Error al procesar fecha:', error);
        }
      }

      let avatar = clienteData.avatar;
      if (avatar && (typeof avatar !== 'string' || avatar.includes('undefined'))) {
        avatar = null;
      }
      
      return {
        ...clienteData,
        fecha_nacimiento: fechaNacimientoCorregida, // ✅ Usar fecha corregida
        avatar: avatar || null,
        estaVerificado: clienteData.usuario?.estaVerificado || false,
        email: clienteData.usuario?.email || ''
      };
    });

    return res.json({ clientes: clientesProcesados, total });
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

    const clienteData = cliente.get({ plain: true });
    
    // ✅ CORREGIR FECHA: Ajustar la fecha para compensar zona horaria
    let fechaNacimientoCorregida = clienteData.fecha_nacimiento;
    if (fechaNacimientoCorregida) {
      try {
        const fecha = new Date(fechaNacimientoCorregida);
        fecha.setDate(fecha.getDate() + 1);
        fechaNacimientoCorregida = fecha.toISOString().split('T')[0];
      } catch (error) {
        console.error('Error al procesar fecha:', error);
      }
    }

    return res.json({ 
      cliente: {
        ...clienteData,
        fecha_nacimiento: fechaNacimientoCorregida // ✅ Usar fecha corregida
      } 
    });
  } catch (error) {
    return res.status(400).json({ mensaje: error.message });
  }
}


/* ─────────────────────── CREAR ──────────────────────── */
async create(req = request, res = response) {
  try {
    const { email, password: plainPassword, avatarBase64, fecha_nacimiento } = req.body;

    // Validar fecha de nacimiento
    if (!fecha_nacimiento) {
      return res.status(400).json({ mensaje: "La fecha de nacimiento es obligatoria" });
    }

    // ✅ NUEVO: Formatear fecha para evitar problemas de zona horaria
    let fechaNacimientoFormateada;
    try {
      const fecha = new Date(fecha_nacimiento);
      // Ajustar por zona horaria: añadir el offset para obtener la fecha correcta
      fecha.setMinutes(fecha.getMinutes() + fecha.getTimezoneOffset());
      fechaNacimientoFormateada = fecha.toISOString().split('T')[0];
    } catch (error) {
      return res.status(400).json({ mensaje: "Formato de fecha inválido" });
    }

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

    // Crear cliente con el avatar (limpio si existe) y fecha formateada
    const avatarClean = avatarBase64 ? avatarBase64.trim() : null;
    const cliente = await Cliente.create({
      ...req.body,
      fecha_nacimiento: fechaNacimientoFormateada, // ✅ Usar fecha formateada
      usuarioID: usuario.id,
      avatar: avatarClean
    });

    // Obtener el cliente recién creado
    const clienteCreado = await Cliente.findByPk(cliente.id, {
      attributes: ['id', 'nombre', 'telefono', 'avatar', 'usuarioID', 'fecha_nacimiento'],
      include: {
        model: Usuario,
        attributes: ["id", "email", "estaVerificado"],
      }
    });

    const clienteCreadoData = clienteCreado.get({ plain: true });
    
    // ✅ NUEVO: Corregir fecha para la respuesta (compensar zona horaria)
    let fechaNacimientoCorregida = clienteCreadoData.fecha_nacimiento;
    if (fechaNacimientoCorregida) {
      try {
        const fecha = new Date(fechaNacimientoCorregida);
        fecha.setDate(fecha.getDate() + 1);
        fechaNacimientoCorregida = fecha.toISOString().split('T')[0];
      } catch (error) {
        console.error('Error al procesar fecha:', error);
      }
    }

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
        ...clienteCreadoData,
        fecha_nacimiento: fechaNacimientoCorregida // ✅ Fecha corregida para respuesta
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

    // ✅ NUEVO: Manejo de la fecha de nacimiento
    const { avatarBase64, fecha_nacimiento, ...rest } = req.body;
    let fechaNacimientoFormateada = cliente.fecha_nacimiento;

    if (fecha_nacimiento) {
      try {
        const fecha = new Date(fecha_nacimiento);
        fecha.setMinutes(fecha.getMinutes() + fecha.getTimezoneOffset());
        fechaNacimientoFormateada = fecha.toISOString().split('T')[0];
      } catch (error) {
        return res.status(400).json({ mensaje: "Formato de fecha inválido" });
      }
    }

    // Manejo del avatar - procesar avatarBase64 si existe
    let avatarActualizado = cliente.avatar;

    if (avatarBase64 && typeof avatarBase64 === 'string') {
      const cleanAvatar = avatarBase64.trim();
     
      // Validar que sea una imagen base64 válida
      if (cleanAvatar.startsWith('data:image/')) {
        avatarActualizado = cleanAvatar;
      } else {
        return res.status(400).json({
          mensaje: "Formato de avatar inválido. Debe ser una imagen en base64",
        });
      }
    }

    // Actualizar cliente incluyendo el avatar y fecha formateada
    await cliente.update({
      ...rest,
      fecha_nacimiento: fechaNacimientoFormateada, // ✅ Usar fecha formateada
      avatar: avatarActualizado
    });
   
    // Actualizar email si se proporcionó
    if (req.body.email && cliente.usuario) {
      await cliente.usuario.update({ email: req.body.email });
    }

    // Obtener el cliente actualizado con todas las relaciones
    const clienteActualizado = await Cliente.findByPk(cliente.id, {
      attributes: ['id', 'nombre', 'telefono', 'avatar', 'usuarioID', 'fecha_nacimiento'],
      include: {
        model: Usuario,
        attributes: ["id", "email", "estaVerificado"],
      }
    });

    const clienteActualizadoData = clienteActualizado.get({ plain: true });
    
    // ✅ NUEVO: Corregir fecha para la respuesta (compensar zona horaria)
    let fechaNacimientoCorregida = clienteActualizadoData.fecha_nacimiento;
    if (fechaNacimientoCorregida) {
      try {
        const fecha = new Date(fechaNacimientoCorregida);
        fecha.setDate(fecha.getDate() + 1);
        fechaNacimientoCorregida = fecha.toISOString().split('T')[0];
      } catch (error) {
        console.error('Error al procesar fecha:', error);
      }
    }

    return res.json({
      mensaje: "Cliente actualizado correctamente",
      cliente: {
        ...clienteActualizadoData,
        fecha_nacimiento: fechaNacimientoCorregida // ✅ Fecha corregida para respuesta
      }
    });
  } catch (error) {
    console.error('Error al actualizar cliente:', error);
    return res.status(400).json({ 
      mensaje: "Error interno del servidor",
      error: error.message 
    });
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