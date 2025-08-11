import { Op, Sequelize } from "sequelize";
import { Cita } from "../citas/citas.model.js";
import { Compra } from "../compras/compras.model.js";
import { Proveedor } from "../proveedores/proveedores.model.js";
import { Barbero } from "../barberos/barberos.model.js";
import { Usuario } from "../usuarios/usuarios.model.js";
import { Rol } from "../roles/roles.model.js";
import { Servicio } from "../servicios/servicios.model.js";
import { format, subMonths, startOfMonth } from "date-fns";

export class DashboardController {
    get = async (req, res) => {
        try {
            /* ── últimos 8 meses ──────────────────────── */
            const monthsList = [...Array(8).keys()]
                .map(i => format(subMonths(startOfMonth(new Date()), i), "yyyy-MM"))
                .reverse();

            const monthMap = {
                "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril",
                "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto",
                "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre"
            };

            /* ──────────────────────────────────────────── */
            /* ── COMENTAR SECCIÓN DE VENTAS/COMPRAS ─────── */
            /* ──────────────────────────────────────────── */
            /*
            // Ventas por mes (comentado)
            const ventasPorMesRaw = await Cita.findAll({
                attributes: [
                    [Sequelize.fn("DATE_FORMAT", Sequelize.col("cita.fecha"), "%Y-%m"), "x"],
                    [Sequelize.fn("SUM", Sequelize.col("servicio.precio")), "y"],
                ],
                include: [{ model: Servicio, as: "servicio", attributes: [] }],
                where: {
                    estado: "Completa",
                    fecha: { [Op.between]: [subMonths(new Date(), 11), new Date()] },
                },
                group: ["x"],
                raw: true,
            });

            // Compras por mes (comentado)
            const comprasPorMesRaw = await Compra.findAll({
                attributes: [
                    [Sequelize.fn("DATE_FORMAT", Sequelize.col("compra.fecha"), "%Y-%m"), "x"],
                    [Sequelize.fn("SUM", Sequelize.col("compra.costo")), "y"],
                ],
                where: {
                    estaAnulado: false,
                    fecha: { [Op.between]: [subMonths(new Date(), 11), new Date()] },
                },
                group: ["x"],
                raw: true,
            });

            const toSerie = (raw, months) =>
                months.map(m => {
                    const r = raw.find(i => i.x === m) || { y: 0 };
                    return { x: monthMap[m.split("-")[1]], y: +r.y };
                });

            const ventasPorMes = toSerie(ventasPorMesRaw, monthsList);
            const comprasPorMes = toSerie(comprasPorMesRaw, monthsList);

            const ventasThis = ventasPorMes.at(-1).y;
            const ventasPrev = ventasPorMes.at(-2).y;
            const comprasThis = comprasPorMes.at(-1).y;
            const comprasPrev = comprasPorMes.at(-2).y;
            const profitThis = ventasThis - comprasThis;
            const profitPrev = ventasPrev - comprasPrev;

            const pct = (cur, prev) =>
                prev === 0 ? (cur === 0 ? 0 : 100) : ((cur - prev) / Math.abs(prev)) * 100;

            const gananciasPorMes = ventasPorMes.slice(-4).map((v, i) => ({
                label: v.x,
                id: v.x,
                value: v.y - comprasPorMes.slice(-4)[i].y,
            }));
            */

            /* ── NUEVOS GRÁFICOS ──────────────────────── */
            
            // 1. Horas con más citas
            const topHoras = (
                await Cita.findAll({
                    attributes: [
                        "hora",
                        [Sequelize.fn("COUNT", Sequelize.col("cita.hora")), "cantidad"],
                    ],
                    where: { estado: "Completa" },
                    group: ["hora"],
                    order: [[Sequelize.literal("cantidad"), "DESC"]],
                    limit: 6,
                    raw: true,
                })
            ).map(h => {
                const [hh, mm] = h.hora.split(":");
                const hour = ((+hh + 11) % 12) + 1;
                const ampm = +hh >= 12 ? "PM" : "AM";
                return { 
                    hora: h.hora,
                    label: `${hour}:${mm} ${ampm}`, 
                    value: h.cantidad 
                };
            });

            // 2. Servicios más solicitados
            const topServicios = (
                await Cita.findAll({
                    attributes: [
                        "servicioID",
                        [Sequelize.fn("COUNT", Sequelize.col("cita.id")), "cantidad"],
                    ],
                    where: { estado: "Completa" },
                    include: [{ 
                        model: Servicio, 
                        as: "servicio", 
                        attributes: ["nombre", "precio"] 
                    }],
                    group: ["servicioID", "servicio.id"],
                    order: [[Sequelize.literal("cantidad"), "DESC"]],
                    limit: 8,
                    raw: true,
                    nest: true,
                })
            ).map(s => ({ 
                id: s.servicio.nombre,
                label: s.servicio.nombre,
                value: s.cantidad,
                precio: s.servicio.precio
            }));

            // 3. Tipos de usuarios (Pie chart)
            const tiposDeUsuarios = (
                await Usuario.findAll({
                    attributes: [
                        [Sequelize.fn("COUNT", Sequelize.col("usuario.id")), "cantidad"],
                        "rolID",
                    ],
                    where: { estaVerificado: true },
                    include: [
                        {
                            model: Rol,
                            as: "rol",
                            attributes: ["nombre"],
                        },
                    ],
                    group: ["rolID", "rol.id"],
                    raw: true,
                    nest: true,
                })
            ).map(r => ({
                id: r.rol.nombre,
                label: r.rol.nombre,
                value: r.cantidad,
                color: this.getRandomColor()
            }));

            // Calcular total de usuarios verificados
            const totalUsuarios = tiposDeUsuarios.reduce((sum, item) => sum + item.value, 0);

            // 4. Top barberos (por citas atendidas)
            const topBarberos = (
                await Cita.findAll({
                    attributes: [
                        "barberoID",
                        [Sequelize.fn("COUNT", Sequelize.col("cita.id")), "citasAtendidas"],
                    ],
                    where: { estado: "Completa" },
                    include: [{ 
                        model: Barbero, 
                        as: "barbero", 
                        attributes: ["nombre", "avatar"] 
                    }],
                    group: ["barberoID", "barbero.id"],
                    order: [[Sequelize.literal("citasAtendidas"), "DESC"]],
                    limit: 5,
                    raw: true,
                    nest: true,
                })
            ).map(b => ({
                id: b.barbero.id,
                nombre: b.barbero.nombre,
                citas: b.citasAtendidas,
                avatar: b.barbero.avatar
            }));

            /* ── Respuesta ─────────────────────────────── */
            return res.json({
                // Datos comentados (se pueden descomentar luego)
                /*
                ventasEsteMes: ventasThis,
                comprasEsteMes: comprasThis,
                profitEsteMes: profitThis,
                ventasPorMes,
                comprasPorMes,
                gananciasPorMes,
                ventasChange: pct(ventasThis, ventasPrev),
                comprasChange: pct(comprasThis, comprasPrev),
                profitChange: pct(profitThis, profitPrev),
                */
                
                // Nuevos gráficos
                topHoras,
                topServicios,
                tiposDeUsuarios,
                totalUsuarios,
                topBarberos,
                
                // Mantener otros datos necesarios
                citasCompletadasTotales: await Cita.count({ where: { estado: "Completa" } })
            });
        } catch (err) {
            console.error("💥 Dashboard error:", err);
            return res.status(500).json({ error: "Internal Server Error" });
        }
    };

    // Función auxiliar para generar colores aleatorios
    getRandomColor() {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }
}

export const dashboardController = new DashboardController();