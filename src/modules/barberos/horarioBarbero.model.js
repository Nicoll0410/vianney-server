import { Model, DataTypes } from "sequelize";
import { sequelize } from "../../database.js";
import { Barbero } from "./barberos.model.js";

export class HorarioBarbero extends Model {}

HorarioBarbero.init({
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    barberoId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Barbero,
            key: 'id'
        }
    },
    diasLaborales: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: JSON.stringify({
            lunes: { activo: false, horas: [] },
            martes: { activo: false, horas: [] },
            miercoles: { activo: false, horas: [] },
            jueves: { activo: false, horas: [] },
            viernes: { activo: false, horas: [] },
            sabado: { activo: false, horas: [] },
            domingo: { activo: false, horas: [] }
        }),
        get() {
            const rawValue = this.getDataValue('diasLaborales');
            try {
                return typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
            } catch (e) {
                console.error('Error parsing diasLaborales:', e);
                return {
                    lunes: { activo: false, horas: [] },
                    martes: { activo: false, horas: [] },
                    miercoles: { activo: false, horas: [] },
                    jueves: { activo: false, horas: [] },
                    viernes: { activo: false, horas: [] },
                    sabado: { activo: false, horas: [] },
                    domingo: { activo: false, horas: [] }
                };
            }
        },
        set(value) {
            this.setDataValue('diasLaborales', JSON.stringify(value));
        }
    },
    horarioAlmuerzo: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {
            inicio: "13:00",
            fin: "14:00",
            activo: true
        },
        get() {
            const rawValue = this.getDataValue('horarioAlmuerzo');
            return typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
        },
        set(value) {
            const validatedValue = {
                inicio: value.inicio || "13:00",
                fin: value.fin || "14:00",
                activo: value.activo !== false
            };
            this.setDataValue('horarioAlmuerzo', JSON.stringify(validatedValue));
        }
    },
    excepciones: {
        type: DataTypes.JSON,
        defaultValue: [],
        get() {
            const rawValue = this.getDataValue('excepciones');
            return typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
        },
        set(value) {
            this.setDataValue('excepciones', JSON.stringify(value));
        }
    }
}, {
    sequelize,
    modelName: "horarioBarbero",
    timestamps: true
});

// Relación con Barbero
Barbero.hasOne(HorarioBarbero, { foreignKey: 'barberoId' });
HorarioBarbero.belongsTo(Barbero, { foreignKey: 'barberoId' });