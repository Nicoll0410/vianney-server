import { Router } from "express";
import NotificationsController from "./notifications.controller.js";

const router = Router();

// Guardar el token Expo de un usuario
router.post("/save-token", NotificationsController.saveToken);

// Enviar notificación push y guardar en BD
router.post("/send", NotificationsController.sendNotification);

// Obtener notificaciones del usuario actual (usando JWT)
router.get("/", NotificationsController.getUserNotifications);

// Obtener notificaciones de un usuario específico (admin)
router.get("/:userId", NotificationsController.getUserNotificationsById);

// Marcar notificación como leída
router.put("/:id/read", NotificationsController.markAsRead);

// Marcar todas como leídas
router.put("/mark-all-read", NotificationsController.markAllAsRead);

export default router;