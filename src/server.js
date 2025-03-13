import express, { request, response } from "express"
import cors from "cors"
import { jwtMiddlewares } from "./middlewares/jwt.middleware.js"
import { proveedoresRouter } from "./modules/proveedores/proveedores.route.js"
import { RouterVentas } from "./modules/ventas/ventas.route.js"
import { rolesRouter } from "./modules/roles/roles.route.js"
import { citasRouter } from "./modules/citas/citas.route.js"
import { insumosRouter } from "./modules/insumos/insumos.route.js"
import { barberosRouter } from "./modules/barberos/barberos.route.js"
import { serviciosRouter } from "./modules/servicios/servicios.route.js"
import { clientesRouter } from "./modules/clientes/clientes.route.js"
import { comprasRouter } from "./modules/compras/compras.route.js"
import { usuarioRouter } from "./modules/usuarios/usuarios.route.js"
import { authRouter } from "./modules/auth/auth.route.js"
import { categoriasInsumosRouter } from "./modules/categoria-insumos/categoria_insumos.route.js"
import { movimientosRouter } from "./modules/movimientos/movimientos.route.js"
import { dashboardRouter } from "./modules/dashboard/dashboard.route.js"
import { publicRouter } from "./modules/public/public.route.js"
import { Database } from "./database.js"


export class Server {
    constructor() {
        this.app = express()

        this.middlewares()
        this.routes()

        this.app.listen(process.env.PORT, () => console.log(`Servidor ejecutandose en el puerto ${process.env.PORT} 🎉🎉🎉`))
    }

    middlewares() {
        this.app.use(express.json())
        this.app.use(cors())
        new Database()
    }

    routes() {
        this.app.use("/auth", authRouter)
        this.app.use("/public", publicRouter)
        this.app.use(jwtMiddlewares.verifyToken)

        this.app.use("/roles", rolesRouter)
        this.app.use("/proveedores", proveedoresRouter)
        this.app.use("/categorias-insumos", categoriasInsumosRouter)
        this.app.use("/insumos", insumosRouter)
        this.app.use("/movimientos", movimientosRouter)
        this.app.use("/usuarios", usuarioRouter)
        this.app.use("/servicios", serviciosRouter)

        this.app.use("/barberos", barberosRouter)
        this.app.use("/clientes", clientesRouter)
        this.app.use("/compras", comprasRouter)
        
        this.app.use("/dashboard", dashboardRouter)
        this.app.use("/citas", citasRouter)
        this.app.use("/ventas", RouterVentas)
    }
}