/* =========================================================
   src/modules/galeria/galeria.route.js
   RUTAS CON ENDPOINTS PARA GALERÍA POR BARBERO
   ========================================================= */
import { Router } from "express";
import { galeriaController } from "./galeria.controller.js";

export const galeriaRouter = Router();

// ✅ NUEVAS RUTAS PÚBLICAS PARA CLIENTES
galeriaRouter.get("/public/barberos", galeriaController.getPorBarberos);
galeriaRouter.get("/public/barbero/:barberoID", galeriaController.getByBarbero);

// Rutas de gestión
galeriaRouter.get("/", galeriaController.get);
galeriaRouter.get("/barbero/:barberoID", galeriaController.getByBarbero);
galeriaRouter.get("/:id", galeriaController.findByPk);

galeriaRouter.post("/", galeriaController.create);
galeriaRouter.put("/:id", galeriaController.update);
galeriaRouter.delete("/:id", galeriaController.delete);

galeriaRouter.post("/reordenar", galeriaController.reordenar);
galeriaRouter.patch("/:id/toggle-activo", galeriaController.toggleActivo);
galeriaRouter.patch("/:id/toggle-destacada", galeriaController.toggleDestacada);