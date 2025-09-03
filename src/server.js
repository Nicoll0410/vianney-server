// Archivo: src/server.js
import express from "express";
import cors from "cors";
import morgan from "morgan";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import jwt from "jsonwebtoken";

import { jwtMiddlewares } from "./middlewares/jwt.middleware.js";
import { proveedoresRouter } from "./modules/proveedores/proveedores.route.js";
import { RouterVentas } from "./modules/ventas/ventas.route.js";
import { rolesRouter } from "./modules/roles/roles.route.js";
import { citasRouter } from "./modules/citas/citas.route.js";
import { insumosRouter } from "./modules/insumos/insumos.route.js";
import { barberosRouter } from "./modules/barberos/barberos.route.js";
import { serviciosRouter } from "./modules/servicios/servicios.route.js";
import { clientesRouter } from "./modules/clientes/clientes.route.js";
import { comprasRouter } from "./modules/compras/compras.route.js";
import { usuarioRouter } from "./modules/usuarios/usuarios.route.js";
import { authRouter } from "./modules/auth/auth.route.js";
import { categoriasInsumosRouter } from "./modules/categoria-insumos/categoria_insumos.route.js";
import { movimientosRouter } from "./modules/movimientos/movimientos.route.js";
import { dashboardRouter } from "./modules/dashboard/dashboard.route.js";
import { publicRouter } from "./modules/public/public.route.js";
import { Database } from "./database.js";
import { syncAllModels } from "./syncAll.js";
import { notificationsRouter } from "./modules/notifications/notifications.route.js";
import { JobsManager } from "./jobs/index.js";

export class Server {
    constructor() {
        this.app = express();

        // Middlewares y rutas
        this.middlewares();
        this.routes();

        // 👇 Crear servidor HTTP y Socket.IO
        this.server = http.createServer(this.app);
        
        // Configuración mejorada de Socket.IO
        this.io = new SocketIOServer(this.server, {
            cors: {
                origin: [
                    "https://nmbarberapp-seven.vercel.app",
                    "http://localhost:3000",
                    "http://localhost:8081",
                    "http://localhost:19006",
                    "exp://192.168.1.*:19000" // Para dispositivos en red local
                ],
                methods: ["GET", "POST", "PUT", "DELETE"],
                credentials: true,
                allowedHeaders: ["Content-Type", "Authorization"]
            },
            transports: ['websocket', 'polling'] // Soporte para ambos transportes
        });

        // Almacenar conexiones de usuarios por ID
        this.userSockets = new Map();

        // Middleware de autenticación para sockets
        this.io.use(this.authenticateSocket.bind(this));

        // Configurar eventos de conexión
        this.setupSocketEvents();

        // Guardar instancias globalmente para acceso en controladores
        global.io = this.io;
        global.userSockets = this.userSockets;
        this.app.set("io", this.io);
        this.app.set("userSockets", this.userSockets);

        // Sincronizar modelos y levantar servidor
        syncAllModels()
            .then(() => {
                JobsManager.iniciarTodos();
                this.server.listen(process.env.PORT, "0.0.0.0", () =>
                    console.log(
                        `🚀 Servidor ejecutándose en el puerto ${process.env.PORT}`
                    )
                );
            })
            .catch((err) => {
                console.error("❌ Error al sincronizar modelos:", err);
            });
    }

    // Middleware de autenticación para sockets
    authenticateSocket(socket, next) {
        try {
            const token = socket.handshake.auth.token;
            
            if (!token) {
                console.log("❌ Socket connection attempt without token");
                return next(new Error('Authentication error: No token provided'));
            }

            // Verificar el token JWT
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Adjuntar información del usuario al socket
            socket.userId = decoded.userId;
            socket.userRole = decoded.rol?.nombre;
            socket.userEmail = decoded.email;
            
            console.log(`✅ Socket authenticated for user: ${decoded.email}`);
            next();
        } catch (error) {
            console.error('❌ Socket authentication error:', error.message);
            next(new Error('Authentication error: Invalid token'));
        }
    }

