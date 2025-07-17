import { Model, DataTypes } from "sequelize";
import { sequelize } from "../../database.js";

export class CodigosVerificacion extends Model {}

CodigosVerificacion.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    usuarioID: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    codigo: {
      type: DataTypes.STRING(6),
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: "codigos_verificacion",
    tableName: "codigos_verificaciones", // ← YA lo tenías así
  }
);
