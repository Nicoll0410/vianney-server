// notifications.route.js - Agregar ruta POST para crear notificaciones
import { Router } from "express";
import NotificationsController from "./notifications.controller.js";
import { verifyToken } from "../../middlewares/jwt.middleware.js";

export const notificationsRouter = Router();

// Aplicar middleware JWT a todas las rutas
notificationsRouter.use(verifyToken);

// Rutas existentes
notificationsRouter.get("/", NotificationsController.getUserNotifications);
notificationsRouter.get("/count", NotificationsController.getUnreadCount);
notificationsRouter.post("/mark-read", NotificationsController.markAllAsRead);
notificationsRouter.post("/save-token", NotificationsController.saveToken);

// 👇 NUEVA RUTA: Para crear notificaciones manualmente
notificationsRouter.post("/", NotificationsController.createNotification);

// Ruta de prueba solo para desarrollo
if (process.env.NODE_ENV === "development") {
    notificationsRouter.post("/test", NotificationsController.sendTestNotification);
}

export default notificationsRouter;