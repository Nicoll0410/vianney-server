import { Router } from "express";
import { usuarioController } from "./usuarios.controller.js";
import { validaciones } from "../../middlewares/validaciones.middleware.js";

const crearUsuarioMiddlewares = [
    validaciones.estaVacio("email", "El email debe de ser obligatorio"),
    validaciones.esEmail("email", "El email no tiene el formato correcto"),
    validaciones.estaVacio("password", "La contraseña debe de ser obligatoria"),
]

const reenvioCorreoMiddlewares = [
    validaciones.estaVacio("email", "El email debe de ser obligatorio"),
    validaciones.esEmail("email", "El email no tiene el formato correcto")
]

const actualizarPassword = [
    validaciones.estaVacio("old_password", "La contraseña vieja debe ser obligatorio"),
    validaciones.estaVacio("email", "El email debe ser obligatorio"),
    validaciones.estaVacio("password", "La contraseña debe ser obligatoria")
]

export const usuarioRouter = Router()

usuarioRouter.get("/", usuarioController.get)
usuarioRouter.get("/user-info", usuarioController.getUserInfo)
usuarioRouter.get("/patients-without-information", usuarioController.getPatientWithoutInformation)
usuarioRouter.get("/barber-without-information", usuarioController.getBarberWithoutInformation)
usuarioRouter.post("/", crearUsuarioMiddlewares, usuarioController.create)
usuarioRouter.post("/update-password", actualizarPassword, usuarioController.updatePassword)
usuarioRouter.post("/resend-email", reenvioCorreoMiddlewares,usuarioController.resendEmail)
usuarioRouter.delete("/:id", usuarioController.delete)
usuarioRouter.get("/user-has-completed-signup", usuarioController.userHasCompletedSignup)
usuarioRouter.post("/complete-signup", usuarioController.completeSignup)