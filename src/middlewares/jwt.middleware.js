import jwt from 'jsonwebtoken';
import { Usuario } from "../modules/usuarios/usuarios.model.js";
import { Rol } from "../modules/roles/roles.model.js";
import { sequelize } from '../database.js';

// Función para verificar el token
export const verifyToken = async (req, res, next) => {
    // Rutas que NO requieren autenticación
    const publicRoutes = [
        '/auth',
        '/public',
        '/usuarios/solicitar-recuperacion',
        '/usuarios/verificar-codigo',
        '/usuarios/cambiar-password-codigo',
    ];
    
    // Si la ruta es pública, continuar sin verificar token
    if (publicRoutes.some(route => req.path.startsWith(route))) {
        return next();
    }

    // Para TODAS las demás rutas, verificar token
    const authHeader = req.header("Authorization");
    if (!authHeader) {
        return res.status(401).json({ mensaje: "¡Ups! Parece que no tienes una sesión activa" });
    }
    
    if (!authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ mensaje: "Formato del token inválido" });
    }
    
    const token = authHeader.split(' ')[1];
    
    try {
        // Verificar el token JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        if (!decoded) {
            return res.status(401).json({ mensaje: "Token no válido" });
        }

        console.log('Token decodificado:', decoded);


        let usuario;
        if (decoded.email) {
            usuario = await Usuario.findOne({
                where: { email: decoded.email },
                include: [{
                    model: Rol,
                    as: 'rol',
                    attributes: ['id', 'nombre']
                }]
            });
        } else if (decoded.userId || decoded.id) {
            // Buscar por ID si no hay email pero sí userId/id en el token
            usuario = await Usuario.findOne({
                where: { id: decoded.userId || decoded.id },
                include: [{
                    model: Rol,
                    as: 'rol',
                    attributes: ['id', 'nombre']
                }]
                });
            }

            if (!usuario) {
            return res.status(401).json({ mensaje: "Usuario no encontrado" });
        }

        // Añadir el usuario a la request
        req.user = {
            id: usuario.id,
            email: usuario.email,
            rol: {
                id: usuario.rol.id,
                nombre: usuario.rol.nombre
            },
            verificado: usuario.estaVerificado
        };

        console.log('Usuario autenticado:', req.user);

        next();
    } catch (error) {
        console.error('Error en middleware JWT:', error);
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                mensaje: 'Token expirado',
                error: 'TOKEN_EXPIRED'
            });
        }
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                mensaje: 'Token inválido',
                error: 'INVALID_TOKEN'
            });
        }

        return res.status(500).json({ 
            mensaje: 'Error en el servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : null
        });
    }
};

// Objeto de middleware para compatibilidad
export const jwtMiddlewares = {
    verifyToken
};

// Exportar como default para compatibilidad
export default { verifyToken };