import { Model, DataTypes, Op } from "sequelize";
import { sequelize } from "../../database.js";
import { format, sub } from "date-fns";
import cron from "node-cron";

export class Cita extends Model {}

Cita.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    pacienteID: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "clientes",
        key: "id",
      },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    pacienteTemporalNombre: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        notEmpty: {
          msg: "El nombre del cliente temporal no puede estar vacío",
          args: true,
        },
        len: {
          args: [2, 50],
          msg: "El nombre debe tener entre 2 y 50 caracteres",
        },
      },
    },
    pacienteTemporalTelefono: {
      type: DataTypes.STRING(10),
      allowNull: true,
      validate: {
        is: {
          args: /^[0-9]{10}$/,
          msg: "El teléfono debe tener 10 dígitos numéricos",
        },
      },
    },
    barberoID: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    servicioID: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    direccion: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "En barbería",
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
    duracionReal: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    duracionRedondeada: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    estado: {
      type: DataTypes.ENUM("Cancelada", "Expirada", "Completa", "Pendiente", "Confirmada"),
      allowNull: false,
      defaultValue: "Confirmada", // Este debe coincidir con el ENUM
    },
  },
  {
    sequelize,
    modelName: "cita",
    tableName: "cita",
    hooks: {
      beforeValidate: (cita) => {
        if (cita.isNewRecord) {
          cita.estado = "Confirmada";
        }

        const fecha = new Date(`${cita.fecha}T00:00:00-05:00`);

        cita.fechaFormateada = fecha.toLocaleDateString("es-ES", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
      },
    },
  }
);

// Método para verificar disponibilidad mejorado
Cita.verificarDisponibilidad = async function (barberoID, fecha, hora, duracionMinutos = 30) {
  const [horaH, horaM] = hora.split(":").map(Number);
  const horaFinM = (horaM + duracionMinutos) % 60;
  const horaFinH = horaH + Math.floor((horaM + duracionMinutos) / 60);
  const horaFin = `${horaFinH.toString().padStart(2, "0")}:${horaFinM.toString().padStart(2, "0")}:00`;

  const citaExistente = await this.findOne({
    where: {
      barberoID,
      fecha,
      [Op.or]: [
        {
          hora: {
            [Op.lt]: horaFin,
            [Op.gte]: hora,
          },
        },
        {
          horaFin: {
            [Op.gt]: hora,
            [Op.lte]: horaFin,
          },
        },
        {
          [Op.and]: [
            { hora: { [Op.lte]: hora } },
            { horaFin: { [Op.gte]: horaFin } },
          ],
        },
      ],
    },
  });

  return !citaExistente;
};

// Tarea programada para expirar citas pendientes antiguas
const task = cron.schedule(
  "* * * * *", // Ejecutar cada minuto
  async () => {
    try {
      const ahora = new Date();
      const fechaActual = format(ahora, "yyyy-MM-dd");
      const horaActual = format(ahora, "HH:mm:ss");

      // Buscar citas confirmadas que ya pasaron su hora
      const citasParaCompletar = await Cita.findAll({
        where: {
          estado: "Confirmada",
          [Op.or]: [
            {
              fecha: {
                [Op.lt]: fechaActual,
              },
            },
            {
              [Op.and]: [
                { fecha: fechaActual },
                { horaFin: { [Op.lte]: horaActual } },
              ],
            },
          ],
        },
      });

      if (citasParaCompletar.length > 0) {
        await Cita.update(
          { estado: "Completa" },
          {
            where: {
              id: {
                [Op.in]: citasParaCompletar.map((c) => c.id),
              },
            },
          }
        );
        
        console.log(`Se completaron ${citasParaCompletar.length} citas automáticamente`);
      }
    } catch (error) {
      console.error("Error en tarea programada de citas:", error);
    }
  },
  {
    scheduled: false,
  }
);

export default Cita;