import { response, request } from "express";
import { Cita } from "../citas/citas.model.js";
import { Servicio } from "../servicios/servicios.model.js";
import { Barbero } from "../barberos/barberos.model.js";
import { Cliente } from "../clientes/clientes.model.js";

class VentasController {
  async get(req = request, res = response) {
    try {
      // Obtener todas las citas completadas (ventas)
      const ventas = await Cita.findAll({
        where: { estado: "Completa" },
        include: [
          {
            model: Servicio,
            as: "servicio",
            attributes: ["nombre", "precio"]
          },
          {
            model: Barbero,
            as: "barbero",
            attributes: ["nombre"]
          },
          {
            model: Cliente,
            as: "cliente",
            attributes: ["nombre"]
          }
        ],
        order: [["fecha", "DESC"]]
      });

      return res.json({
        ventas: ventas.map(v => ({
          id: v.id,
          cliente: { nombre: v.cliente?.nombre || "Cliente no especificado" },
          barbero: { nombre: v.barbero?.nombre || "Barbero no asignado" },
          servicio: { 
            nombre: v.servicio?.nombre || "Servicio no especificado",
            precio: v.servicio?.precio || 0
          },
          comentarios: v.comentarios || "",
          fecha: v.fecha,
          hora: v.hora,
          descuento: v.descuento || "0%",
          total: v.total || v.servicio?.precio || 0
        }))
      });
    } catch (error) {
      console.error("Error al obtener ventas:", error);
      return res.status(500).json({ error: "Error al obtener las ventas" });
    }
  }

  create(req = request, res = response) {
    return res.status(201).json({
      mensaje: "Venta creada correctamente",
    });
  }

  update(req = request, res = response) {
    return res.json({
      mensaje: "Venta actualizada correctamente",
    });
  }

  delete(req = request, res = response) {
    return res.json({
      mensaje: "Venta eliminada correctamente",
    });
  }
}

export const ventasController = new VentasController();