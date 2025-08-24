import { Model, DataTypes } from "sequelize";
import { sequelize } from "../../database.js";

export class Venta extends Model {}

Venta.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    citaID: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "cita",
        key: "id",
      },
      unique: true
    },
    clienteID: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "clientes",
        key: "id",
      },
    },
    cliente_nombre: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    barberoID: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    barbero_nombre: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    servicioID: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    servicio_nombre: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    servicio_precio: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    fecha_venta: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    fecha_cita: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    hora_cita: {
      type: DataTypes.TIME,
      allowNull: false,
    },
    total: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    estado: {
      type: DataTypes.ENUM("Completada", "Cancelada"),
      defaultValue: "Completada",
    }
  },
  {
    sequelize,
    modelName: "venta",
    tableName: "venta",
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
);

// Asociaciones
Venta.associate = function(models) {
  Venta.belongsTo(models.Cita, {
    foreignKey: 'cita_id',
    as: 'cita'
  });
};

export default Venta;