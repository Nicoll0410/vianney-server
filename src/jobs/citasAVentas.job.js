import cron from "node-cron";
import { Op } from "sequelize";
import { format } from "date-fns";
import { Cita } from "../modules/citas/citas.model.js";
import { Venta } from "../modules/ventas/ventas.model.js";
import { Servicio } from "../modules/servicios/servicios.model.js";
import { Barbero } from "../modules/barberos/barberos.model.js";
import { Cliente } from "../modules/clientes/clientes.model.js";

export class CitasAVentasJob {
    static async iniciar() {
        // Job que se ejecuta cada 5 minutos
        cron.schedule('*/5 * * * *', async () => {
            try {
                console.log('🔄 Ejecutando job de conversión de citas a ventas...');
                
                const ahora = new Date();
                const fechaActual = format(ahora, 'yyyy-MM-dd');
                const horaActual = format(ahora, 'HH:mm:ss');

                // Buscar citas confirmadas que ya pasaron su hora FINAL
                const citasParaConvertir = await Cita.findAll({
                    where: {
                        estado: 'Confirmada',
                        [Op.or]: [
                            {
                                fecha: {
                                    [Op.lt]: fechaActual, // Días anteriores
                                },
                            },
                            {
                                [Op.and]: [
                                    { fecha: fechaActual }, // Mismo día
                                    { horaFin: { [Op.lte]: horaActual } }, // ← CORREGIDO: horaFin en lugar de hora
                                ],
                            },
                        ],
                    },
                    include: [
                        {
                            model: Servicio,
                            as: 'servicio',
                            attributes: ['id', 'nombre', 'precio']
                        },
                        {
                            model: Barbero,
                            as: 'barbero',
                            attributes: ['id', 'nombre']
                        },
                        {
                            model: Cliente,
                            as: 'cliente',
                            attributes: ['id', 'nombre']
                        }
                    ]
                });

                let contador = 0;

                for (const cita of citasParaConvertir) {
                    try {
                        // Verificar si ya existe una venta para esta cita
                        const ventaExistente = await Venta.findOne({
                            where: { citaID: cita.id }
                        });

                        if (ventaExistente) {
                            console.log(`⚠️ Venta ya existe para cita ${cita.id}`);
                            continue;
                        }

                        // Crear la venta
                        const venta = await Venta.create({
                            citaID: cita.id,
                            clienteID: cita.clienteID || cita.cliente?.id,
                            cliente_nombre: cita.cliente?.nombre || cita.pacienteTemporalNombre || 'Cliente no especificado',
                            barberoID: cita.barberoID || cita.barbero?.id,
                            barbero_nombre: cita.barbero?.nombre || 'Barbero no asignado',
                            servicioID: cita.servicioID || cita.servicio?.id,
                            servicio_nombre: cita.servicio?.nombre || 'Servicio no especificado',
                            servicio_precio: cita.servicio?.precio || cita.precio || 0,
                            fecha_cita: cita.fecha,
                            hora_cita: cita.hora,
                            total: (cita.servicio?.precio || cita.precio || 0),
                            estado: 'Completada'
                        });

                        // Actualizar la cita
                        await cita.update({
                            estado: 'Completa', // Cambiado a 'Completa' para coincidir con el dashboard
                            ventaID: venta.id
                        });

                        contador++;
                        console.log(`✅ Cita ${cita.id} convertida a venta ${venta.id}`);

                    } catch (error) {
                        console.error(`❌ Error convirtiendo cita ${cita.id}:`, error);
                    }
                }

                if (contador > 0) {
                    console.log(`📊 Se convirtieron ${contador} citas a ventas`);
                } else {
                    console.log('📊 No hay citas para convertir en este momento');
                }

            } catch (error) {
                console.error('❌ Error en job de conversión de citas:', error);
            }
        });

        console.log('✅ Job de conversión de citas a ventas programado');
    }
}