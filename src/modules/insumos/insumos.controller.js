import { response, request } from "express"
import { Insumo } from "./insumos.model.js"
import { filtros } from "../../utils/filtros.util.js"
import { CategoriaProducto } from "../categoria-insumos/categoria_insumos.model.js"

class InsumosController {
    async get(req = request, res = response) {
        try {
            const { offset, where, limit } = filtros.obtenerFiltros({
                busqueda: req.query.search,
                modelo: Insumo,
                pagina: req.query.page
            })

            const insumos = await Insumo.findAll({
                offset,
                limit,
                where,
                include: { 
                    model: CategoriaProducto,
                    attributes: ['id', 'nombre']
                },
                order: [['createdAt', 'DESC']]
            })
            
            const total = await Insumo.count({ where })

            return res.json({ insumos, total })
        } catch (error) {
            return res.status(400).json({
                mensaje: error.message
            })
        }
    }

    async getById(req = request, res = response) {
        try {
            const insumo = await Insumo.findByPk(req.params.id, {
                include: { 
                    model: CategoriaProducto,
                    attributes: ['id', 'nombre']
                }
            })
            
            if (!insumo) {
                return res.status(404).json({
                    mensaje: "Insumo no encontrado"
                })
            }
            
            return res.json({ insumo })
        } catch (error) {
            return res.status(400).json({
                mensaje: error.message
            })
        }
    }

    async getAll(req = request, res = response) {
        try {
            const insumos = await Insumo.findAll({ 
                include: { 
                    model: CategoriaProducto,
                    attributes: ['id', 'nombre']
                },
                order: [['createdAt', 'DESC']]
            })
            return res.json({ insumos })
        } catch (error) {
            return res.status(400).json({
                mensaje: error.message
            })
        }
    }

    async create(req = request, res = response) {
        try {
            const existeInsumoConMismoNombre = await Insumo.findOne({ 
                where: { nombre: req.body.nombre } 
            })
            
            if (existeInsumoConMismoNombre) {
                return res.status(400).json({
                    mensaje: "Ya existe un insumo con este nombre"
                })
            }

            const insumo = await Insumo.create(req.body)

            const insumoConCategoria = await Insumo.findByPk(insumo.id, {
                include: { 
                    model: CategoriaProducto,
                    attributes: ['id', 'nombre']
                }
            })

            return res.status(201).json({
                mensaje: "Insumo registrado correctamente",
                insumo: insumoConCategoria
            })

        } catch (error) {
            return res.status(400).json({
                mensaje: error.message
            })
        }
    }

    async update(req = request, res = response) {
        try {
            const insumoExiste = await Insumo.findByPk(req.params.id)
            if (!insumoExiste) {
                return res.status(404).json({
                    mensaje: "Insumo no encontrado"
                })
            }

            const existeInsumoConMismoNombre = await Insumo.findOne({ 
                where: { nombre: req.body.nombre } 
            })
            
            if (existeInsumoConMismoNombre && existeInsumoConMismoNombre.id !== req.params.id) {
                return res.status(400).json({
                    mensaje: "Ya existe un insumo con este nombre"
                })
            }

            await insumoExiste.update(req.body)

            const insumoActualizado = await Insumo.findByPk(req.params.id, {
                include: { 
                    model: CategoriaProducto,
                    attributes: ['id', 'nombre']
                }
            })

            return res.json({
                mensaje: "Insumo actualizado correctamente",
                insumo: insumoActualizado
            })

        } catch (error) {
            return res.status(400).json({
                mensaje: error.message
            })
        }
    }

    async delete(req = request, res = response) {
        try {
            const id = req.params.id
            const insumo = await Insumo.findByPk(id)
            
            if (!insumo) {
                return res.status(404).json({
                    mensaje: "Insumo no encontrado"
                })
            }

            await insumo.destroy()

            return res.json({
                mensaje: "Insumo eliminado correctamente",
                id
            })
            
        } catch (error) {
            return res.status(400).json({
                mensaje: error.message
            })
        }
    }

    async reducirCantidad(req = request, res = response) {
        try {
            const { id } = req.params
            const { cantidad } = req.body
            
            if (!cantidad || cantidad <= 0) {
                return res.status(400).json({
                    mensaje: "La cantidad debe ser mayor a cero"
                })
            }

            const insumo = await Insumo.findByPk(id)
            
            if (!insumo) {
                return res.status(404).json({
                    mensaje: "Insumo no encontrado"
                })
            }

            if (insumo.cantidad < cantidad) {
                return res.status(400).json({
                    mensaje: "No hay suficiente cantidad disponible"
                })
            }

            insumo.cantidad -= cantidad
            await insumo.save()

            return res.json({
                mensaje: "Cantidad reducida correctamente",
                insumo
            })

        } catch (error) {
            return res.status(400).json({
                mensaje: error.message
            })
        }
    }
}

export const insumosController = new InsumosController()