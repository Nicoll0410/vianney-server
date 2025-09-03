// Archivo: src/server.js
import express from "express";
import cors from "cors";
import morgan from "morgan";
import http from "http";
import { Server as SocketIOServer } from "socket.io";

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
        this.io = new SocketIOServer(this.server, {
            cors: {
                origin: [
                    "https://nmbarberapp-seven.vercel.app",
                    "http://localhost:3000",
                    "http://localhost:8081",
                    "http://localhost:19006",
                    "exp://192.168.1.X:19000" // Agrega tu IP local para desarrollo móvil
                ],
                methods: ["GET", "POST", "PUT", "DELETE"],
                credentials: true
            }
        });

        // Guardar instancia global de io para usar en controladores
        this.app.set("io", this.io);

        // Almacenar conexiones de usuarios
        this.userSockets = new Map();

        // Eventos de conexión mejorados
        this.io.on("connection", (socket) => {
            console.log("🟢 Cliente conectado:", socket.id);

            // Unir usuario a su sala personal cuando se autentica
            socket.on("join-user-room", (userId) => {
                socket.join(`user_${userId}`);
                this.userSockets.set(userId, socket.id);
                console.log(`👤 Usuario ${userId} unido a su sala (Socket: ${socket.id})`);
            });

            // Manejar desconexión
            socket.on("disconnect", () => {
                // Eliminar usuario de la lista de conexiones
                for (let [userId, socketId] of this.userSockets.entries()) {
                    if (socketId === socket.id) {
                        this.userSockets.delete(userId);
                        console.log(`👤 Usuario ${userId} desconectado`);
                        break;
                    }
                }
                console.log("🔴 Cliente desconectado:", socket.id);
            });

            // Manejar errores de socket
            socket.on("error", (error) => {
                console.error("❌ Error de Socket:", error);
            });
        });

        // Guardar instancia de userSockets para uso global
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

    middlewares() {
        // Configuración de CORS
        const allowedOrigins = [
            "https://nmbarberapp-seven.vercel.app",
            "http://localhost:3000",
            "http://localhost:8081",
            "http://localhost:19006",
            "exp://192.168.1.X:19000" // Agrega tu IP local
        ];

        this.app.use(cors({
            origin: function (origin, callback) {
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
                timestamp: new Date().toISOString()
            });
        });
    }
}