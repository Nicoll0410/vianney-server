import { Router } from "express";
import NotificationsController from "./notifications.controller.js";

const router = Router();

// Guardar el token Expo de un usuario
router.post("/save-token", NotificationsController.saveToken);

// Obtener notificaciones del usuario actual
router.get("/", NotificationsController.getUserNotifications);

// Obtener conteo de notificaciones no leídas
router.get("/unread-count", NotificationsController.getUnreadCount);

// Marcar todas como leídas
router.put("/mark-all-read", NotificationsController.markAllAsRead);

// Enviar notificación push de prueba (solo desarrollo)
if (process.env.NODE_ENV === "development") {
    router.post("/send-test", NotificationsController.sendNotification);
}

export default router;