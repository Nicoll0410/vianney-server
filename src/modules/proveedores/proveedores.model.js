import { Model, DataTypes } from "sequelize"
import { sequelize } from "../../database.js";

export class Proveedor extends Model { }

Proveedor.init({
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    identificacion: {
        type: DataTypes.STRING(10),
        allowNull: false,
        unique: true
    },
    nombre: {
        type: DataTypes.STRING(50),
        allowNull: false,
    },
    nombreContacto: {
        type: DataTypes.STRING(50),
        allowNull: false,
    },
    email: {
        type: DataTypes.STRING(80),
        allowNull: false,
    },
    telefono: {
        type: DataTypes.STRING(10),
        allowNull: false,
    },
    tipo: {
        type: DataTypes.ENUM(["Persona", "Empresa"]),
        allowNull: false,
    },
    tipoDocumento: {
        type: DataTypes.ENUM(["CC", "NIT", "CE"]),
        allowNull: false,
    },

}, {
    sequelize,
    modelName: "proveedor",
    tableName: "proveedores"
})