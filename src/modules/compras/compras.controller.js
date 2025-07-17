/* ──────────────────────────────────────────────────────────────
   src/modules/compras/compras.controller.js
   Ajustes:
   1)  Importamos sequelize para poder usar literal() y las transacciones.
   2)  El incremento de stock se hace ahora con un UPDATE atómico
       (sequelize.literal) para evitar condiciones de carrera.
   3)  Todo el código queda dentro de la misma transacción.
──────────────────────────────────────────────────────────────── */

import { request, response } from "express";
import { sequelize } from "../../database.js";              // ← 1️⃣  NUEVO
import { Compra } from "./compras.model.js";
import { DetalleCompra } from "./detalles_compras.model.js";
import { Insumo } from "../insumos/insumos.model.js";
import { filtros } from "../../utils/filtros.util.js";
import { Proveedor } from "../proveedores/proveedores.model.js";
import { CategoriaProducto } from "../categoria-insumos/categoria_insumos.model.js";

export class ComprasController {
  /* LISTA paginada (sin insumos) */
  async get(req = request, res = response) {
    try {
      const { offset, where, limit, order } = filtros.obtenerFiltros({
        busqueda: req.query.search,
        modelo: Compra,
        pagina: req.query.page,
      });

      const compras = await Compra.findAll({
        offset,
        where,
        limit,
        order,
        include: { model: Proveedor, as: "proveedor" },
      });

      const total = await Compra.count({ where });
      return res.json({ compras, total });
    } catch (error) {
      return res.status(400).json({ mensaje: error.message });
    }
  }

  /* LISTA sin paginación (sin insumos) */
  async getAllWithSearch(req = request, res = response) {
    try {
      const { where, order } = filtros.obtenerFiltros({
        busqueda: req.query.search,
        modelo: Compra,
        pagina: req.query.page,
      });

      const compras = await Compra.findAll({
        where,
        order,
        include: { model: Proveedor, as: "proveedor" },
      });

      const total = await Compra.count({ where });
      return res.json({ compras, total });
    } catch (error) {
      return res.status(400).json({ mensaje: error.message });
    }
  }

  /* DETALLE por ID (con insumos) */
  async getByID(req = request, res = response) {
    try {
      const compra = await Compra.findByPk(req.params.id, {
        include: [
          { model: Proveedor, as: "proveedor", attributes: ["nombre", "tipo"] },
          {
            model: DetalleCompra,
            as: "productos",
            attributes: ["cantidad", "precio_unitario"],
            include: [
              {
                model: Insumo,
                as: "insumo",
                attributes: ["nombre"],
                include: {
                  model: CategoriaProducto,
                  attributes: ["avatar"],
                },
              },
            ],
          },
        ],
      });

      if (!compra) throw new Error("Ups, parece que esta compra no existe");
      return res.json(compra);
    } catch (error) {
      return res.status(400).json({ mensaje: error.message });
    }
  }

  /* CREAR */
  async create(req = request, res = response) {
    const t = await sequelize.transaction();
    try {
      const { insumos: insumosOriginales } = req.body;

      if (!insumosOriginales || !Array.isArray(insumosOriginales) || insumosOriginales.length === 0) {
        throw new Error("Debes adjuntar al menos un insumo para registrar la compra");
      }

      /* 1. Calcular costo total */
      const costo = insumosOriginales.reduce(
        (acc, { cantidad, precio_unitario }) =>
          acc + Number(precio_unitario) * Number(cantidad),
        0
      );

      /* 2. Crear la compra */
      const compra = await Compra.create({ ...req.body, costo }, { transaction: t });

      /* 3. Crear detalles de compra */
      await DetalleCompra.bulkCreate(
        insumosOriginales.map(({ id, ...rest }) => ({
          ...rest,
          insumoID: id,
          compraID: compra.id,
        })),
        { transaction: t }
      );

      /* 4. Incrementar stock de cada insumo – UPDATE atómico */
      await Promise.all(
        insumosOriginales.map(({ id, cantidad }) =>
          Insumo.update(
            { cantidad: sequelize.literal(`cantidad + ${cantidad}`) },
            { where: { id }, transaction: t }
          )
        )
      );

      /* 5. Confirmar la transacción */
      await t.commit();

      /* 6. Devolver la compra con proveedor para refrescar el front */
      const compraConProveedor = await Compra.findByPk(compra.id, {
        include: { model: Proveedor, as: "proveedor" },
      });

      return res.status(201).json({
        mensaje: "Compra registrada correctamente",
        compra: compraConProveedor,
      });
    } catch (error) {
      await t.rollback();
      return res.status(400).json({ mensaje: error.message });
    }
  }

  /* ANULAR */
  async cancel(req = request, res = response) {
    try {
      const compra = await Compra.findByPk(req.params.id);
      if (!compra) throw new Error("Compra no encontrada");
      if (compra.estaAnulado) throw new Error("Ya estaba anulada");

      await compra.update({ estaAnulado: true });

      const detalles = await DetalleCompra.findAll({
        where: { compraID: compra.id },
      });

      await Promise.all(
        detalles.map(({ insumoID, cantidad }) =>
          Insumo.update(
            { cantidad: sequelize.literal(`cantidad - ${cantidad}`) },
            { where: { id: insumoID } }
          )
        )
      );

      return res.json({ mensaje: "Compra anulada correctamente" });
    } catch (error) {
      return res.status(400).json({ mensaje: error.message });
    }
  }
}

export const comprasController = new ComprasController();
