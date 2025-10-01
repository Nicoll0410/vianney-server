import { response, request } from "express"
import { Usuario } from "./usuarios.model.js"
import { passwordUtils } from "../../utils/password.util.js"
import { Op } from "sequelize";
import { filtros } from "../../utils/filtros.util.js";
import { correos } from "../../utils/correos.util.js";
import { customAlphabet } from "nanoid";
import { CodigosVerificacion } from "./codigos_verificacion.model.js";
import { CodigosRecuperarVerificacion } from "./codigos_recuperar_password.model.js"
import { sendEmail } from "../../utils/send-email.util.js";
import { Cliente } from "../clientes/clientes.model.js";
import { Barbero } from "../barberos/barberos.model.js";
import jwt from "jsonwebtoken"
import { Rol } from "../roles/roles.model.js";

class UsuarioController {
    async get(req = request, res = response) {
        try {
            const { offset, where } = filtros.obtenerFiltros({ busqueda: req.query.search, modelo: Usuario, pagina: req.query.page })

            const usuarios = await Usuario.findAll({ offset, limit: 5, where, order: [['createdAt', 'DESC']], include: { model: Rol, attributes: ["nombre", "avatar"] } })
            const total = await Usuario.count({ where })
            return res.json({ usuarios, total })
        } catch (error) {
            return res.status(400).json({
                mensaje: error.message
            })
        }
    }

    async getUserInfo(req = request, res = response) {
        try {
            const authHeader = req.header("Authorization");
            
            if (!authHeader) throw new Error("¡Ups! Parece que no tienes una sesión activa");
            if (!authHeader.startsWith('Bearer ')) throw new Error("Formato del token inválido");
            
            const token = authHeader.split(' ')[1];
            const { email } = jwt.decode(token);
            
            const usuario = await Usuario.findOne({ 
                where: { email },
                include: [
                    { 
                        model: Rol,
                        attributes: ["nombre", "avatar"]
                    }
                ]
            });
            
            if (!usuario) throw new Error("Usuario no encontrado");
            
            // Determinar si es cliente o barbero
            const rolPaciente = await Rol.findOne({ where: { nombre: "Paciente" } });
            const modelType = usuario.rolID === rolPaciente.id ? Cliente : Barbero;
            
            const userInfo = await modelType.findOne({ 
                where: { usuarioID: usuario.id },
                include: [
                    {
                        model: Usuario,
                        attributes: ["id", "email", "estaVerificado", "createdAt"],
                        include: [
                            {
                                model: Rol,
                                attributes: ["nombre", "avatar"]
                            }
                        ]
                    }
                ]
            });
            
            if (!userInfo) {
                return res.json({
                    nombre: usuario.email.split('@')[0],
                    email: usuario.email,
                    rol: usuario.rol?.nombre || "Usuario",
                    avatar: usuario.rol?.avatar || null
                });
            }
            
            // Formatear la respuesta
            const responseData = {
                id: userInfo.id,
                nombre: userInfo.nombre || userInfo.usuario?.email.split('@')[0],
                email: userInfo.usuario?.email,
                telefono: userInfo.telefono || null,
                direccion: userInfo.direccion || null,
                rol: userInfo.usuario?.rol?.nombre || "Usuario",
                avatar: userInfo.usuario?.rol?.avatar || null,
                ...(modelType === Cliente ? {
                    fechaNacimiento: userInfo.fechaNacimiento,
                    genero: userInfo.genero
                } : {
                    especialidad: userInfo.especialidad,
                    experiencia: userInfo.experiencia
                })
            };
            
            return res.json(responseData);
        } catch (error) {
            return res.status(400).json({
                mensaje: error.message
            });
        }
    }
    

    async getPatientWithoutInformation(req = request, res = response) {
        try {
            const usuarios = await Usuario.findAll({
                include: [
                    { model: Cliente, required: false, attributes: ["id"], as: "cliente" },
                    { model: Rol, required: true, attributes: [], where: { nombre: "Paciente" }, }
                ],
                order: [["email", "ASC"]],
                where: { '$cliente.id$': null }
            });

            return res.json({ usuarios });
        } catch (error) {
            return res.status(400).json({
                mensaje: error.message
            });
        }
    }

