import { Router } from "express";
import { categorias_productoscontroller } from "./categoria_insumos.controller.js";
import { validaciones } from "../../middlewares/validaciones.middleware.js";

export const categoriasInsumosRouter = Router()

categoriasInsumosRouter.get("/", categorias_productoscontroller.get)
categoriasInsumosRouter.get("/all", categorias_productoscontroller.getAll)

categoriasInsumosRouter.post("/",
    [
        validaciones.estaVacio("nombre", "El nombre debe de ser obligatorio"),
        validaciones.estaVacio("descripcion", "La descripción debe de ser obligatoria"),
    ], 
    categorias_productoscontroller.create)
categoriasInsumosRouter.put("/:id", 
    [
        validaciones.estaVacio("nombre", "El nombre debe de ser obligatorio"),
        validaciones.estaVacio("descripcion", "La descripción debe de ser obligatoria"),
    ], 
    categorias_productoscontroller.update)
categoriasInsumosRouter.delete("/:id", categorias_productoscontroller.delete)