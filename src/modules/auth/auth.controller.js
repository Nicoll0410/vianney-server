import { request, response } from "express";
import { Usuario } from "../usuarios/usuarios.model.js";
import { passwordUtils } from "../../utils/password.util.js";
import { jwt } from "../../utils/jwt.util.js";
import { CodigosVerificacion } from "../usuarios/codigos_verificacion.model.js";
import { customAlphabet } from "nanoid";
import { sendEmail } from "../../utils/send-email.util.js";
import { CodigosRecuperarVerificacion } from "../usuarios/codigos_recuperar_password.model.js";
import { correos } from "../../utils/correos.util.js";
import { Rol } from "../roles/roles.model.js";
import { Barbero } from "../barberos/barberos.model.js";
import { RolesPorPermisos } from "../roles/roles_por_permisos.js";
import { Permiso } from "../roles/permisos.model.js";
import { Cliente } from "../clientes/clientes.model.js";

class AuthController {
  async login(req = request, res = response) {
    try {
      const { email, password } = req.body;
      const usuario = await Usuario.findOne({ where: { email } });

      if (!usuario)
        return res.status(200).json({ success: false, reason: "USER_NOT_FOUND" });

      const esValido = await passwordUtils.isValidPassword(password, usuario.password);
      if (!esValido)
        return res.status(200).json({ success: false, reason: "INVALID_PASSWORD" });

      if (!usuario.estaVerificado)
        return res.status(200).json({ success: false, reason: "NOT_VERIFIED" });

      const rol = await Rol.findOne({ where: { id: usuario.rolID } });
      if (rol?.nombre === "Cliente")
        return res.status(200).json({ success: false, reason: "UNAUTHORIZED_ROLE" });

      const token = jwt.createToken({
        email: usuario.email,
        rol: { id: rol.id, nombre: rol.nombre },
        verificado: usuario.estaVerificado,
      });

      return res.status(200).json({ success: true, token });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).json({ success: false, reason: "SERVER_ERROR" });
    }
  }

  async loginClient(req = request, res = response) {
    try {
      const usuario = await Usuario.findOne({ where: { email: req.body.email } });
      if (!usuario)
        throw new Error("¡Ups! No encontramos ningún usuario con estas credenciales");

      const esPasswordCorrecta = await passwordUtils.isValidPassword(
        req.body.password,
        usuario.getDataValue("password")
      );
      if (!esPasswordCorrecta)
        throw new Error("¡Ups! No encontramos ningún usuario con estas credenciales");

      if (!usuario.estaVerificado)
        throw new Error("Ups! Parece que no has confirmado tu cuenta. Revisa tu bandeja de entrada o spam");

      const rol = await Rol.findOne({ where: { id: usuario.rolID } });
      if (rol.nombre !== "Cliente")
        throw new Error("Ups, no tienes permiso para acceder");

      const cliente = await Cliente.findOne({ where: { usuarioID: usuario.id } });

      const token = jwt.createToken({
        email: usuario.email,
        rol: { id: rol.id, nombre: rol.nombre },
        verificado: true,
      });

      return res.json({ mensaje: "Usuario logeado exitosamente", token, cliente, usuario });
    } catch (error) {
      return res.status(400).json({ mensaje: error.message });
    }
  }

  async loginMobile(req = request, res = response) {
    try {
      const usuario = await Usuario.findOne({ where: { email: req.body.email } });
      if (!usuario)
        throw new Error("¡Ups! No encontramos ningún usuario con estas credenciales");

      const esPasswordCorrecta = await passwordUtils.isValidPassword(
        req.body.password,
        usuario.getDataValue("password")
      );
      if (!esPasswordCorrecta)
        throw new Error("¡Ups! No encontramos ningún usuario con estas credenciales");

      if (!usuario.estaVerificado)
        throw new Error("Ups! Parece que no has confirmado tu cuenta. Revisa tu bandeja de entrada o spam");

      const rol = await Rol.findOne({ where: { id: usuario.rolID } });

      const permisoProveedor = await Permiso.findOne({ where: { nombre: "Proveedores" } });
      const tienePermisoProveedor = await RolesPorPermisos.findOne({
        where: { rolID: rol.id, permisoID: permisoProveedor.id },
      });
      if (!tienePermisoProveedor)
        throw new Error("Ups! Parece que no tienes acceso al módulo de proveedores");

      const barbero = await Barbero.findOne({ where: { usuarioID: usuario.id } });

      const token = jwt.createToken({
        email: usuario.email,
        rol: { id: rol.id, nombre: rol.nombre },
        verificado: true,
      });

      return res.json({ mensaje: "Usuario logeado exitosamente", token, usuario, barbero });
    } catch (error) {
      console.log({ error });
      return res.status(400).json({ mensaje: error.message });
    }
  }

  async signUp(req = request, res = response) {
    try {
      const { email, password: plainPassword, nombre, telefono, fecha_nacimiento } = req.body;

      if (!nombre || !telefono || !fecha_nacimiento) {
        return res.status(400).json({ 
          success: false, 
          mensaje: "Nombre, teléfono y fecha de nacimiento son requeridos" 
        });
      }

      const usuarioExiste = await Usuario.findOne({ where: { email } });
      if (usuarioExiste) {
        return res.status(400).json({ 
          success: false, 
          mensaje: "Este email está en uso" 
        });
      }

      const rolCliente = await Rol.findOne({ where: { nombre: "Cliente" } });
      if (!rolCliente) {
        return res.status(500).json({ 
          success: false, 
          mensaje: "Error de configuración: Rol 'Cliente' no existe" 
        });
      }

      const password = await passwordUtils.encrypt(plainPassword);
      const usuarioCreado = await Usuario.create({
        email,
        password,
        rolID: rolCliente.id,
        estaVerificado: false // Asegurar que no esté verificado
      });

      await Cliente.create({ 
        nombre,
        telefono,
        fecha_nacimiento,
        usuarioID: usuarioCreado.id 
      });

      const codigo = customAlphabet("0123456789", 6)();
      await CodigosVerificacion.create({ usuarioID: usuarioCreado.id, codigo });

      // Generar link de verificación para el correo
      const verificationLink = `${process.env.FRONTEND_URL}/verify-email?email=${encodeURIComponent(email)}&code=${codigo}`;

      await sendEmail({
        to: email,
        subject: "Verifica tu cuenta en VIANNEY THE BARBER",
        html: correos.confirmarIdentidad({ 
          codigo, 
          email,
          verificationLink // Pasamos el link al template
        }),
      });

      return res.status(201).json({
        success: true,
        mensaje: "Registro exitoso. Por favor verifica tu correo electrónico.",
        data: { email }
      });

    } catch (error) {
      console.error("Error en signUp:", error);
      return res.status(400).json({ 
        success: false,
        mensaje: error.message || "Error al registrar usuario" 
      });
    }
  }

  async verifyFromEmail(req = request, res = response) {
  try {
    const { email, code } = req.query;

    if (!email || !code) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=Parametros invalidos`);
    }

    const usuario = await Usuario.findOne({ where: { email } });
    if (!usuario) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=Usuario no encontrado`);
    }

    if (usuario.estaVerificado) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?message=La cuenta ya está verificada`);
    }

    const registroCodigo = await CodigosVerificacion.findOne({
      where: { usuarioID: usuario.id, codigo: code },
    });

    if (!registroCodigo) {
      return res.redirect(`${process.env.FRONTEND_URL}/verify-email?email=${encodeURIComponent(email)}&error=Codigo invalido`);
    }

    // Verificar si el código ha expirado (24 horas)
    const ahora = new Date();
    const creadoEl = registroCodigo.createdAt;
    const diferenciaHoras = (ahora - creadoEl) / (1000 * 60 * 60);
    
    if (diferenciaHoras > 24) {
      await registroCodigo.destroy();
      return res.redirect(`${process.env.FRONTEND_URL}/verify-email?email=${encodeURIComponent(email)}&error=Codigo expirado`);
    }

    // Verificar la cuenta
    await usuario.update({ estaVerificado: true });
    await registroCodigo.destroy();

    // Redirigir a la pantalla de verificación con parámetros de éxito
    return res.redirect(`${process.env.FRONTEND_URL}/verify-email?email=${encodeURIComponent(email)}&success=true&verified=true`);

  } catch (error) {
    console.error("Error en verifyFromEmail:", error);
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=Error en verificacion`);
  }
}


