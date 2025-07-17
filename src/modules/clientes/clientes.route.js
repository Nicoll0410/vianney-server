import { Router } from "express";
import { clientesController } from "./clientes.controller.js";
import { validaciones } from "../../middlewares/validaciones.middleware.js";

export const clientesRouter = Router();

// Obtener todos los clientes (con paginación)
clientesRouter.get("/", clientesController.get);

// Obtener un cliente específico por ID
clientesRouter.get("/by-id/:id", clientesController.getById);

// Crear nuevo cliente
clientesRouter.post("/",
    [
        validaciones.estaVacio("nombre", "El nombre debe de ser obligatorio", { max: 50 }),
        validaciones.estaVacio("telefono", "El teléfono debe de ser obligatorio", { max: 10, esNumerico: true }),
        validaciones.estaVacio("fecha_nacimiento", "La fecha de nacimiento debe de ser obligatoria"),
        validaciones.estaVacio("email", "El email debe de ser obligatorio"),
        validaciones.estaVacio("password", "La contraseña debe de ser obligatoria"),
    ],
    clientesController.create);

// Actualizar cliente por email
clientesRouter.put("/by-email",
    [
        validaciones.estaVacio("nombre", "El nombre debe de ser obligatorio"),
        validaciones.estaVacio("telefono", "El teléfono debe de ser obligatorio"),
        validaciones.estaVacio("fecha_nacimiento", "La fecha de nacimiento debe de ser obligatoria"),
        validaciones.estaVacio("email", "El email debe de ser obligatoria"),
    ],
    clientesController.updateByEmail);

// Actualizar cliente por ID
clientesRouter.put("/:id",
    [
        validaciones.estaVacio("nombre", "El nombre debe de ser obligatorio"),
        validaciones.estaVacio("telefono", "El teléfono debe de ser obligatorio"),
        validaciones.estaVacio("fecha_nacimiento", "La fecha de nacimiento debe de ser obligatoria"),
    ],
    clientesController.update);

// Eliminar cliente
clientesRouter.delete("/:id", clientesController.delete);

// Reenviar email de verificación
clientesRouter.post("/:id/reenviar-verificacion", clientesController.reenviarVerificacion);