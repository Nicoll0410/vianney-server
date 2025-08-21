import { DataTypes } from "sequelize";
import { sequelize } from "../../database.js";
import { Usuario } from "../usuarios/usuarios.model.js";

export const Notificacion = sequelize.define(
  "Notificacion",
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
    titulo: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    cuerpo: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    leido: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "notificaciones",
  }
);

// Relación con usuarios
Usuario.hasMany(Notificacion, { foreignKey: "usuarioID" });
Notificacion.belongsTo(Usuario, { foreignKey: "usuarioID" });