async resendVerificationCode(req = request, res = response) {
  try {
    const { email } = req.body;
    console.log("📧 Reenviando código a:", email);
    
    const usuario = await Usuario.findOne({ where: { email } });
    
    if (!usuario) {
      return res.status(400).json({ success: false, mensaje: "Usuario no encontrado" });
    }
    
    if (usuario.estaVerificado) {
      return res.status(400).json({ success: false, mensaje: "La cuenta ya está verificada" });
    }
    
    // Elimina códigos anteriores
    await CodigosVerificacion.destroy({ where: { usuarioID: usuario.id } });
    
    // Crea nuevo código
    const codigo = customAlphabet("0123456789", 6)();
    await CodigosVerificacion.create({ usuarioID: usuario.id, codigo });
    
    // Generar link de verificación
    const verificationLink = `${process.env.FRONTEND_URL}/verify-email?email=${encodeURIComponent(email)}&code=${codigo}`;
    
    // Envía el email con manejo de errores
    const emailResult = await sendEmail({
      to: email,
      subject: "Confirmación de identidad - NY Barber",
      html: correos.confirmarIdentidad({ 
        codigo, 
        email,
        verificationLink 
      }),
    });
    
    if (!emailResult.success) {
      console.error("Error enviando email:", emailResult.error);
      return res.status(500).json({ 
        success: false,
        mensaje: "Error al enviar el email. Por favor intenta nuevamente." 
      });
    }
    
    return res.json({ 
      success: true,
      mensaje: "Se ha enviado un nuevo código de verificación" 
    });
  } catch (error) {
    console.error("Error en resendVerificationCode:", error);
    return res.status(500).json({ 
      success: false,
      mensaje: "Error al reenviar el código de verificación" 
    });
  }
}

