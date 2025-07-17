import { Router } from "express";
import { categoriasProductosController } from "./categoria_insumos.controller.js";
import { validaciones } from "../../middlewares/validaciones.middleware.js";

export const categoriasInsumosRouter = Router()

categoriasInsumosRouter.get("/", categoriasProductosController.get)
categoriasInsumosRouter.get("/all", categoriasProductosController.getAll)
categoriasInsumosRouter.get("/:id", categoriasProductosController.getById)

categoriasInsumosRouter.post("/",
    [
        validaciones.estaVacio("nombre", "El nombre debe de ser obligatorio"),
        validaciones.estaVacio("descripcion", "La descripción debe de ser obligatoria"),
    ], 
    categoriasProductosController.create)
    
categoriasInsumosRouter.put("/:id", 
    [
        validaciones.estaVacio("nombre", "El nombre debe de ser obligatorio"),
        validaciones.estaVacio("descripcion", "La descripción debe de ser obligatoria"),
    ], 
    categoriasProductosController.update)
    
categoriasInsumosRouter.delete("/:id", categoriasProductosController.delete)