import { response, request } from "express";
import { Compra } from "./compras.model.js";
import { DetalleCompra } from "./detalles_compras.model.js";
import { Insumo } from "../insumos/insumos.model.js";
import { filtros } from "../../utils/filtros.util.js";
import { Proveedor } from "../proveedores/proveedores.model.js";
import { CategoriaProducto } from "../categoria-insumos/categoria_insumos.model.js";

export class ComprasController {
    async get(req = request, res = response) {
        try {
            const { offset, where, limit, order } = filtros.obtenerFiltros({ busqueda: req.query.search, modelo: Compra, pagina: req.query.page })
            const compras = await Compra.findAll({ offset, where, limit, order, include: { model: Proveedor, as: "proveedor" } });

            const total = await Compra.count({ where })
            return res.json({ compras, total });
        } catch (error) {
            return res.status(400).json({
                mensaje: error.message
            });
        }
    }

    async getAllWithSearch(req = request, res = response) {
        try {
            const { where, order,  } = filtros.obtenerFiltros({ busqueda: req.query.search, modelo: Compra, pagina: req.query.page })
            const compras = await Compra.findAll({ where, order, include: { model: Proveedor, as: "proveedor" } });

            console.log(compras.length);

            const total = await Compra.count({ where })
            return res.json({ compras, total });
        } catch (error) {
            return res.status(400).json({
                mensaje: error.message
            });
        }
    }

    async getByID(req = request, res = response) {
        try {
            const compra = await Compra.findByPk(req.params.id, {
                include: [
                    { model: Proveedor, as: "proveedor", attributes: ["nombre", "tipo"] },
                    {
                        model: DetalleCompra,
                        attributes: ["cantidad", "precio_unitario"],
                        include: [
                            {
                                model: Insumo,
                                attributes: ["nombre"],
                                include: {
                                    model: CategoriaProducto,
                                    attributes: ["avatar"]
                                }
                            }
                        ]
                    }
                ]
            });

            if (!compra) throw new Error("Ups, parece que esta compra no existe")

            return res.json(compra);
        } catch (error) {
            return res.status(400).json({
                mensaje: error.message
            });
        }
    }

    async create(req = request, res = response) {
        const { insumos: insumosOriginales } = req.body;

        const costo = insumosOriginales.reduce((acc, { cantidad, precio_unitario }) => {
            console.log({ acc, precio_unitario });

            return acc + Number(precio_unitario)
        }, 0);

        console.log({costo});

        const compra = await Compra.create({ ...req.body, costo });

        const insumosFormateados = insumosOriginales.map(({ id, ...insumo }) => ({
            ...insumo,
            insumoID: id,
            compraID: compra.id
        }));

        const insumos = await DetalleCompra.bulkCreate(insumosFormateados);


        await Promise.all(
            insumosOriginales.map(async ({ id, cantidad }) => {
                const insumo = await Insumo.findByPk(id);
                if (!insumo) throw new Error("Ups! No pudimos encontrar este insumo");

                return insumo.increment({ cantidad });
            })
        );



        return res.status(201).json({
            mensaje: 'Compra registrada correctamente',
            compra,
            insumos
        });
    }

    async cancel(req = request, res = response) {
        try {
            const compra = await Compra.findByPk(req.params.id);
            if (!compra) throw new Error("Ups, parece que no encontramos esta compra");
            if (compra.estaAnulado) throw new Error("Ups, parece que esta compra ya se encuentra anulada");

            await compra.update({ estaAnulado: true });

            const detallesDeCompra = await DetalleCompra.findAll({ where: { compraID: compra.id } });

            await Promise.all(
                detallesDeCompra.map(async ({ insumoID, cantidad }) => {
                    const insumo = await Insumo.findByPk(insumoID);
                    return insumo.decrement({ cantidad });
                })
            );

            return res.json({
                mensaje: "Compra anulada correctamente",
            });

        } catch (error) {
            return res.status(400).json({
                mensaje: error.message
            });
        }
    }
}

export const comprasController = new ComprasController()