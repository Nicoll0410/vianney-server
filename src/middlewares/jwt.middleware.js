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

        // 🔥 VERIFICAR CONEXIÓN A BD PRIMERO
        try {
            await sequelize.authenticate();
        } catch (dbError) {
            console.error('Error de conexión a BD:', dbError.message);
            return res.status(503).json({ 
                mensaje: "Error temporal de conexión. Por favor intenta nuevamente.",
                error: "DB_CONNECTION_ERROR"
            });
        }

        let usuario;
        try {
            // Buscar el usuario
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

        } catch (queryError) {
            console.error('Error en consulta a BD:', queryError);
            
            // Si es error de conexión, intentar reconectar
            if (queryError.name === 'SequelizeConnectionError') {
                try {
                    await sequelize.authenticate(); // Reconectar
                    // Reintentar la consulta
                    if (decoded.email) {
                        usuario = await Usuario.findOne({
                            where: { email: decoded.email },
                            include: [{
                                model: Rol,
                                as: 'rol',
                                attributes: ['id', 'nombre']
                            }]
                        });
                    }
                } catch (retryError) {
                    return res.status(503).json({ 
                        mensaje: "Error de conexión con la base de datos",
                        error: "DB_CONNECTION_ERROR"
                    });
                }
            } else {
                throw queryError;
            }
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

        console.log('Usuario autenticado:', req.user.email);

        next();
    } catch (error) {
        console.error('Error en middleware JWT:', error);
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                mensaje: 'Tu sesión ha expirado. Por favor inicia sesión nuevamente.',
                error: 'TOKEN_EXPIRED'
            });
        }
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                mensaje: 'Token inválido. Por favor inicia sesión nuevamente.',
                error: 'INVALID_TOKEN'
            });
        }

        if (error.name === 'SequelizeConnectionError') {
            return res.status(503).json({ 
                mensaje: "Error de conexión con la base de datos. Por favor intenta nuevamente.",
                error: "DB_CONNECTION_ERROR"
            });
        }

        return res.status(500).json({ 
            mensaje: 'Error interno del servidor',
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