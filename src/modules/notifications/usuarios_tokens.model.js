import { DataTypes } from "sequelize";
import { sequelize } from "../../database.js";
import { Usuario } from "../usuarios/usuarios.model.js";

export const UsuarioToken = sequelize.define("UsuarioToken", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  usuarioID: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  token: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  dispositivo: {
    type: DataTypes.STRING,
  },
  sistemaOperativo: {
    type: DataTypes.STRING,
  },
}, {
  tableName: "usuarios_tokens",
});

Usuario.hasMany(UsuarioToken, { foreignKey: "usuarioID" });
UsuarioToken.belongsTo(Usuario, { foreignKey: "usuarioID" });