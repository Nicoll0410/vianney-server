import { Router } from "express";
import { citasController } from "./citas.controller.js";
import { validaciones } from "../../middlewares/validaciones.middleware.js";


export const citasRouter = Router()


citasRouter.get("/", citasController.get)
citasRouter.get("/all", citasController.getAll)
citasRouter.get("/by-barber", citasController.getByBarberID)
citasRouter.get("/sells", citasController.getSells)
citasRouter.get("/get-information-to-create", citasController.getInformationToCreate)
citasRouter.get("/get-availability-of-barber", citasController.getAvailabilityOfBarber)
citasRouter.get("/patient-dates", citasController.getPatientDates)
citasRouter.get("/diary", citasController.getDiary)
citasRouter.get("/available-services-by-hour", citasController.getAvailableServices)

citasRouter.post("/", [
    validaciones.estaVacio("pacienteID", "El id del paciente es obligatorio"),
    validaciones.estaVacio("barberoID", "El id del barbero es obligatorio"),
    validaciones.estaVacio("servicioID", "El id del servicio es obligatorio"),
    validaciones.estaVacio("fecha", "La fecha  es obligatorio"),
    validaciones.estaVacio("hora", "La hora es obligatoria")
], citasController.create)

citasRouter.post("/by-patient", [
    validaciones.estaVacio("barberoID", "El id del barbero es obligatorio"),
    validaciones.estaVacio("servicioID", "El id del servicio es obligatorio"),
    validaciones.estaVacio("fecha", "La fecha  es obligatorio"),
    validaciones.estaVacio("hora", "La hora es obligatoria")
], citasController.createByPatient)

citasRouter.put("/:id", [
    validaciones.estaVacio("pacienteID", "El id del paciente es obligatorio"),
    validaciones.estaVacio("barberoID", "Este id es obligatorio"),
    validaciones.estaVacio("servicioID", "Este id es obligatorio"),
    validaciones.estaVacio("fecha", "La fecha  es obligatorio"),
    validaciones.estaVacio("hora", "La hora es obligatoria")
], citasController.update)

citasRouter.put("/cancel-date/:id", [validaciones.estaVacio("razon", "La razón de la cancelación es obligatoria")],citasController.cancelDate)
citasRouter.put("/confirm-date/:id",citasController.confirmDate)
citasRouter.put("/expire-date/:id",citasController.expireDate)


citasRouter.delete("/:id", citasController.delete)