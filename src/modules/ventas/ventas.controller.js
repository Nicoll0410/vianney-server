import { response, request } from "express";
import { Venta } from "./ventas.model.js";
import { Cita } from "../citas/citas.model.js";
import { Servicio } from "../servicios/servicios.model.js";
import { Barbero } from "../barberos/barberos.model.js";
import { Cliente } from "../clientes/clientes.model.js";

class VentasController {
  async get(req = request, res = response) {
    try {
      // Obtener todas las ventas desde la tabla de ventas
      const ventas = await Venta.findAll({
        order: [["fecha_venta", "DESC"]]
      });

      return res.json({
        ventas: ventas.map(v => ({
          id: v.id,
          citaID: v.citaID,
          cliente_nombre: v.cliente_nombre,
          barbero_nombre: v.barbero_nombre,
          servicio_nombre: v.servicio_nombre,
          servicio_precio: v.servicio_precio,
          fecha_cita: v.fecha_cita,
          hora_cita: v.hora_cita,
          fecha_venta: v.fecha_venta,
          total: v.total,
          estado: v.estado
        }))
      });
    } catch (error) {
      console.error("Error al obtener ventas:", error);
      return res.status(500).json({ error: "Error al obtener las ventas" });
    }
  }

  async create(req = request, res = response) {
    try {

      // Buscar la cita
      const cita = await Cita.findByPk(citaID, {
        include: [
          { 
            model: Servicio, 
            as: 'servicio',
            attributes: ['nombre', 'precio']
          },
          { 
            model: Barbero, 
            as: 'barbero',
            attributes: ['nombre']
          },
          { 
            model: Cliente, 
            as: 'cliente',
            attributes: ['nombre']
          }
        ]
      });

      if (!cita) {
        return res.status(404).json({ error: "Cita no encontrada" });
      }

      if (cita.estado === 'ConvertidaVenta') {
        return res.status(400).json({ error: "Esta cita ya fue convertida en venta" });
      }

      const total = Math.max(0, subtotal - (descuento || 0));

      // Crear la venta
      const venta = await Venta.create({
        citaID: cita.id,
        clienteID: cita.pacienteID,
        cliente_nombre: cita.cliente?.nombre || cita.pacienteTemporalNombre || 'Cliente no especificado',
        barberoID: cita.barberoID,
        barbero_nombre: cita.barbero?.nombre || 'Barbero no asignado',
        servicioID: cita.servicioID,
        servicio_nombre: cita.servicio?.nombre || 'Servicio no especificado',
        servicio_precio: cita.servicio?.precio || cita.precio || 0,
        fecha_cita: cita.fecha,
        hora_cita: cita.hora,
        total: total,
        estado: 'Completada'
      });

      // Actualizar la cita
      await cita.update({
        estado: 'ConvertidaVenta',
        ventaID: venta.id,
        total: total,
      });

      return res.status(201).json({
        mensaje: "Venta creada correctamente",
        venta: {
          id: venta.id,
          citaID: venta.citaID,
          cliente_nombre: venta.cliente_nombre,
          barbero_nombre: venta.barbero_nombre,
          servicio_nombre: venta.servicio_nombre,
          servicio_precio: venta.servicio_precio,
          fecha_cita: venta.fecha_cita,
          hora_cita: venta.hora_cita,
          fecha_venta: venta.fecha_venta,
          total: venta.total,
          estado: venta.estado
        }
      });
    } catch (error) {
      console.error("Error al crear venta:", error);
      return res.status(500).json({ error: "Error al crear la venta" });
    }
  }

  async update(req = request, res = response) {
    try {
      const { id } = req.params;
      const venta = await Venta.findByPk(id);
      
      if (!venta) {
        return res.status(404).json({ error: "Venta no encontrada" });
      }

      await venta.update(updates);

      // Si también existe la cita asociada, actualizarla
      if (venta.citaID) {
        const cita = await Cita.findByPk(venta.citaID);
        if (cita) {
          await cita.update({
            total: updates.total || cita.total,
          });
        }
      }

      return res.json({
        mensaje: "Venta actualizada correctamente",
        venta: venta
      });
    } catch (error) {
      console.error("Error al actualizar venta:", error);
      return res.status(500).json({ error: "Error al actualizar la venta" });
    }
  }

  async delete(req = request, res = response) {
    try {
      const { id } = req.params;

      const venta = await Venta.findByPk(id);
      
      if (!venta) {
        return res.status(404).json({ error: "Venta no encontrada" });
      }

      // Si existe la cita asociada, revertir su estado
      if (venta.citaID) {
        const cita = await Cita.findByPk(venta.citaID);
        if (cita) {
          await cita.update({
            estado: 'Completa', // O el estado que tenía antes de ser venta
            ventaID: null,
            total: cita.servicio?.precio || cita.precio || 0
          });
        }
      }

      await venta.destroy();

      return res.json({
        mensaje: "Venta eliminada correctamente"
      });
    } catch (error) {
      console.error("Error al eliminar venta:", error);
      return res.status(500).json({ error: "Error al eliminar la venta" });
    }
  }
}

export const ventasController = new VentasController();