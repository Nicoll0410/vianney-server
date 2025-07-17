import { Model, DataTypes } from "sequelize";
import { sequelize } from "../../database.js";

export class Usuario extends Model {}

Usuario.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING(80),
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    estaVerificado: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    rolID: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: "usuario",
    tableName: "usuarios",
  }
);
