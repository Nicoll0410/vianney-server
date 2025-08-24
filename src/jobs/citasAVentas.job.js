import cron from "node-cron";
import { Op } from "sequelize";
import { format } from "date-fns";
import { Cita } from "../modules/citas/citas.model.js";
import { Venta } from "../modules/ventas/ventas.model.js";
import { Servicio } from "../modules/servicios/servicios.model.js";
import { Barbero } from "../modules/barberos/barberos.model.js";
import { Cliente } from "../modules/clientes/clientes.model.js";

export class CitasAVentasJob {
    static iniciar() {
        // Job que se ejecuta cada 5 minutos
        cron.schedule('*/5 * * * *', async () => {
            try {
                console.log('🔄 Ejecutando job de conversión de citas a ventas...');
                
                const ahora = new Date();
                const fechaActual = format(ahora, 'yyyy-MM-dd');
                const horaActual = format(ahora, 'HH:mm:ss');

                // Buscar citas confirmadas que ya pasaron su hora
                const citasParaConvertir = await Cita.findAll({
                    where: {
                        estado: 'Confirmada',
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
                    include: [
                        {
                            model: Servicio,
                            as: 'servicio',
                            attributes: ['nombre', 'precio']
                        },
                        {
                            model: Barbero,
                            as: 'barbero',
                            attributes: ['nombre']
                        },
                        {
                            model: Cliente,
                            as: 'cliente',
                            attributes: ['nombre']
                        }
                    ]
                });

                let contador = 0;

                for (const cita of citasParaConvertir) {
                    try {
                        // Crear la venta
                        const venta = await Venta.create({
                            citaID: cita.id,
                            clienteID: cita.pacienteID,
                            cliente_nombre: cita.cliente?.nombre || cita.pacienteTemporalNombre || 'Cliente no especificado',
                            barberoID: cita.barberoID,
                            barbero_nombre: cita.barbero?.nombre || 'Barbero no asignado',
                            servicioID: cita.servicioID,
                            servicio_nombre: cita.servicio?.nombre || 'Servicio no especificado',
                            servicio_precio: cita.servicio?.precio || cita.precio || 0,
                            fecha_cita: cita.fecha,
                            hora_cita: cita.hora,
                            total: (cita.servicio?.precio || cita.precio || 0),
                        });

                        // Actualizar la cita
                        await cita.update({
                            estado: 'ConvertidaVenta',
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
                }

            } catch (error) {
                console.error('❌ Error en job de conversión de citas:', error);
            }
        });

        console.log('✅ Job de conversión de citas a ventas programado');
    }
}