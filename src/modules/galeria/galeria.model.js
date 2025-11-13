/* =========================================================
   src/modules/galeria/galeria.model.js
   MODELO CON RELACIÓN A BARBEROS
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
      type: DataTypes.TEXT('long'),
      allowNull: false,
      comment: "URL de la imagen o video (puede ser base64 o URL externa)",
    },
    miniatura: {
      type: DataTypes.TEXT('long'),
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
    // ✅ NUEVO: Relación con barbero
    barberoID: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: "ID del barbero al que pertenece esta imagen/video",
      references: {
        model: 'barberos',
        key: 'id'
      }
    },
    // Usuario que subió el contenido
    creadoPor: {
      type: DataTypes.CHAR(36),
      allowNull: true,
      defaultValue: 'sistema',
      comment: "ID del usuario que creó el elemento",
    },
    // ✅ NUEVO: Para imagen destacada
    esDestacada: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Si es true, esta es la imagen que se muestra en la tarjeta principal",
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
      {
        fields: ["barberoID"],
      },
      {
        fields: ["esDestacada"],
      },
    ],
  }
);