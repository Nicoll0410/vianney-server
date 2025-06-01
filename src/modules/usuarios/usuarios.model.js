import { Model, DataTypes } from "sequelize"
import { sequelize } from "../../database.js";

export class Usuario extends Model { }

Usuario.init({
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    email: {
        type: DataTypes.STRING(80),
        unique: "email",
        allowNull: false,
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false,
        get() {
            return this.getDataValue("password");
        }
    },
    estaVerificado: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    rolID: {
        type: DataTypes.UUID,
        allowNull: false
    }
}, {
    sequelize,
    modelName: "usuario",
    tableName: "usuarios",
    hooks: {
        beforeValidate: (user) => {
            user.rol = "Paciente"
        }
    }
})
