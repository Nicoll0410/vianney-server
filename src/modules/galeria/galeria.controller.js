/* =========================================================
   src/modules/galeria/galeria.controller.js
   CONTROLADOR CON MÉTODOS PARA GALERÍA POR BARBERO
   ========================================================= */
import { request, response } from "express";
import { Galeria } from "./galeria.model.js";
import { Barbero } from "../barberos/barberos.model.js";
import { Op } from "sequelize";

class GaleriaController {
  /* ───────────── Listar todos ───────────── */
  async get(req = request, res = response) {
    try {
      const { tipo, activo, search, barberoID } = req.query;

      const where = {};

      if (tipo && ["imagen", "video"].includes(tipo)) {
        where.tipo = tipo;
      }

      if (activo !== undefined) {
        where.activo = activo === "true";
      }

      if (barberoID) {
        where.barberoID = barberoID;
      }

      if (search) {
        where[Op.or] = [
          { titulo: { [Op.like]: `%${search}%` } },
          { descripcion: { [Op.like]: `%${search}%` } },
        ];
      }

      const items = await Galeria.findAll({
        where,
        include: [
          {
            model: Barbero,
            as: "barbero",
            attributes: ["id", "nombre", "avatar", "telefono"],
          },
        ],
        order: [
          ["orden", "ASC"],
          ["createdAt", "DESC"],
        ],
      });

      return res.json({
        success: true,
        data: items,
        total: items.length,
      });
    } catch (error) {
      console.error("Error en galeria.get:", error);
      return res.status(400).json({
        success: false,
        mensaje: error.message,
      });
    }
  }

  /* ───────────── ✅ NUEVO: Obtener galería agrupada por barberos (VISTA PRINCIPAL) ───────────── */
  async getPorBarberos(req = request, res = response) {
    try {
      // 1. Obtener todos los barberos
      const barberos = await Barbero.findAll({
        attributes: ["id", "nombre", "avatar", "telefono", "cedula"],
        order: [["nombre", "ASC"]],
      });

      // 2. Para cada barbero, obtener su imagen destacada y contar total de items
      const barberosConGaleria = await Promise.all(
        barberos.map(async (barbero) => {
          // Obtener imagen destacada
          const imagenDestacada = await Galeria.findOne({
            where: {
              barberoID: barbero.id,
              activo: true,
              esDestacada: true,
            },
          });

          // Si no hay destacada, tomar la primera activa
          const imagenPrincipal =
            imagenDestacada ||
            (await Galeria.findOne({
              where: {
                barberoID: barbero.id,
                activo: true,
              },
              order: [["orden", "ASC"]],
            }));

          // Contar total de items activos
          const totalItems = await Galeria.count({
            where: {
              barberoID: barbero.id,
              activo: true,
            },
          });

          return {
            barbero: barbero.toJSON(),
            imagenPrincipal: imagenPrincipal ? imagenPrincipal.toJSON() : null,
            totalItems,
          };
        })
      );

      // 3. Filtrar solo barberos que tienen al menos una imagen
      const barberosConImagenes = barberosConGaleria.filter(
        (item) => item.totalItems > 0
      );

      return res.json({
        success: true,
        data: barberosConImagenes,
        total: barberosConImagenes.length,
      });
    } catch (error) {
      console.error("Error en galeria.getPorBarberos:", error);
      return res.status(400).json({
        success: false,
        mensaje: error.message,
      });
    }
  }

