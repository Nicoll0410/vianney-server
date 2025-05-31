import { response, request } from "express"
import { Usuario } from "../usuarios/usuarios.model.js"
import { passwordUtils } from "../../utils/password.util.js"
import { jwt } from "../../utils/jwt.util.js"
import { CodigosVerificacion } from "../usuarios/codigos_verificacion.model.js"
import { customAlphabet, nanoid } from "nanoid"
import { sendEmail } from "../../utils/send-email.util.js"
import { CodigosRecuperarVerificacion } from "../usuarios/codigos_recuperar_password.model.js"
import { correos } from "../../utils/correos.util.js"
import { where } from "sequelize"
import { Rol } from "../roles/roles.model.js"
import { Barbero } from "../barberos/barberos.model.js"
import { RolesPorPermisos } from "../roles/roles_por_permisos.js"
import { Permiso } from "../roles/permisos.model.js"
import { Cliente } from "../clientes/clientes.model.js"


class AuthController {
    async login(req = request, res = response) {
        try {
            const { email, password } = req.body;

            const usuario = await Usuario.findOne({ where: { email } });

            if (!usuario) {
                return res.status(200).json({ success: false, reason: "USER_NOT_FOUND" });
            }

            const esValido = passwordUtils.isValidPassword(password, usuario.password);
            if (!esValido) {
                return res.status(200).json({ success: false, reason: "INVALID_PASSWORD" });
            }

            if (!usuario.estaVerificado) {
                return res.status(200).json({ success: false, reason: "NOT_VERIFIED" });
            }

            if (usuario.rol === "Paciente") {
                return res.status(200).json({ success: false, reason: "UNAUTHORIZED_ROLE" });
            }

            const token = jwt.createToken(usuario.email);
            return res.status(200).json({ success: true, token });

        } catch (error) {
            console.error("Login error:", error);
            return res.status(500).json({ success: false, reason: "SERVER_ERROR" });
        }
    }

    async loginClient(req = request, res = response) {
        try {
            const usuario = await Usuario.findOne({ where: { email: req.body.email } })
            if (!usuario) throw new Error("¡Ups! No encontramos ningún usuario con estas credenciales")

            const esPasswordCorrecta = await passwordUtils.isValidPassword(req.body.password, usuario.getDataValue("password"))
            if (!esPasswordCorrecta) throw new Error("¡Ups! No encontramos ningún usuario con estas credenciales")

            if (!usuario.estaVerificado) throw new Error("Ups! Parece que no has confirmado tu cuenta. Revisa tu bandeja de entrada o spam")

            const rol = await Rol.findOne({ where: { id: usuario.rolID } })

            if (rol.nombre !== "Paciente") throw new Error("Ups, no tienes permiso para acceder")

            const cliente = await Cliente.findOne({ where: { usuarioID: usuario.id } })

            const token = jwt.createToken(usuario.email)

            return res.json({ mensaje: "Usuario logeado exitosamente", token, cliente, usuario })
        } catch (error) {
            return res.status(400).json({
                mensaje: error.message
            })
        }
    }

    async loginMobile(req = request, res = response) {
        try {
            const usuario = await Usuario.findOne({ where: { email: req.body.email } })
            if (!usuario) throw new Error("¡Ups! No encontramos ningún usuario con estas credenciales")

            const esPasswordCorrecta = await passwordUtils.isValidPassword(req.body.password, usuario.getDataValue("password"))
            if (!esPasswordCorrecta) throw new Error("¡Ups! No encontramos ningún usuario con estas credenciales")

            if (!usuario.estaVerificado) throw new Error("Ups! Parece que no has confirmado tu cuenta. Revisa tu bandeja de entrada o spam")

            const rol = await Rol.findOne({ where: { id: usuario.rolID } })
            const permisoProveedor = await Permiso.findOne({ where: { nombre: "Proveedores" } })
            const tienePermisoProveedor = await RolesPorPermisos.findOne({ where: { rolID: rol.id, permisoID: permisoProveedor.id } })

            if (!tienePermisoProveedor) throw new Error("Ups! Parece que no tienes acceso al módulo de proveedores")

            const barbero = await Barbero.findOne({ where: { usuarioID: usuario.id } })
            const token = jwt.createToken(usuario.email)

            return res.json({ mensaje: "Usuario logeado exitosamente", token, usuario, barbero })
        } catch (error) {
            console.log({ error });

            return res.status(400).json({
                mensaje: error.message
            })
        }
    }

