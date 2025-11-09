/* =========================================================
   src/modules/galeria/galeria.controller.js
   Controlador para gestionar la galería de fotos y videos
   ========================================================= */
import { request, response } from "express";
import { Galeria } from "./galeria.model.js";
import { Usuario } from "../usuarios/usuarios.model.js";
import { filtros } from "../../utils/filtros.util.js";
import { Op } from "sequelize";

class GaleriaController {
  /* ───────────── Listar todos (público y privado) ───────────── */
  async get(req = request, res = response) {
    try {
      const { tipo, activo, search } = req.query;

      // Construir filtros
      const where = {};

      if (tipo && ["imagen", "video"].includes(tipo)) {
        where.tipo = tipo;
      }

      if (activo !== undefined) {
        where.activo = activo === "true";
      }

      if (search) {
        where[Op.or] = [
          { titulo: { [Op.like]: `%${search}%` } },
          { descripcion: { [Op.like]: `%${search}%` } },
        ];
      }

      const items = await Galeria.findAll({
        where,
        order: [
          ["orden", "ASC"],
          ["createdAt", "DESC"],
        ],
        include: [
          {
            model: Usuario,
            as: "creador",
            attributes: ["id", "nombre", "email"],
          },
        ],
      });

      const total = items.length;

      return res.json({
        success: true,
        data: items,
        total,
      });
    } catch (error) {
      console.error("Error en galeria.get:", error);
      return res.status(400).json({
        success: false,
        mensaje: error.message,
      });
    }
  }

  /* ───────────── Obtener solo los activos (para clientes) ───────────── */
  async getActivos(req = request, res = response) {
    try {
      const { tipo } = req.query;

      const where = { activo: true };

      if (tipo && ["imagen", "video"].includes(tipo)) {
        where.tipo = tipo;
      }

      const items = await Galeria.findAll({
        where,
        order: [
          ["orden", "ASC"],
          ["createdAt", "DESC"],
        ],
        attributes: [
          "id",
          "titulo",
          "descripcion",
          "tipo",
          "url",
          "miniatura",
          "orden",
          "etiquetas",
          "createdAt",
        ],
      });

      return res.json({
        success: true,
        data: items,
        total: items.length,
      });
    } catch (error) {
      console.error("Error en galeria.getActivos:", error);
      return res.status(400).json({
        success: false,
        mensaje: error.message,
      });
    }
  }

  /* ─────────────── Buscar uno por ID ─────────────── */
  async findByPk(req = request, res = response) {
    try {
      const { id } = req.params;

      const item = await Galeria.findByPk(id, {
        include: [
          {
            model: Usuario,
            as: "creador",
            attributes: ["id", "nombre", "email"],
          },
        ],
      });

      if (!item) {
        return res.status(404).json({
          success: false,
          mensaje: "Elemento no encontrado",
        });
      }

      return res.json({
        success: true,
        data: item,
      });
    } catch (error) {
      console.error("Error en galeria.findByPk:", error);
      return res.status(400).json({
        success: false,
        mensaje: error.message,
      });
    }
  }

