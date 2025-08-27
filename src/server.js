// Archivo: src/server.js
import express from "express";
import cors from "cors";
import morgan from "morgan";
import http from "http"; // 👈 necesario para socket.io
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
                origin: "*", // ⚠️ En producción cámbialo a tu dominio frontend
                methods: ["GET", "POST", "PUT", "DELETE"]
            }
        });

        // Guardar instancia global de io para usar en controladores
        this.app.set("io", this.io);

        // Eventos de conexión
        this.io.on("connection", (socket) => {
            console.log("🟢 Cliente conectado:", socket.id);

            socket.on("disconnect", () => {
                console.log("🔴 Cliente desconectado:", socket.id);
            });
        });

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
        this.app.use(
            cors({
                origin: ["https://nmbarberapp-seven.vercel.app/Login", "http://localhost:8081", "http://localhost:19006"], // añade tu frontend en prod
                methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                allowedHeaders: ["Content-Type", "Authorization"],
                credentials: true,
            })
        );

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
    }
}
