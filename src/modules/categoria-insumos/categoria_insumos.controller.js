import { response, request } from "express"
import { CategoriaProducto } from "./categoria_insumos.model.js"
import { Insumo } from "../insumos/insumos.model.js"
import { filtros } from "../../utils/filtros.util.js"
import { fn, col } from "sequelize"

class Categorias_ProductosController {
    async get(req = request, res = response) {
        try {
            const { offset, where, limit } = filtros.obtenerFiltros({ 
                busqueda: req.query.search, 
                modelo: CategoriaProducto, 
                pagina: req.query.page 
            })

            const categorias = await CategoriaProducto.findAll({
                offset, 
                limit, 
                where,
                attributes: {
                    include: [
                        [fn('COUNT', col('insumos.id')), 'insumosAsociados']
                    ]
                },
                include: [
                    {
                        model: Insumo,
                        attributes: [],
                        required: false // Esto permite mostrar categorías sin insumos
                    }
                ],
                group: ['categorias_insumo.id'],
                subQuery: false
            })

            const total = await CategoriaProducto.count({ where })
            return res.json({ categorias, total })
        } catch (error) {
            console.error('Error en get categorías:', error)
            return res.status(400).json({
                mensaje: error.message
            })
        }
    }

    async getAll(req = request, res = response) {
        try {
            const categorias = await CategoriaProducto.findAll({
                attributes: {
                    include: [
                        [fn('COUNT', col('insumos.id')), 'insumosAsociados']
                    ]
                },
                include: [
                    {
                        model: Insumo,
                        attributes: [],
                        required: false
                    }
                ],
                group: ['categorias_insumo.id']
            })
            
            return res.json({ categorias })
        } catch (error) {
            console.error('Error en getAll categorías:', error)
            return res.status(400).json({
                mensaje: error.message
            })
        }
    }

    async getById(req = request, res = response) {
        try {
            const categoria = await CategoriaProducto.findByPk(req.params.id, {
                include: [{
                    model: Insumo,
                    attributes: ['id', 'nombre']
                }],
                attributes: {
                    include: [
                        [fn('COUNT', col('insumos.id')), 'insumosAsociados']
                    ]
                },
                group: ['categorias_insumo.id']
            })
            
            if (!categoria) {
                return res.status(404).json({
                    mensaje: "Categoría no encontrada"
                })
            }
            
            return res.json({ categoria })
        } catch (error) {
            console.error('Error en getById categoría:', error)
            return res.status(400).json({
                mensaje: error.message
            })
        }
    }

    async create(req = request, res = response) {
        try {
            const existeCategoriaPorNombre = await CategoriaProducto.findOne({ 
                where: { nombre: req.body.nombre } 
            })
            if (existeCategoriaPorNombre) {
                throw new Error("Ups, parece que ya existe una categoría con este nombre")
            }

            const categoria = await CategoriaProducto.create(req.body)

            return res.status(201).json({
                mensaje: "Categoria de producto registrada correctamente",
                categoria: {
                    ...categoria.get({ plain: true }),
                    insumosAsociados: 0
                }
            })

        } catch (error) {
            console.error('Error en create categoría:', error)
            return res.status(400).json({
                mensaje: error.message
            })
        }
    }

    async update(req = request, res = response) {
        try {
            const categoriaExistente = await CategoriaProducto.findByPk(req.params.id)
            if (!categoriaExistente) {
                throw new Error("Ups, parece que no encontramos esta categoria de producto")
            }

            const existeCategoriaPorNombre = await CategoriaProducto.findOne({ 
                where: { nombre: req.body.nombre } 
            })
            if (existeCategoriaPorNombre && existeCategoriaPorNombre.id !== req.params.id) {
                throw new Error("Ups, parece que ya existe una categoría con este nombre")
            }

            await categoriaExistente.update(req.body)
            
            // Obtener la categoría actualizada con el conteo de insumos
            const categoriaActualizada = await CategoriaProducto.findByPk(req.params.id, {
                include: [{
                    model: Insumo,
                    attributes: [],
                    required: false
                }],
                attributes: {
                    include: [
                        [fn('COUNT', col('insumos.id')), 'insumosAsociados']
                    ]
                },
                group: ['categorias_insumo.id']
            })

            return res.json({
                mensaje: "Categoria del producto actualizada correctamente",
                categoria: categoriaActualizada
            })

        } catch (error) {
            console.error('Error en update categoría:', error)
            return res.status(400).json({
                mensaje: error.message
            })
        }
    }

    async delete(req = request, res = response) {
        try {
            const id = req.params.id;
            
            // Verificar si la categoría existe
            const categoria = await CategoriaProducto.findByPk(id);
            if (!categoria) {
                return res.status(404).json({
                    success: false,
                    message: "Categoría no encontrada"
                });
            }

            // Verificar si hay insumos asociados
            const insumosAsociados = await Insumo.count({ 
                where: { categoriaId: id } 
            });
            
            if (insumosAsociados > 0) {
                return res.status(400).json({
                    success: false,
                    message: "No se puede eliminar: existen insumos asociados a esta categoría"
                });
            }

            // Eliminar la categoría
            await categoria.destroy();

            return res.json({
                success: true,
                message: "Categoría eliminada correctamente",
                deletedId: id
            });

        } catch (error) {
            console.error('Error al eliminar categoría:', error);
            return res.status(500).json({
                success: false,
                message: "Error interno del servidor al eliminar categoría",
                error: error.message
            });
        }
    }
}

export const categoriasProductosController = new Categorias_ProductosController()