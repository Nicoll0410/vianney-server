/* =========================================================
   src/modules/galeria/galeria.route.js
   Rutas para el módulo de galería
   ========================================================= */
import { Router } from "express";
import { galeriaController } from "./galeria.controller.js";
import { validaciones } from "../../middlewares/validaciones.middleware.js";

export const galeriaRouter = Router();

// ✅ Ruta PÚBLICA para obtener solo elementos activos (para clientes)
galeriaRouter.get("/public", galeriaController.getActivos);

// 🔒 Rutas PROTEGIDAS (requieren autenticación)
galeriaRouter.get("/", galeriaController.get);

galeriaRouter.get("/:id", galeriaController.findByPk);

galeriaRouter.post(
  "/",
  [
    validaciones.estaVacio("titulo", "El título es obligatorio"),
    validaciones.estaVacio("tipo", "El tipo (imagen/video) es obligatorio"),
    validaciones.estaVacio("url", "La URL es obligatoria"),
  ],
  galeriaController.create
);

galeriaRouter.put(
  "/:id",
  [validaciones.estaVacio("titulo", "El título es obligatorio")],
  galeriaController.update
);

galeriaRouter.delete("/:id", galeriaController.delete);

galeriaRouter.post("/reordenar", galeriaController.reordenar);

galeriaRouter.patch("/:id/toggle-activo", galeriaController.toggleActivo);