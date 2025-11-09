/* =========================================================
   src/modules/galeria/galeria.route.js
   RUTAS DEFINITIVAS - Con autenticación
   ========================================================= */
import { Router } from "express";
import { galeriaController } from "./galeria.controller.js";

export const galeriaRouter = Router();

// Middleware de autenticación
const requireAuth = (req, res, next) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      success: false,
      mensaje: "Usuario no autenticado"
    });
  }
  next();
};

// ✅ Ruta PÚBLICA (sin autenticación)
galeriaRouter.get("/public", galeriaController.getActivos);

// 🔒 Todas estas rutas REQUIEREN autenticación
galeriaRouter.get("/", requireAuth, galeriaController.get);
galeriaRouter.get("/:id", requireAuth, galeriaController.findByPk);
galeriaRouter.post("/", requireAuth, galeriaController.create);
galeriaRouter.put("/:id", requireAuth, galeriaController.update);
galeriaRouter.delete("/:id", requireAuth, galeriaController.delete);
galeriaRouter.post("/reordenar", requireAuth, galeriaController.reordenar);
galeriaRouter.patch("/:id/toggle-activo", requireAuth, galeriaController.toggleActivo);