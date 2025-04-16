import { Model, DataTypes } from "sequelize"
import { sequelize } from "../../database.js";

export class Servicio extends Model { }

Servicio.init({
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    nombre: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    descripcion: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    duracionMaxima: {
        type: DataTypes.TIME,
        allowNull: false,
    },
    duracionMaximaConvertido: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    precio: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
}, {
    sequelize,
    modelName: "servicio"
})