  /* ─────────────── Crear ─────────────── */
  async create(req = request, res = response) {
    try {
      const { titulo, descripcion, tipo, url, miniatura, orden, etiquetas, activo } =
        req.body;

      // Validaciones
      if (!titulo || !url || !tipo) {
        return res.status(400).json({
          success: false,
          mensaje: "El título, URL y tipo son obligatorios",
        });
      }

      if (!["imagen", "video"].includes(tipo)) {
        return res.status(400).json({
          success: false,
          mensaje: "El tipo debe ser 'imagen' o 'video'",
        });
      }

      // Verificar que el usuario está autenticado
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          mensaje: "Usuario no autenticado",
        });
      }

      // Crear el elemento
      const nuevoItem = await Galeria.create({
        titulo,
        descripcion: descripcion || null,
        tipo,
        url,
        miniatura: miniatura || null,
        orden: orden || 0,
        etiquetas: etiquetas || null,
        activo: activo !== undefined ? activo : true,
        creadoPor: req.user.id,
      });

      return res.status(201).json({
        success: true,
        mensaje: "Elemento agregado a la galería exitosamente",
        data: nuevoItem,
      });
    } catch (error) {
      console.error("Error en galeria.create:", error);
      return res.status(400).json({
        success: false,
        mensaje: error.message,
      });
    }
  }

  /* ─────────────── Actualizar ─────────────── */
  async update(req = request, res = response) {
    try {
      const { id } = req.params;
      const { titulo, descripcion, tipo, url, miniatura, orden, etiquetas, activo } =
        req.body;

      const item = await Galeria.findByPk(id);

      if (!item) {
        return res.status(404).json({
          success: false,
          mensaje: "Elemento no encontrado",
        });
      }

      // Validar tipo si se está actualizando
      if (tipo && !["imagen", "video"].includes(tipo)) {
        return res.status(400).json({
          success: false,
          mensaje: "El tipo debe ser 'imagen' o 'video'",
        });
      }

      // Actualizar campos
      const updateData = {};
      if (titulo !== undefined) updateData.titulo = titulo;
      if (descripcion !== undefined) updateData.descripcion = descripcion;
      if (tipo !== undefined) updateData.tipo = tipo;
      if (url !== undefined) updateData.url = url;
      if (miniatura !== undefined) updateData.miniatura = miniatura;
      if (orden !== undefined) updateData.orden = orden;
      if (etiquetas !== undefined) updateData.etiquetas = etiquetas;
      if (activo !== undefined) updateData.activo = activo;

      await item.update(updateData);

      return res.json({
        success: true,
        mensaje: "Elemento actualizado exitosamente",
        data: item,
      });
    } catch (error) {
      console.error("Error en galeria.update:", error);
      return res.status(400).json({
        success: false,
        mensaje: error.message,
      });
    }
  }

  /* ─────────────── Eliminar ─────────────── */
  async delete(req = request, res = response) {
    try {
      const { id } = req.params;

      const item = await Galeria.findByPk(id);

      if (!item) {
        return res.status(404).json({
          success: false,
          mensaje: "Elemento no encontrado",
        });
      }

      await item.destroy();

      return res.json({
        success: true,
        mensaje: "Elemento eliminado de la galería exitosamente",
      });
    } catch (error) {
      console.error("Error en galeria.delete:", error);
      return res.status(400).json({
        success: false,
        mensaje: error.message,
      });
    }
  }

  /* ─────────────── Reordenar elementos ─────────────── */
  async reordenar(req = request, res = response) {
    try {
      const { items } = req.body; // Array de { id, orden }

      if (!Array.isArray(items)) {
        return res.status(400).json({
          success: false,
          mensaje: "Se requiere un array de items",
        });
      }

      // Actualizar el orden de cada elemento
      const promises = items.map((item) =>
        Galeria.update({ orden: item.orden }, { where: { id: item.id } })
      );

      await Promise.all(promises);

      return res.json({
        success: true,
        mensaje: "Orden actualizado exitosamente",
      });
    } catch (error) {
      console.error("Error en galeria.reordenar:", error);
      return res.status(400).json({
        success: false,
        mensaje: error.message,
      });
    }
  }

  /* ─────────────── Cambiar estado activo ─────────────── */
  async toggleActivo(req = request, res = response) {
    try {
      const { id } = req.params;

      const item = await Galeria.findByPk(id);

      if (!item) {
        return res.status(404).json({
          success: false,
          mensaje: "Elemento no encontrado",
        });
      }

      await item.update({ activo: !item.activo });

      return res.json({
        success: true,
        mensaje: `Elemento ${item.activo ? "activado" : "desactivado"} exitosamente`,
        data: item,
      });
    } catch (error) {
      console.error("Error en galeria.toggleActivo:", error);
      return res.status(400).json({
        success: false,
        mensaje: error.message,
      });
    }
  }
}

export const galeriaController = new GaleriaController();