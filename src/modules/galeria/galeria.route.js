/* =========================================================
   src/modules/galeria/galeria.route.js
   RUTAS FINALES - Sin validaciones de longitud
   ========================================================= */
import { Router } from "express";
import { galeriaController } from "./galeria.controller.js";

export const galeriaRouter = Router();

// ✅ Ruta PÚBLICA para obtener solo elementos activos (para clientes)
galeriaRouter.get("/public", galeriaController.getActivos);

// 🔒 Rutas que podrían necesitar protección (pero sin autenticación estricta)
galeriaRouter.get("/", galeriaController.get);

galeriaRouter.get("/:id", galeriaController.findByPk);

// ✅ IMPORTANTE: ELIMINAR TODOS LOS MIDDLEWARES que validan longitud y autenticación
galeriaRouter.post("/", galeriaController.create);

galeriaRouter.put("/:id", galeriaController.update);

galeriaRouter.delete("/:id", galeriaController.delete);

galeriaRouter.post("/reordenar", galeriaController.reordenar);

galeriaRouter.patch("/:id/toggle-activo", galeriaController.toggleActivo);