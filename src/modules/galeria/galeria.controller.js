/* =========================================================
   src/modules/galeria/galeria.controller.js
   VERSIÓN FINAL - Sin límites de caracteres
   ========================================================= */
import { request, response } from "express";
import { Galeria } from "./galeria.model.js";
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

      const item = await Galeria.findByPk(id);

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

      // ✅ DEBUG: Ver qué está llegando al backend
      console.log("🔍 DEBUG - Datos recibidos en create:");
      console.log("Título:", titulo);
      console.log("Tipo:", tipo);
      console.log("URL length:", url ? url.length : 0);
      console.log("Miniatura length:", miniatura ? miniatura.length : 0);

      // Validaciones básicas SOLO de existencia
      if (!titulo || !titulo.trim()) {
        return res.status(400).json({
          success: false,
          mensaje: "El título es obligatorio",
        });
      }

      if (!url) {
        return res.status(400).json({
          success: false,
          mensaje: "La URL es obligatoria",
        });
      }

      if (!tipo) {
        return res.status(400).json({
          success: false,
          mensaje: "El tipo es obligatorio",
        });
      }

      if (!["imagen", "video"].includes(tipo)) {
        return res.status(400).json({
          success: false,
          mensaje: "El tipo debe ser 'imagen' o 'video'",
        });
      }

      // Validar que el usuario está autenticado
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          mensaje: "Usuario no autenticado",
        });
      }

      console.log("🔧 Intentando crear en BD...");

      // Crear el elemento - SIN VALIDACIONES DE LONGITUD
      const nuevoItem = await Galeria.create({
        titulo: titulo.trim(),
        descripcion: descripcion ? descripcion.trim() : null,
        tipo,
        url, // ✅ ACEPTA CUALQUIER LONGITUD (LONGTEXT)
        miniatura: miniatura || null,
        orden: orden || 0,
        etiquetas: etiquetas || null,
        activo: activo !== undefined ? activo : true,
        creadoPor: req.user.id,
      });

      console.log("✅ ÉXITO - Elemento creado en BD:", nuevoItem.id);

      return res.status(201).json({
        success: true,
        mensaje: "Elemento agregado a la galería exitosamente",
        data: nuevoItem,
      });
    } catch (error) {
      console.error("❌ ERROR en galeria.create:", error);
      
      // ✅ DEBUG: Error detallado
      console.log("🔴 DEBUG - Error completo:", {
        name: error.name,
        message: error.message,
        parent: error.parent,
        original: error.original
      });

      // Manejo específico de errores de base de datos
      if (error.name === 'SequelizeDatabaseError') {
        return res.status(400).json({
          success: false,
          mensaje: "Error de base de datos. Contacta al administrador.",
        });
      }
      
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

      console.log("🔍 DEBUG - Datos recibidos en update para ID:", id);
      console.log("URL length:", url ? url.length : 0);

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

      // Actualizar campos - SIN VALIDACIONES DE LONGITUD
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
      const { items } = req.body;

      if (!Array.isArray(items)) {
        return res.status(400).json({
          success: false,
          mensaje: "Se requiere un array de items",
        });
      }

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