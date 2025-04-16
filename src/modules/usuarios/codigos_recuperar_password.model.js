import { Model, DataTypes } from "sequelize"
import { sequelize } from "../../database.js";

export class CodigosRecuperarVerificacion extends Model { }

CodigosRecuperarVerificacion.init({
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    usuarioID: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    codigo:{
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    sequelize,
    modelName: "codigos_recuperar_verificaciones"
})