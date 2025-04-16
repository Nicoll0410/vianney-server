import { Model, DataTypes } from "sequelize";
import { sequelize } from "../../database.js";

export class Permiso extends Model { }

Permiso.init({
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    nombre: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
    },
    descripcion: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    ruta: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    orden: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
}, {
    sequelize,
    modelName: "permiso",
    tableName: "permisos"
});

async function initializePermissions() {
    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');

        const existingPermissions = await Permiso.count();
        if (existingPermissions > 0) return;

        const defaultPermissions = [
            {
                nombre: "Dashboard",
                ruta: "/dashboard/home",
                descripcion: "Visualiza la información general y rendimientos de la barberia",
                orden: 1
            },
            {
                nombre: "Pacientes",
                ruta: "/dashboard/pacientes",
                descripcion: "Gestiona la información de los clientes",
                orden: 2
            },
            {
                nombre: "Agenda",
                ruta: "/dashboard/agenda",
                descripcion: "Gestiona la agenda",
                orden: 3
            },
            {
                nombre: "Citas",
                ruta: "/dashboard/citas",
                descripcion: "Gestiona las citas",
                orden: 4
            },
            {
                nombre: "Mis Citas",
                ruta: "/dashboard/mis-citas",
                descripcion: "Gestiona tus citas",
                orden: 5
            },
            {
                nombre: "Barberos",
                ruta: "/dashboard/barberos",
                descripcion: "Gestiona la información de los barberos",
                orden: 6
            },
            {
                nombre: "Servicios",
                ruta: "/dashboard/servicios",
                descripcion: "Gestiona los servicios ofrecidos de la barberia",
                orden: 7
            },
            {
                nombre: "Compras",
                ruta: "/dashboard/compras",
                descripcion: "Gestiona las compras realizadas",
                orden: 8
            },
            {
                nombre: "Proveedores",
                ruta: "/dashboard/proveedores",
                descripcion: "Gestiona la información de los proveedores",
                orden: 9
            },
            {
                nombre: "Insumos",
                ruta: "/dashboard/insumos",
                descripcion: "Gestiona los insumos disponibles",
                orden: 10
            },
            {
                nombre: "Categoría de Insumos",
                ruta: "/dashboard/categoria-insumos",
                descripcion: "Gestiona las categorías de insumos",
                orden: 11
            },
            {
                nombre: "Movimientos",
                ruta: "/dashboard/movimientos",
                descripcion: "Visualiza los movimientos de insumos",
                orden: 12
            },
            {
                nombre: "Ventas",
                ruta: "/dashboard/ventas",
                descripcion: "Visualiza las ventas realizadas",
                orden: 13
            },
            {
                nombre: "Control de Insumos",
                ruta: "/dashboard/control-insumos",
                descripcion: "Gestiona el control de insumos",
                orden: 14
            },
            {
                nombre: "Roles",
                ruta: "/dashboard/roles",
                descripcion: "Gestiona los roles y sus permisos",
                orden: 15
            }
        ];

        await Permiso.bulkCreate(defaultPermissions);
        console.log('Permisos inicializados correctamente');
    } catch (error) {
        console.error('Error initializing Permiso:', error);
    }
}

// initializePermissions();