  /* ───────────── ✅ NUEVO: Obtener toda la galería de UN barbero específico ───────────── */
  async getByBarbero(req = request, res = response) {
    try {
      const { barberoID } = req.params;
      const { tipo } = req.query;

      // Verificar que el barbero existe
      const barbero = await Barbero.findByPk(barberoID, {
        attributes: ["id", "nombre", "avatar", "telefono", "cedula"],
      });

      if (!barbero) {
        return res.status(404).json({
          success: false,
          mensaje: "Barbero no encontrado",
        });
      }

      const where = {
        barberoID,
        activo: true,
      };

      if (tipo && ["imagen", "video"].includes(tipo)) {
        where.tipo = tipo;
      }

      const items = await Galeria.findAll({
        where,
        order: [
          ["esDestacada", "DESC"], // Destacadas primero
          ["orden", "ASC"],
          ["createdAt", "DESC"],
        ],
      });

      return res.json({
        success: true,
        data: {
          barbero: barbero.toJSON(),
          galeria: items,
          total: items.length,
        },
      });
    } catch (error) {
      console.error("Error en galeria.getByBarbero:", error);
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
            model: Barbero,
            as: "barbero",
            attributes: ["id", "nombre", "avatar", "telefono"],
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
      const {
        titulo,
        descripcion,
        tipo,
        url,
        miniatura,
        orden,
        etiquetas,
        activo,
        barberoID,
        esDestacada,
      } = req.body;

      // Validaciones básicas
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

      if (!tipo || !["imagen", "video"].includes(tipo)) {
        return res.status(400).json({
          success: false,
          mensaje: "El tipo debe ser 'imagen' o 'video'",
        });
      }

      // ✅ Validar que se proporcionó barberoID
      if (!barberoID) {
        return res.status(400).json({
          success: false,
          mensaje: "Debes seleccionar un barbero",
        });
      }

      // Verificar que el barbero existe
      const barbero = await Barbero.findByPk(barberoID);
      if (!barbero) {
        return res.status(400).json({
          success: false,
          mensaje: "El barbero seleccionado no existe",
        });
      }

      // Si se marca como destacada, quitar la destacada anterior de ese barbero
      if (esDestacada) {
        await Galeria.update(
          { esDestacada: false },
          { where: { barberoID, esDestacada: true } }
        );
      }

      const creadoPorId =
        req.user && req.user.id ? req.user.id : "sistema";

      // Crear el elemento
      const nuevoItem = await Galeria.create({
        titulo: titulo.trim(),
        descripcion: descripcion ? descripcion.trim() : null,
        tipo,
        url,
        miniatura: miniatura || null,
        orden: orden || 0,
        etiquetas: etiquetas || null,
        activo: activo !== undefined ? activo : true,
        barberoID,
        esDestacada: esDestacada || false,
        creadoPor: creadoPorId,
      });

      return res.status(201).json({
        success: true,
        mensaje: "Elemento agregado a la galería exitosamente",
        data: nuevoItem,
      });
    } catch (error) {
      console.error("❌ ERROR en galeria.create:", error);
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
      const {
        titulo,
        descripcion,
        tipo,
        url,
        miniatura,
        orden,
        etiquetas,
        activo,
        barberoID,
        esDestacada,
      } = req.body;

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

      // Si se cambia el barberoID, verificar que existe
      if (barberoID && barberoID !== item.barberoID) {
        const barbero = await Barbero.findByPk(barberoID);
        if (!barbero) {
          return res.status(400).json({
            success: false,
            mensaje: "El barbero seleccionado no existe",
          });
        }
      }

      // Si se marca como destacada, quitar otras destacadas del mismo barbero
      if (esDestacada && !item.esDestacada) {
        const barberoIdFinal = barberoID || item.barberoID;
        await Galeria.update(
          { esDestacada: false },
          { where: { barberoID: barberoIdFinal, esDestacada: true } }
        );
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
      if (barberoID !== undefined) updateData.barberoID = barberoID;
      if (esDestacada !== undefined) updateData.esDestacada = esDestacada;

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

  /* ───────────── ✅ NUEVO: Marcar/desmarcar como destacada ───────────── */
  async toggleDestacada(req = request, res = response) {
    try {
      const { id } = req.params;

      const item = await Galeria.findByPk(id);

      if (!item) {
        return res.status(404).json({
          success: false,
          mensaje: "Elemento no encontrado",
        });
      }

      // Si se va a marcar como destacada, quitar otras destacadas del mismo barbero
      if (!item.esDestacada) {
        await Galeria.update(
          { esDestacada: false },
          { where: { barberoID: item.barberoID, esDestacada: true } }
        );
      }

      await item.update({ esDestacada: !item.esDestacada });

      return res.json({
        success: true,
        mensaje: `Imagen ${
          item.esDestacada ? "marcada" : "desmarcada"
        } como destacada`,
        data: item,
      });
    } catch (error) {
      console.error("Error en galeria.toggleDestacada:", error);
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
        mensaje: `Elemento ${
          item.activo ? "activado" : "desactivado"
        } exitosamente`,
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