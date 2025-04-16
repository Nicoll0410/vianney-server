import { Model, DataTypes } from "sequelize"
import { sequelize } from "../../database.js";

export class Insumo extends Model { }

Insumo.init({
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    nombre: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    descripcion: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    cantidad: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    unidadMedida: {
        type: DataTypes.ENUM("Kg", "Gr", "Lt", "Ml"),
        allowNull: false
    },
    categoriaID: {
        type: DataTypes.UUID,
        allowNull: false
    }
}, {
    sequelize,
    modelName: "insumo",
    hooks: {
        beforeValidate: (insumo) => {
            insumo.cantidad = 0
        }
    }
})