import { response, request } from "express";
import { Rol } from "./roles.model.js";
import { filtros } from "../../utils/filtros.util.js";
import { fn, col, Op } from "sequelize";

import { Usuario } from "../usuarios/usuarios.model.js"
import { RolesPorPermisos } from "./roles_por_permisos.js";
import { Permiso } from "./permisos.model.js";

class RolesController {
    async get(req = request, res = response) {
        try {
            const { offset, limit, where, order } = filtros.obtenerFiltros({ busqueda: req.query.search, modelo: Rol, pagina: req.query.page })

            const roles = await Rol.findAll({
                offset,
                limit,
                where,
                order,
                attributes: {
                    include: [
                        [fn("COUNT", col("usuarios.id")), "usuariosAsociados"]
                    ]
                },
                include: [
                    {
                        model: Usuario,
                        attributes: [],
                    },
                ],
                group: ['rol.id'],
                subQuery: false
            });


            const total = await Rol.count();
            return res.json({ roles, total });
        } catch (error) {
            return res.status(400).json({
                mensaje: error.message
            });
        }
    }

    async getWorkersRoles(req = request, res = response) {
        try {
            const roles = await Rol.findAll({ where: {
                nombre: {
                    [Op.not]: ["Paciente"]
                }
            } });

            return res.json({ roles });
        } catch (error) {
            return res.status(400).json({
                mensaje: error.message
            });
        }
    }

    async getAll(req = request, res = response) {
        try {
            const roles = await Rol.findAll({});
            return res.json({ roles });
        } catch (error) {
            return res.status(400).json({ mensaje: error.message });
        }
    }

    async getPermissions(req = request, res = response) {
        try {
            const permisos = await Permiso.findAll({});
            return res.json({ permisos });
        } catch (error) {
            return res.status(400).json({ mensaje: error.message });
        }
    }

    async getPermissionsFromRole(req = request, res = response) {
        try {
            const permisos = await RolesPorPermisos.findAll({
                where: { rolID: req.params.id },
                include: Permiso
            });
            return res.json({ permisos });
        } catch (error) {
            return res.status(400).json({ mensaje: error.message });
        }
    }



    async create(req = request, res = response) {
        try {
            const rolExistePorNombre = await Rol.findOne({ where: { nombre: req.body.nombre } });
            if (rolExistePorNombre) throw new Error("Ups, parece que ya existe un rol con este nombre");


            const rol = await Rol.create(req.body);
            const rolesPorPermisos = req.body.permisos.map(id => ({ rolID: rol.id, permisoID: id }))
            await RolesPorPermisos.bulkCreate(rolesPorPermisos)

            return res.status(201).json({
                mensaje: "Rol creado correctamente",
                rol,

            });
        } catch (error) {
            console.log({ error });
            return res.status(400).json({
                mensaje: error.message
            });
        }
    }

    async update(req = request, res = response) {
        try {
            const rolExistente = await Rol.findByPk(req.params.id);
            if (!rolExistente) throw new Error("Ups, parece que no encontramos este rol");

            const rolExistePorNombre = await Rol.findOne({ where: { nombre: req.body.nombre } });
            if (rolExistePorNombre && rolExistePorNombre.id !== req.params.id) throw new Error("Ups, parece que ya existe un rol con este nombre");


            const rolActualizado = await rolExistente.update(req.body);
            await RolesPorPermisos.destroy({ where: { rolID: rolActualizado.id } })


            const rolesPorPermisos = req.body.permisos.map(id => ({ rolID: rolActualizado.id, permisoID: id }))
            await RolesPorPermisos.bulkCreate(rolesPorPermisos)

            return res.json({
                mensaje: "Rol actualizado correctamente",
                rolActualizado
            });
        } catch (error) {
            return res.status(400).json({
                mensaje: error.message
            });
        }
    }

    async delete(req = request, res = response) {
        try {
            const rol = await Rol.findByPk(req.params.id);
            if (!rol) throw new Error("Ups, parece que no encontramos este rol");

            await RolesPorPermisos.destroy({ where: { rolID: req.params.id } })
            const rolEliminado = await rol.destroy();

            return res.json({
                mensaje: "Rol eliminado correctamente",
                rolEliminado
            });
        } catch (error) {
            return res.status(400).json({
                mensaje: error.message
            });
        }
    }
}

export const rolesController = new RolesController();
