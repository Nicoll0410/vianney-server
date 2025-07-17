import { Router } from "express";
import { insumosController } from "./insumos.controller.js";
import { validaciones } from "../../middlewares/validaciones.middleware.js"

export const insumosRouter = Router()

insumosRouter.get("/", insumosController.get)
insumosRouter.get("/all", insumosController.getAll)
insumosRouter.get("/:id", insumosController.getById)

insumosRouter.post(
  "/",
  [
    validaciones.estaVacio("nombre", "El nombre debe de ser obligatorio"),
    validaciones.estaVacio("descripcion", "La descripcion debe de ser obligatorio"),
  ],
  insumosController.create
)

insumosRouter.put("/:id",
  [
    validaciones.estaVacio("nombre", "El nombre debe de ser obligatorio"),
    validaciones.estaVacio("descripcion", "La descripcion debe de ser obligatorio"),
  ],
  insumosController.update
)

insumosRouter.delete("/:id", insumosController.delete)

insumosRouter.patch("/:id/reducir", insumosController.reducirCantidad)