    async signUp(req = request, res = response) {
        try {
            const { email, password: plainPassword } = req.body

            const usuarioExiste = await Usuario.findOne({ where: { email } })
            if (usuarioExiste) throw new Error("Este email está en uso")

            const rolPaciente = await Rol.findOne({ where: { nombre: "Paciente" } })

            const password = await passwordUtils.encrypt(plainPassword)
            const usuarioCreado = await Usuario.create({ email, password, rolID: rolPaciente.id })

            await Cliente.create({ ...req.body, usuarioID: usuarioCreado.id })


            const codigo = (customAlphabet("0123456789", 6))()
            await CodigosVerificacion.create({ usuarioID: usuarioCreado.id, codigo })

            await sendEmail({ to: email, subject: "Confirmación de identidad", html: correos.confirmarIdentidad({ codigo, email }) })



            return res.json({ mensaje: "Usuario creado exitosamente. Revisa tu bandeja de entrada o spam" })
        } catch (error) {
            return res.status(400).json({
                mensaje: error.message
            })
        }
    }


    async verifyAccount(req = request, res = response) {
        try {
            const { email, codigo } = req.body
            const usuario = await Usuario.findOne({ where: { email } })

            if (!usuario) throw new Error("No pudimos encontrar este correo")
            if (usuario.estaVerificado) throw new Error("Esta cuenta ya ha sido verificada")

            const codigoVerificacion = await CodigosVerificacion.findOne({ where: { usuarioID: usuario.id } })
            if (codigo !== codigoVerificacion.codigo) throw new Error("Código incorrecto")

            await usuario.update({ estaVerificado: true })

            await codigoVerificacion.destroy({ where: { id: codigoVerificacion.id } })

            const cliente = await Cliente.findOne({ where: { usuarioID: usuario.id } })

            const token = jwt.createToken(usuario.email)
            return res.json({ mensaje: "Cuenta verificada correctamente", token, usuario, cliente })
        } catch (error) {
            return res.status(400).json({
                mensaje: error.message
            })

        }
    }

    async verifyToken(req = request, res = response) {
        try {
            const authHeader = req.header("Authorization")
            if (!authHeader.startsWith('Bearer ')) throw new Error('Formato de token inválido')
            const token = authHeader.split(' ')[1];

            const esTokenValido = jwt.isTokenValid(token)
            if (!esTokenValido) throw new Error("Token no válido")

            return res.json({ mensaje: "Token válido" })
        } catch (error) {
            return res.status(400).json({
                mensaje: error.message
            })

        }
    }

    async recoverPassword(req = request, res = response) {
        try {
            const { email } = req.body
            const usuario = await Usuario.findOne({ where: { email } })
            if (!usuario) throw new Error("No pudimos encontrar este correo")

            await CodigosRecuperarVerificacion.destroy({ where: { usuarioID: usuario.id } })
            const codigo = (customAlphabet("0123456789", 6))()
            await CodigosRecuperarVerificacion.create({ usuarioID: usuario.id, codigo })
            await sendEmail({ to: email, subject: "Recupera tu contraseña", html: correos.recuperarPassword({ codigo, email }) })

            return res.json({ mensaje: "Hemos enviado un código a tu bandeja de entrada" })
        } catch (error) {
            return res.status(400).json({
                mensaje: error.message
            })

        }
    }

    async routesPermission(req = request, res = response) {
        try {
            const authHeader = req.header("Authorization")
            if (!authHeader.startsWith('Bearer ')) throw new Error('Formato de token inválido')
            const token = authHeader.split(' ')[1];

            const { email } = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

            const { rolID } = await Usuario.findOne({ where: { email } })
            const permisos = await RolesPorPermisos.findAll({
                where: { rolID },
                include: {
                    model: Permiso,
                    attributes: ['nombre', 'descripcion', 'ruta', 'orden'],
                    order: [['orden', 'ASC']] // Ordenar por el campo 'orden'
                },
                order: [[Permiso, 'orden', 'ASC']], // Asegurarse de que la ordenación se aplique correctamente
            });

            return res.json({ permisos })
        } catch (error) {
            return res.status(400).json({
                mensaje: error.message
            })

        }
    }

    async verifyRecoverPassword(req = request, res = response) {
        try {
            const { email, codigo, password } = req.body
            const usuario = await Usuario.findOne({ where: { email } })
            if (!usuario) throw new Error("No pudimos encontrar este correo")

            const codigoRecuperacion = await CodigosRecuperarVerificacion.findOne({ where: { usuarioID: usuario.id } })
            if (!codigoRecuperacion) throw new Error("Esta cuenta no ha intentado recuperar la contraseña")

            if (codigo !== codigoRecuperacion.codigo) throw new Error("Código incorrecto")

            const newPassword = await passwordUtils.encrypt(password)
            await usuario.update({ password: newPassword })

            await codigoRecuperacion.destroy({ where: { id: codigoRecuperacion.id } })
            const token = jwt.createToken(usuario.email)

            return res.json({ mensaje: "Tu contraseña ha sido actualizada", token })
        } catch (error) {
            return res.status(400).json({
                mensaje: error.message
            })

        }
    }


}

export const authController = new AuthController()