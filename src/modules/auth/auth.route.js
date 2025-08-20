import { Router } from "express";
import { authController } from "./auth.controller.js";
import { validaciones } from "../../middlewares/validaciones.middleware.js";

export const authRouter = Router();

/* ───────────── LOGIN ───────────── */
authRouter.post("/login", loginValidaciones(), (req, res) =>
  authController.login(req, res)
);
authRouter.post("/login-client", loginValidaciones(), (req, res) =>
  authController.loginClient(req, res)
);
authRouter.post("/login-mobile", loginValidaciones(), (req, res) =>
  authController.loginMobile(req, res)
);

/* ─────────── SIGN‑UP ───────────── */
authRouter.post("/signup", signupValidaciones(), (req, res) =>
  authController.signUp(req, res)
);

authRouter.get('/verify-from-email', authController.verifyFromEmail);

/* ────── VERIFICAR CUENTA ───────── */
authRouter.post(
  "/verify-account",
  verifyAccountValidaciones(),
  (req, res) => authController.verifyAccount(req, res)
);

/* ───── COMPROBAR TOKEN JWT ─────── */
authRouter.get(
  "/verify-token",
  validaciones.estaHeaderVacio("Authorization", "El token es obligatorio"),
  (req, res) => authController.verifyToken(req, res)
);

/* ───── PERMISOS POR RUTA ───────── */
authRouter.get(
  "/routes-permission",
  validaciones.estaHeaderVacio("Authorization", "El token es obligatorio"),
  (req, res) => authController.routesPermission(req, res)
);

/* ─── RECUPERAR / CAMBIAR PASS ──── */
authRouter.post(
  "/recover-password",
  recoverPasswordValidaciones(),
  (req, res) => authController.recoverPassword(req, res)
);
authRouter.post(
  "/verify-recover-password",
  verifyRecoverPasswordValidaciones(),
  (req, res) => authController.verifyRecoverPassword(req, res)
);
/* ───── REENVIAR CÓDIGO VERIFICACIÓN ───────── */
authRouter.post(
  "/resend-code",
  [
    validaciones.estaVacio("email", "El email es obligatorio"),
    validaciones.esEmail("email", "El email no tiene el formato correcto"),
  ],
  (req, res) => authController.resendVerificationCode(req, res)
);

/* ============== VALIDACIONES ============== */

function loginValidaciones() {
  return [
    validaciones.estaVacio("email", "El email es obligatorio"),
    validaciones.esEmail("email", "El email no tiene el formato correcto"),
    validaciones.estaVacio("password", "La contraseña es obligatoria"),
  ];
}

function signupValidaciones() {
  return [
    validaciones.estaVacio("email", "El email es obligatorio"),
    validaciones.esEmail("email", "El email no tiene el formato correcto"),
    validaciones.estaVacio("password", "La contraseña es obligatoria"),
  ];
}

function verifyAccountValidaciones() {
  return [
    validaciones.estaVacio("email", "El email es obligatorio"),
    validaciones.esEmail("email", "El email no tiene el formato correcto"),
    validaciones.estaVacio("codigo", "El código de verificación es obligatorio"),
  ];
}

function recoverPasswordValidaciones() {
  return [
    validaciones.estaVacio("email", "El email es obligatorio"),
    validaciones.esEmail("email", "El email no tiene el formato correcto"),
  ];
}

function verifyRecoverPasswordValidaciones() {
  return [
    validaciones.estaVacio("email", "El email es obligatorio"),
    validaciones.esEmail("email", "El email no tiene el formato correcto"),
    validaciones.estaVacio("codigo", "El código es obligatorio"),
    validaciones.estaVacio("password", "La contraseña es obligatoria"),
  ];
}
