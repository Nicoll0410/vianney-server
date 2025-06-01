import { response, request } from "express"
import { Proveedor } from "./proveedores.model.js"
import { filtros } from "../../utils/filtros.util.js"
import { Compra } from "../compras/compras.model.js"

class ProveedoresController {
    async get(req = request, res = response) {
        try {
            const { offset, where, limit, order } = filtros.obtenerFiltros({ busqueda: req.query.search, modelo: Proveedor, pagina: req.query.page })
            const proveedores = await Proveedor.findAll({ offset, limit, where, order })
            const total = await Proveedor.count({ offset, where })
            return res.json({ proveedores, total })

        } catch (error) {
            return res.status(400).json({
                mensaje: error.message
            })
        }
    }
    async getAllWithSearch(req = request, res = response) {
        try {
            const { where, order } = filtros.obtenerFiltros({ busqueda: req.query.search, modelo: Proveedor, pagina: req.query.page })
            const proveedores = await Proveedor.findAll({ where, order })
            const total = await Proveedor.count({ where })
            return res.json({ proveedores, total })
        } catch (error) {
            return res.status(400).json({
                mensaje: error.message
            })
        }
    }

    async getAll(req = request, res = response) {
        try {
            const proveedores = await Proveedor.findAll()
            return res.json({ proveedores })
        } catch (error) {
            return res.status(400).json({
                mensaje: error.message
            })
        }
    }


    async create(req = request, res = response) {
        try {
            const existeProveedorPorIdentificacion = await Proveedor.findOne({ where: { identificacion: req.body.identificacion } })
            if (existeProveedorPorIdentificacion) throw new Error("Ups, parece que ya existe un proveedor con esta identificación")

            const proveedor = await Proveedor.create(req.body)


            return res.status(201).json({
                mensaje: "Proveedor registrado correctamente",
                proveedor
            })

        } catch (error) {
            return res.status(400).json({
                mensaje: error.message
            })
        }
    }

    async update(req = request, res = response) {
        try {
            const { id } = req.params
            const proveedorExiste = await Proveedor.findByPk(id)
            if (!proveedorExiste) throw new Error("Ups, parece que no encontramos este usuario")

            const existeProveedorPorIdentificacion = await Proveedor.findOne({ where: { identificacion: req.body.identificacion } })

            if (existeProveedorPorIdentificacion && existeProveedorPorIdentificacion.id !== id) throw new Error("Ups, parece que ya existe un proveedor con esta identificación")

            const proveedorActualizado = await proveedorExiste.update(req.body)

            return res.json({
                mensaje: "Proveedor actualizado correctamente",
                proveedorActualizado
            })

        } catch (error) {
            return res.status(400).json({
                mensaje: error.message
            })
        }
    }

    async byId(req = request, res = response) {
        try {
            const { id } = req.params

            console.log({ id });


            const proveedor = await Proveedor.findByPk(id)
            if (!proveedor) throw new Error("Ups, parece que no encontramos este usuario")


            return res.json({
                proveedor
            })

        } catch (error) {
            console.log({ error });

            return res.status(400).json({
                mensaje: error.message
            })
        }
    }


    async delete(req = request, res = response) {
        try {

            const id = req.params.id
            const proveedor = await Proveedor.findByPk(id)
            if (!proveedor) throw new Error("Ups, parece que no encontramos este usuario")

            const tieneCompras = await Compra.findAll({ where: { proveedorID: proveedor.id } })
            console.log({tieneCompras});
            if (tieneCompras.length > 0) throw new Error("No puedes eliminar este proveedor, este tiene compras asociadas")

            const proveedorEliminado = await proveedor.destroy({
                where: { id }
            })

            return res.json({
                mensaje: "Proveedor eliminado correctamente",
                proveedorEliminado
            })
        } catch (error) {
            return res.status(400).json({
                mensaje: error.message
            })
        }
    }
}

export const proveedoresController = new ProveedoresController()