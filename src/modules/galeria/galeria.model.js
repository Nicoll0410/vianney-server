/* =========================================================
   src/modules/galeria/galeria.model.js
   MODELO CORREGIDO - Sin límites para URLs base64 y sin autenticación requerida
   ========================================================= */
import { Model, DataTypes } from "sequelize";
import { sequelize } from "../../database.js";

export class Galeria extends Model {}

Galeria.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    titulo: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    tipo: {
      type: DataTypes.ENUM("imagen", "video"),
      allowNull: false,
      defaultValue: "imagen",
    },
    url: {
      type: DataTypes.TEXT('long'),  // ← LONGTEXT para MySQL (hasta 4GB)
      allowNull: false,
      comment: "URL de la imagen o video (puede ser base64 o URL externa)",
    },
    miniatura: {
      type: DataTypes.TEXT('long'),  // ← LONGTEXT para MySQL
      allowNull: true,
      comment: "Miniatura para videos o versión comprimida de imágenes",
    },
    orden: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Orden de visualización en la galería",
    },
    activo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    // Usuario que subió el contenido - AHORA PERMITE NULL
    creadoPor: {
      type: DataTypes.CHAR(36),
      allowNull: true, // ← CAMBIADO DE false A true
      defaultValue: 'sistema', // ← VALOR POR DEFECTO
      comment: "ID del usuario que creó el elemento",
    },
    // Metadatos adicionales
    etiquetas: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Etiquetas para categorizar (ej: corte, barba, productos)",
    },
  },
  {
    sequelize,
    modelName: "galeria",
    tableName: "galeria",
    timestamps: true,
    indexes: [
      {
        fields: ["tipo"],
      },
      {
        fields: ["activo"],
      },
      {
        fields: ["orden"],
      },
    ],
  }
);