    async getBarberWithoutInformation(req = request, res = response) {
        try {
            const usuarios = await Usuario.findAll({
                include: [
                    { model: Barbero, required: false, attributes: ["id"] },
                    { model: Rol, required: true, attributes: [], where: { nombre: "Barbero" }, }
                ],
                order: [["email", "ASC"]],
                where: { '$barberos.id$': null }
            });

            return res.json({ usuarios });
        } catch (error) {
            return res.status(400).json({
                mensaje: error.message
            });
        }
    }       

// Modificar el método create para enviar el código de verificación

async create(req = request, res = response) {
  try {
    const { email, password: plainPassword } = req.body;

    const usuarioYaExiste = await Usuario.findOne({ where: { email } });
    if (usuarioYaExiste) {
      return res.status(400).json({
        success: false,
        mensaje: "Este email ya se encuentra registrado"
      });
    }

    const password = await passwordUtils.encrypt(plainPassword);
    
    // Asignar rol Cliente por defecto si no se especifica
    const rolCliente = await Rol.findOne({ where: { nombre: "Cliente" } });
    const rolID = req.body.rolID || rolCliente.id;

    const usuario = await Usuario.create({ 
      ...req.body, 
      password,
      rolID,
      estaVerificado: false
    });

    // Crear código de verificación
    const codigo = (customAlphabet("0123456789", 6))();
    await CodigosVerificacion.create({ usuarioID: usuario.id, codigo });

    // Generar link de verificación que apunta a la pantalla de verificación
    const verificationLink = `${process.env.FRONTEND_URL}/verify-email?email=${encodeURIComponent(email)}&code=${codigo}`;

    // Enviar email de verificación
    await sendEmail({ 
      to: email, 
      subject: "Verifica tu cuenta en VIANNEY THE BARBER", 
      html: correos.envioCredenciales({ 
        codigo, 
        email, 
        password: plainPassword,
        verificationLink
      }) 
    });

    return res.status(201).json({
      success: true,
      mensaje: "Usuario creado correctamente. Se ha enviado un correo de verificación.",
      usuario
    });

  } catch (error) {
    console.error("Error en creación de usuario:", error);
    return res.status(400).json({
      success: false,
      mensaje: error.message || "Error al registrar usuario"
    });
  }
}

    async delete(req = request, res = response) {
        try {
            const id = req.params.id
            const usuario = await Usuario.findByPk(id)
            if (!usuario) throw new Error("Ups, parece que no encontramos este usuario")

            const clienteExiste = await Cliente.findOne({ where: { usuarioID: id } })
            if (clienteExiste) throw new Error("Ups, parece que este usuario está asociado a un paciente")

            const usuarioEliminado = await usuario.destroy({
                where: { id }
            })

            return res.json({
                mensaje: "Usuario eliminado correctamente",
                usuarioEliminado
            })
        } catch (error) {
            return res.status(400).json({
                mensaje: error.message
            })
        }
    }

    async resendEmail(req = request, res = response) {
        try {
            const { email } = req.body

            const usuario = await Usuario.findOne({ where: { email } })
            if (!usuario) throw new Error("¡Ups! Parece que este usuario no existe")
            if (usuario.estaVerificado) throw new Error("Este usuario ya está verificado")

            await CodigosVerificacion.destroy({ where: { usuarioID: usuario.id } })

            const codigo = (customAlphabet("0123456789", 6))()
            await CodigosVerificacion.create({ usuarioID: usuario.id, codigo })

            await sendEmail({ to: email, subject: "Confirmación de identidad", html: correos.confirmarIdentidad({ codigo, email }) })

            return res.status(201).json({ mensaje: "Correo reenviado correctamente" })

        } catch (error) {
            return res.status(400).json({
                mensaje: error.message
            })
        }
    }

    async userHasCompletedSignup(req = request, res = response, next) {
        try {
            const authHeader = req.header("Authorization")

            if (!authHeader) throw new Error({ mensaje: "¡Ups! Parece que no tienes una sesión activa" })
            if (!authHeader.startsWith('Bearer ')) throw new Error({ mensaje: "Formato del token invalido" })
            const token = authHeader.split(' ')[1];

            const { email } = jwt.decode(token);
            const usuario = await Usuario.findOne({ where: { email } })
            const cliente = await Cliente.findOne({ where: { usuarioID: usuario.id } })

            if (!cliente) throw new Error("El usuario no ha completado su información")

            return res.json({ cliente });
        } catch (error) {
            return res.status(400).json({
                mensaje: error.message
            })
        }
    }

    async completeSignup(req = request, res = response, next) {
        try {
            const authHeader = req.header("Authorization")

            if (!authHeader) throw new Error({ mensaje: "¡Ups! Parece que no tienes una sesión activa" })
            if (!authHeader.startsWith('Bearer ')) throw new Error({ mensaje: "Formato del token invalido" })
            const token = authHeader.split(' ')[1];

            const { email } = jwt.decode(token);
            const usuario = await Usuario.findOne({ where: { email } })

            const cliente = await Cliente.create({ usuarioID: usuario.id, ...req.body })

            return res.json({ mensaje: "Cliente creado correctamente", cliente });
        } catch (error) {
            return res.status(400).json({
                mensaje: error.message
            })
        }
    }