async getUserInfo(req = request, res = response) {
  try {
    console.log("Obteniendo información del usuario, user:", req.user);
    
    // Verificar que req.user existe y tiene id
    if (!req.user || !req.user.id) {
      return res.status(400).json({ 
        success: false, 
        message: "Usuario no autenticado correctamente" 
      });
    }

    const userId = req.user.id;
    
    const usuario = await Usuario.findByPk(userId, {
      attributes: { exclude: ['password'] },
      include: [{
        model: Rol,
        as: "rol",
        attributes: ["id", "nombre"]
      }]
    });

    if (!usuario) {
      return res.status(404).json({ 
        success: false, 
        message: "Usuario no encontrado" 
      });
    }

    return res.json({ 
      success: true, 
      user: usuario 
    });
  } catch (error) {
    console.error("Error en getUserInfo:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Error interno del servidor",
      error: process.env.NODE_ENV === "development" ? error.message : null
    });
  }
}

// Modificar el método verifyAccount existente
async verifyAccount(req = request, res = response) {
  try {
    const { email, codigo } = req.body;

    const usuario = await Usuario.findOne({ where: { email } });
    if (!usuario) {
      return res.status(400).json({ 
        success: false, 
        mensaje: "Correo no encontrado" 
      });
    }
    
    if (usuario.estaVerificado) {
      return res.status(400).json({ 
        success: false, 
        mensaje: "Esta cuenta ya fue verificada" 
      });
    }

    const registroCodigo = await CodigosVerificacion.findOne({
      where: { usuarioID: usuario.id, codigo },
    });
    
    if (!registroCodigo) {
      return res.status(400).json({ 
        success: false, 
        mensaje: "Código incorrecto" 
      });
    }

    // Verificar expiración (24 horas)
    const ahora = new Date();
    const creadoEl = registroCodigo.createdAt;
    const diferenciaHoras = (ahora - creadoEl) / (1000 * 60 * 60);
    
    if (diferenciaHoras > 24) {
      await registroCodigo.destroy();
      return res.status(400).json({ 
        success: false, 
        mensaje: "Código expirado. Por favor solicita uno nuevo." 
      });
    }

    await usuario.update({ estaVerificado: true });
    await registroCodigo.destroy();

    return res.json({
      success: true,
      mensaje: "Cuenta verificada correctamente",
    });

  } catch (error) {
    console.error("Error verifyAccount:", error);
    return res.status(500).json({ 
      success: false,
      mensaje: error.message || "Error al verificar la cuenta" 
    });
  }
}


  async verifyToken(req = request, res = response) {
    try {
      const authHeader = req.header("Authorization");
      if (!authHeader?.startsWith("Bearer "))
        throw new Error("Formato de token inválido");

      const token = authHeader.split(" ")[1];
      const esTokenValido = jwt.isTokenValid(token);
      if (!esTokenValido) throw new Error("Token no válido");

      return res.json({ mensaje: "Token válido" });
    } catch (error) {
      return res.status(400).json({ mensaje: error.message });
    }
  }

  async recoverPassword(req = request, res = response) {
    try {
      const { email } = req.body;
      const usuario = await Usuario.findOne({ where: { email } });
      if (!usuario) throw new Error("No pudimos encontrar este correo");

      await CodigosRecuperarVerificacion.destroy({ where: { usuarioID: usuario.id } });

      const codigo = customAlphabet("0123456789", 6)();
      await CodigosRecuperarVerificacion.create({ usuarioID: usuario.id, codigo });

      await sendEmail({
        to: email,
        subject: "Recupera tu contraseña",
        html: correos.recuperarPassword({ codigo, email }),
      });

      return res.json({ mensaje: "Hemos enviado un código a tu bandeja de entrada" });
    } catch (error) {
      return res.status(400).json({ mensaje: error.message });
    }
  }

  async routesPermission(req = request, res = response) {
    try {
      const authHeader = req.header("Authorization");
      if (!authHeader?.startsWith("Bearer "))
        throw new Error("Formato de token inválido");

      const token = authHeader.split(" ")[1];
      const { email } = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
      const { rolID } = await Usuario.findOne({ where: { email } });

      const permisos = await RolesPorPermisos.findAll({
        where: { rolID },
        include: {
          model: Permiso,
          attributes: ["nombre", "descripcion", "ruta", "orden"],
        },
        order: [[Permiso, "orden", "ASC"]],
      });

      return res.json({ permisos });
    } catch (error) {
      return res.status(400).json({ mensaje: error.message });
    }
  }

  async verifyRecoverPassword(req = request, res = response) {
    try {
      const { email, codigo, password } = req.body;

      const usuario = await Usuario.findOne({ where: { email } });
      if (!usuario) throw new Error("No pudimos encontrar este correo");

      const codigoRecuperacion = await CodigosRecuperarVerificacion.findOne({
        where: { usuarioID: usuario.id },
      });
      if (!codigoRecuperacion)
        throw new Error("Esta cuenta no ha intentado recuperar la contraseña");

      if (codigo !== codigoRecuperacion.codigo)
        throw new Error("Código incorrecto");

      const newPassword = await passwordUtils.encrypt(password);
      await usuario.update({ password: newPassword });
      await codigoRecuperacion.destroy();

      const token = jwt.createToken(usuario.email);

      return res.json({ mensaje: "Tu contraseña ha sido actualizada", token });
    } catch (error) {
      return res.status(400).json({ mensaje: error.message });
    }
  }
}

export const authController = new AuthController();
