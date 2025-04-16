import { Model, DataTypes } from "sequelize"
import { sequelize } from "../../database.js";

export class ServiciosPorInsumos extends Model { }

ServiciosPorInsumos.init({
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    servicioID: {
        type: DataTypes.UUID,
        allowNull: false
    },
    insumoID: {
        type: DataTypes.UUID,
        allowNull: false
    },
    unidades: {
        type: DataTypes.INTEGER,
        allowNull: false
    }
}, {
    sequelize,
    modelName: "servicios_por_insumo"
})