    // Configurar eventos de socket
    setupSocketEvents() {
        this.io.on("connection", (socket) => {
            console.log("🟢 Cliente conectado:", socket.id, "Usuario:", socket.userId, "Email:", socket.userEmail);

            // Guardar la conexión del usuario
            if (socket.userId) {
                this.userSockets.set(socket.userId, socket.id);
                
                // Unir al usuario a una sala personalizada
                socket.join(`user_${socket.userId}`);
                console.log(`✅ Usuario ${socket.userId} unido a la sala user_${socket.userId}`);
            }

            // Manejar unión a salas específicas
            socket.on("join-room", (room) => {
                socket.join(room);
                console.log(`✅ Socket ${socket.id} unido a la sala: ${room}`);
            });

            // Manejar solicitud para unirse a sala de usuario
            socket.on("join-user-room", () => {
                if (socket.userId) {
                    socket.join(`user_${socket.userId}`);
                    console.log(`✅ Usuario ${socket.userId} unido a su sala personal`);
                }
            });

            // Manejar mensajes personalizados
            socket.on("send-notification", (data) => {
                console.log("📨 Notificación recibida para enviar:", data);
                
                // Reenviar la notificación al usuario específico
                if (data.userId && data.notification) {
                    this.io.to(`user_${data.userId}`).emit("new-notification", data.notification);
                }
            });

            // Manejar desconexión
            socket.on("disconnect", (reason) => {
                console.log("🔴 Cliente desconectado:", socket.id, "Razón:", reason);
                
                // Eliminar de la lista de conexiones activas
                if (socket.userId) {
                    this.userSockets.delete(socket.userId);
                }
            });

            // Manejar errores
            socket.on("error", (error) => {
                console.error("❌ Error en socket:", error);
            });
        });

        // Manejar errores de conexión
        this.io.engine.on("connection_error", (err) => {
            console.error("❌ Error de conexión Socket.IO:", err);
        });
    }

    middlewares() {
        // Configuración de CORS CORREGIDA
        const allowedOrigins = [
            "https://nmbarberapp-seven.vercel.app",
            "http://localhost:3000",
            "http://localhost:8081",
            "http://localhost:19006",
            "exp://192.168.1.*:19000"
        ];

        this.app.use(cors({
            origin: function (origin, callback) {
                // Permitir requests sin origin (como mobile apps, postman, curl)
                if (!origin) return callback(null, true);
                
                if (allowedOrigins.indexOf(origin) !== -1) {
                    return callback(null, true);
                } else {
                    console.log("❌ Origen no permitido por CORS:", origin);
                    return callback(new Error("Not allowed by CORS"), false);
                }
            },
            credentials: true,
            methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            allowedHeaders: ["Content-Type", "Authorization", "x-auth-token", "X-Requested-With"]
        }));

        // Manejar preflight requests
        this.app.options("*", cors());

        // Headers adicionales para CORS
        this.app.use((req, res, next) => {
            res.header("Access-Control-Allow-Credentials", "true");
            res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
            res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-auth-token, X-Requested-With");
            
            if (req.method === "OPTIONS") {
                return res.status(200).end();
            }
            next();
        });

        this.app.use(express.json({ limit: "50mb" }));
        this.app.use(express.urlencoded({ extended: true, limit: "10mb" }));
        this.app.use(morgan("combined"));

        new Database();
    }

    routes() {
        // Rutas públicas
        this.app.use("/auth", authRouter);
        this.app.use("/public", publicRouter);
        this.app.use("/usuarios", usuarioRouter);

        // Middleware JWT para proteger el resto
        this.app.use(jwtMiddlewares.verifyToken);

        // Rutas privadas
        this.app.use("/roles", rolesRouter);
        this.app.use("/proveedores", proveedoresRouter);
        this.app.use("/categorias-insumos", categoriasInsumosRouter);
        this.app.use("/insumos", insumosRouter);
        this.app.use("/movimientos", movimientosRouter);
        this.app.use("/usuarios", usuarioRouter);
        this.app.use("/servicios", serviciosRouter);
        this.app.use("/notifications", notificationsRouter);
        this.app.use("/barberos", barberosRouter);
        this.app.use("/clientes", clientesRouter);
        this.app.use("/compras", comprasRouter);
        this.app.use("/dashboard", dashboardRouter);
        this.app.use("/citas", citasRouter);
        this.app.use("/ventas", RouterVentas);

        // Ruta de health check para verificar CORS
        this.app.get("/health-check", (req, res) => {
            res.json({ 
                status: "OK", 
                message: "CORS configurado correctamente",
                timestamp: new Date().toISOString(),
                socketConnections: this.userSockets.size
            });
        });

        // Ruta para verificar estado de sockets
        this.app.get("/socket-status", (req, res) => {
            res.json({
                totalConnections: this.userSockets.size,
                connections: Array.from(this.userSockets.entries()).map(([userId, socketId]) => ({
                    userId,
                    socketId
                }))
            });
        });
    }
}