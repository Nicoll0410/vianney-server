import { Router } from 'express';
import { barberosController } from './barberos.controller.js';
import { validaciones } from '../../middlewares/validaciones.middleware.js';

export const barberosRouter = Router();

/* ---------- listar ---------- */
barberosRouter.get('/', barberosController.get);

/* ---------- obtener por ID ---------- */
barberosRouter.get('/by-id/:id', barberosController.getById);

/* ---------- crear ---------- */
barberosRouter.post(
  '/',
  [
    validaciones.estaVacio('nombre', 'El nombre debe de ser obligatorio', {
      max: 50
    }),
    validaciones.estaVacio(
      'telefono',
      'El telefono debe de ser obligatorio',
      { max: 10, esNumerico: true }
    ),
    validaciones.estaVacio(
      'cedula',
      'La cédula debe de ser obligatoria',
      { max: 10, esNumerico: true }
    ),
    validaciones.estaVacio(
      'fecha_nacimiento',
      'La fecha de nacimiento debe de ser obligatoria'
    ),
    validaciones.estaVacio(
      'fecha_de_contratacion',
      'La fecha de contratacion debe de ser obligatoria'
    ),
    validaciones.estaVacio('email', 'El email debe ser obligatorio', {
      max: 255
    }),
    validaciones.estaVacio('password', 'La contraseña debe de ser obligatoria', {
      max: 20
    })
  ],
  barberosController.create
);

/* ---------- actualizar ---------- */
barberosRouter.put(
  '/:id',
  [
    validaciones.estaVacio('nombre', 'El nombre debe de ser obligatorio', {
      max: 50
    }),
    validaciones.estaVacio(
      'telefono',
      'El telefono debe de ser obligatorio',
      { max: 10, esNumerico: true }
    ),
    validaciones.estaVacio(
      'cedula',
      'La cédula debe de ser obligatoria',
      { max: 10, esNumerico: true }
    ),
    validaciones.estaVacio(
      'fecha_nacimiento',
      'La fecha de nacimiento debe de ser obligatoria'
    ),
    validaciones.estaVacio(
      'fecha_de_contratacion',
      'La fecha de contratacion debe de ser obligatoria'
    ),
    validaciones.estaVacio('email', 'El email debe ser obligatorio', {
      max: 255
    })
  ],
  barberosController.update
);

/* ---------- eliminar ---------- */
barberosRouter.delete('/:id', barberosController.delete);
