import { Model, DataTypes, Op } from "sequelize";
import { sequelize } from "../../database.js";
import { format, sub } from "date-fns";
import cron from "node-cron";

export class Cita extends Model { }

Cita.init({
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    pacienteID: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'clientes',
            key: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
    },
    pacienteTemporalNombre: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
            notEmpty: {
                msg: "El nombre del cliente temporal no puede estar vacío",
                args: true
            },
            len: {
                args: [2, 50],
                msg: "El nombre debe tener entre 2 y 50 caracteres"
            }
        }
    },
    pacienteTemporalTelefono: {
        type: DataTypes.STRING(10),
        allowNull: true,
        validate: {
            is: {
                args: /^[0-9]{10}$/,
                msg: "El teléfono debe tener 10 dígitos numéricos"
            }
        }
    },
    barberoID: {
        type: DataTypes.UUID,
        allowNull: false
    },
    servicioID: {
        type: DataTypes.UUID,
        allowNull: false
    },
    direccion: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    fecha: {
        type: DataTypes.DATEONLY,
        allowNull: false,
    },
    fechaFormateada: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    hora: {
        type: DataTypes.TIME,
        allowNull: false,
    },
    horaFin: {
        type: DataTypes.TIME,
        allowNull: false,
    },
    estado: {
        type: DataTypes.ENUM("Cancelada", "Expirada", "Completa", "Pendiente"),
        allowNull: false,
        defaultValue: "Pendiente"
    }
}, {
    sequelize,
    modelName: "cita",
    hooks: {
        beforeValidate: (cita) => {
            if (cita.isNewRecord) {
                cita.estado = "Pendiente";
            }

            const fecha = new Date(`${cita.fecha}T00:00:00-05:00`);

            cita.fechaFormateada = fecha.toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
        }
    }
});

// Añadir método estático para verificar disponibilidad
Cita.verificarDisponibilidad = async function(barberoID, fecha, hora) {
  // Verificar si ya existe una cita en ese horario
  const citaExistente = await this.findOne({
    where: {
      barberoID: barberoID,
      fecha: fecha,
      hora: hora
    }
  });

  return !citaExistente;
};

const task = cron.schedule('* * * * *', async () => {
    try {
        const threeDaysAgo = format(sub(new Date(), { days: 3 }), 'yyyy-MM-dd');
        const citasPendientes = await Cita.findAll({
            where: {
                estado: "Pendiente",
                fecha: {
                    [Op.lte]: threeDaysAgo
                }
            }
        });

        if (citasPendientes.length > 0) {
            citasPendientes.forEach(async cita => {
                cita.estado = "Expirada";
                await cita.save();
            });
        }

    } catch (error) {
        console.log(error);
    }
}, {
    scheduled: false
});

export default Cita;
