import { Model, DataTypes } from "sequelize";
import { sequelize } from "../../database.js";

export class Rol extends Model {}

Rol.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    nombre: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    descripcion: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    avatar: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "https://i.postimg.cc/mDK0yP6M/svgviewer-png-output.png",
    },
    esEditable: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize,
    modelName: "rol",
    tableName: "roles",
    hooks: {
      beforeValidate(rol) {
        if (!rol.avatar) {
          rol.avatar = "https://i.postimg.cc/mDK0yP6M/svgviewer-png-output.png";
        }
      },
    },
  }
);

// Inicialización de roles al iniciar la aplicación
async function initializeRoles() {
  try {
    await sequelize.authenticate();
    
    const rolesBase = [
      {
        nombre: "Administrador",
        descripcion: "Administrador del sistema",
        avatar: "https://i.postimg.cc/mDK0yP6M/svgviewer-png-output.png",
        esEditable: false,
      },
      {
        nombre: "Barbero",
        descripcion: "Barbero del centro de belleza",
        avatar: "https://i.postimg.cc/vBtg4Ywf/peluqueria.png",
        esEditable: false,
      },
      {
        nombre: "Cliente",
        descripcion: "Clientes de la barbería",
        avatar: "https://i.postimg.cc/HLgRSJH1/svgviewer-png-output-1.png",
        esEditable: false,
      },
    ];

    for (const rol of rolesBase) {
      await Rol.findOrCreate({
        where: { nombre: rol.nombre },
        defaults: rol,
      });
    }

    console.log("✅ Roles base verificados/creados");
  } catch (error) {
    console.error("❌ Error inicializando roles:", error);
  }
}

// Ejecutar al cargar el modelo
initializeRoles();