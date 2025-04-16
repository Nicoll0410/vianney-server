import { Model, DataTypes } from "sequelize"
import { sequelize } from "../../database.js";

export class Compra extends Model { }

Compra.init({
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    fecha: {
        type: DataTypes.DATEONLY,
        allowNull: false,
    },
    metodo_pago: {
        type: DataTypes.ENUM('Efectivo', 'Transferencia'),
        allowNull: false,
    },
    costo: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    proveedorID: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    estaAnulado: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    }

}, {
    sequelize,
    modelName: "compra"
})