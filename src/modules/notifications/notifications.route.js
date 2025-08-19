// notifications.route.js - Actualizado
import { Router } from "express";
import NotificationsController from "./notifications.controller.js";
import { verifyToken } from "../../middlewares/jwt.middleware.js";

export const notificationsRouter = Router();

// Aplicar middleware JWT a todas las rutas
notificationsRouter.use(verifyToken);

// Actualizar rutas para mantener consistencia con el frontend
notificationsRouter.get("/", NotificationsController.getUserNotifications);
notificationsRouter.get("/count", NotificationsController.getUnreadCount); // Cambiado de /unread-count a /count
notificationsRouter.post("/mark-read", NotificationsController.markAllAsRead); // Cambiado de PUT a POST
notificationsRouter.post("/save-token", NotificationsController.saveToken);

// Ruta de prueba solo para desarrollo
if (process.env.NODE_ENV === "development") {
  notificationsRouter.post("/test", NotificationsController.sendTestNotification);
}