    async updatePassword(req = request, res = response) {
        try {
            const usuario = await Usuario.findOne({ where: { email: req.body.email } })
            if (!usuario) throw new Error("¡Ups! No encontramos ningún usuario con estas credenciales")

            const esPasswordCorrecta = await passwordUtils.isValidPassword(req.body.old_password, usuario.getDataValue("password"))
            if (!esPasswordCorrecta) throw new Error("¡Ups! Esta contraseña está incorrecta")

            const newPassword = await passwordUtils.encrypt(req.body.password)
            await usuario.update({ password: newPassword })

            return res.json({ mensaje: "Tu contraseña ha sido actualizada" })

        } catch (error) {
            return res.status(400).json({
                mensaje: error.message
            })
        }
    }

        // NUEVAS FUNCIONES PARA RECUPERACIÓN DE CONTRASEÑA
    async solicitarRecuperacionPassword(req = request, res = response) {
        try {
            const { email } = req.body;
            
            // Verificar si el usuario existe
            const usuario = await Usuario.findOne({ where: { email } });
            if (!usuario) {
                // Por seguridad, no revelamos si el email existe o no
                return res.status(200).json({ 
                    success: true, 
                    message: 'Si el email existe en nuestro sistema, recibirás un código de recuperación' 
                });
            }

            // Generar código de 6 dígitos
            const codigo = (customAlphabet("0123456789", 6))();
            const expiracion = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

            // Eliminar códigos previos
            await CodigosRecuperarVerificacion.destroy({ 
                where: { usuarioID: usuario.id } 
            });

            // Guardar nuevo código
            await CodigosRecuperarVerificacion.create({
                usuarioID: usuario.id,
                codigo,
                expiracion
            });

            // Enviar email con el código
            await sendEmail({ 
                to: email, 
                subject: "Recuperación de contraseña - NY Barber", 
                html: correos.recuperarPassword({ codigo, email }) 
            });

            return res.status(200).json({ 
                success: true, 
                message: 'Si el email existe en nuestro sistema, recibirás un código de recuperación' 
            });
        } catch (error) {
            console.error('Error en solicitarRecuperacionPassword:', error);
            return res.status(500).json({ 
                success: false, 
                message: 'Error interno del servidor' 
            });
        }
    }

    async verificarCodigoRecuperacion(req = request, res = response) {
        try {
            const { email, codigo } = req.body;
            
            // Buscar usuario
            const usuario = await Usuario.findOne({ where: { email } });
            if (!usuario) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Código inválido' 
                });
            }

            // Buscar código de recuperación válido
            const codigoRecuperacion = await CodigosRecuperarVerificacion.findOne({
                where: {
                    usuarioID: usuario.id,
                    codigo,
                    expiracion: { [Op.gt]: new Date() }
                }
            });

            if (!codigoRecuperacion) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Código inválido o expirado' 
                });
            }

            return res.status(200).json({ 
                success: true, 
                message: 'Código verificado correctamente' 
            });
        } catch (error) {
            console.error('Error en verificarCodigoRecuperacion:', error);
            return res.status(500).json({ 
                success: false, 
                message: 'Error interno del servidor' 
            });
        }
    }

    async cambiarPasswordConCodigo(req = request, res = response) {
        try {
            const { email, codigo, nuevaPassword } = req.body;
            
            // Buscar usuario
            const usuario = await Usuario.findOne({ where: { email } });
            if (!usuario) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Usuario no encontrado' 
                });
            }

            // Verificar el código primero
            const codigoRecuperacion = await CodigosRecuperarVerificacion.findOne({
                where: {
                    usuarioID: usuario.id,
                    codigo,
                    expiracion: { [Op.gt]: new Date() }
                }
            });

            if (!codigoRecuperacion) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Código inválido o expirado' 
                });
            }

            // Cambiar la contraseña
            const hashedPassword = await passwordUtils.encrypt(nuevaPassword);
            await Usuario.update(
                { password: hashedPassword },
                { where: { id: usuario.id } }
            );

            // Eliminar el código usado
            await CodigosRecuperarVerificacion.destroy({
                where: { id: codigoRecuperacion.id }
            });

            return res.status(200).json({ 
                success: true, 
                message: 'Contraseña cambiada exitosamente' 
            });
        } catch (error) {
            console.error('Error en cambiarPasswordConCodigo:', error);
            return res.status(500).json({ 
                success: false, 
                message: 'Error interno del servidor' 
            });
        }
    }
}

export const usuarioController = new UsuarioController();
