import { Model, DataTypes, Op } from "sequelize"
import { sequelize } from "../../database.js";
import { format, sub } from "date-fns";
import cron from "node-cron"

export class Cita extends Model { }

Cita.init({
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    pacienteID: {
        type: DataTypes.UUID,
        allowNull: false
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
        type: DataTypes.ENUM(["Cancelada", "Expirada", "Completa", "Pendiente"]),
        allowNull: false
    },

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
})


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
                cita.estado = "Expirada"
                await cita.save()
            })
        }

    } catch (error) {
        console.log(error);
    }
}, {
    scheduled: false
});