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

            /* ── Ventas por mes ───────────────────────── */
            const ventasPorMesRaw = await Cita.findAll({
                attributes: [
                    [Sequelize.fn("DATE_FORMAT", Sequelize.col("cita.fecha"), "%Y-%m"), "x"],
                    [Sequelize.fn("SUM", Sequelize.col("servicio.precio")), "y"],
                ],
                include: [{ model: Servicio, as: "servicio", attributes: [] }],   // ← as: "servicio"
                where: {
                    estado: "Completa",
                    fecha: { [Op.between]: [subMonths(new Date(), 11), new Date()] },
                },
                group: ["x"],
                raw: true,
            });

            /* ── Compras por mes ──────────────────────── */
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

            /* ── Mapear a formato de frontend ─────────── */
            const toSerie = (raw, months) =>
                months.map(m => {
                    const r = raw.find(i => i.x === m) || { y: 0 };
                    return { x: monthMap[m.split("-")[1]], y: +r.y };
                });

            const ventasPorMes = toSerie(ventasPorMesRaw, monthsList);
            const comprasPorMes = toSerie(comprasPorMesRaw, monthsList);

            /* ── Totales y variaciones ─────────────────── */
            const ventasThis = ventasPorMes.at(-1).y;
            const ventasPrev = ventasPorMes.at(-2).y;
            const comprasThis = comprasPorMes.at(-1).y;
            const comprasPrev = comprasPorMes.at(-2).y;
            const profitThis = ventasThis - comprasThis;
            const profitPrev = ventasPrev - comprasPrev;

            const pct = (cur, prev) =>
                prev === 0 ? (cur === 0 ? 0 : 100) : ((cur - prev) / Math.abs(prev)) * 100;

            /* ── Ganancias últimos 4 meses ─────────────── */
            const gananciasPorMes = ventasPorMes.slice(-4).map((v, i) => ({
                label: v.x,
                id: v.x,
                value: v.y - comprasPorMes.slice(-4)[i].y,
            }));

            /* ── Top barberos ─────────────────────────── */
            const topBarberos = await Cita.findAll({
                attributes: [
                    "barberoID",
                    [Sequelize.fn("COUNT", Sequelize.col("cita.id")), "citas"],
                ],
                where: { estado: "Completa" },
                include: [{ model: Barbero, as: "barbero", attributes: ["nombre", "avatar"] }], // ← as: "barbero"
                group: ["barberoID", "barbero.id"],
                order: [[Sequelize.literal("citas"), "DESC"]],
                limit: 5,
                raw: true,
                nest: true,
            });

            /* ── Top servicios ────────────────────────── */
            const topServicios = (
                await Cita.findAll({
                    attributes: [
                        "servicioID",
                        [Sequelize.fn("COUNT", Sequelize.col("cita.id")), "citas"],
                    ],
                    where: { estado: "Completa" },
                    include: [{ model: Servicio, as: "servicio", attributes: ["nombre"] }], // ← as: "servicio"
                    group: ["servicioID", "servicio.id"],
                    order: [[Sequelize.literal("citas"), "DESC"]],
                    limit: 8,
                    raw: true,
                    nest: true,
                })
            ).map(s => ({ value: s.citas, id: s.servicio.nombre, label: s.servicio.nombre }));

            /* ── Horas con más citas ───────────────────── */
            const topHoras = (
                await Cita.findAll({
                    attributes: [
                        "hora",
                        [Sequelize.fn("COUNT", Sequelize.col("cita.hora")), "cantidad"],
                    ],
                    group: ["hora"],
                    order: [["hora", "ASC"]],
                    limit: 6,
                    raw: true,
                })
            ).map(h => {
                const [hh, mm] = h.hora.split(":");
                const hour = ((+hh + 11) % 12) + 1;
                const ampm = +hh >= 12 ? "PM" : "AM";
                return { value: h.cantidad, id: `${hour}:${mm} ${ampm}`, label: `${hour}:${mm} ${ampm}` };
            });

            /* ── Tipos de usuarios ───────────────────────── */
            const tiposDeUsuarios = (
                await Usuario.findAll({
                    attributes: [
                        [Sequelize.fn("COUNT", Sequelize.col("usuario.id")), "value"],
                        "rolID",
                    ],
                    include: [
                        {
                            model: Rol,
                            as: "rol",          // ← alias obligatorio
                            attributes: ["nombre"],
                        },
                    ],
                    group: ["rolID", "rol.id"],
                    raw: true,
                    nest: true,
                })
            ).map(r => ({
                value: r.value,
                id: r.rol.nombre,
                label: r.rol.nombre,
            }));


            /* ── Top proveedores ───────────────────────── */
            const topProveedores = (
                await Compra.findAll({
                    attributes: [
                        "proveedorID",
                        [Sequelize.fn("COUNT", Sequelize.col("compra.id")), "value"],
                    ],
                    include: [{ model: Proveedor, as: "proveedor", attributes: ["nombre"] }], // ← as: "proveedor"
                    group: ["proveedorID", "proveedor.id"],
                    order: [[Sequelize.literal("value"), "DESC"]],
                    limit: 7,
                    raw: true,
                    nest: true,
                })
            ).map(p => ({ value: p.value, id: p.proveedor.nombre, label: p.proveedor.nombre }));

            const citasCompletadasTotales = await Cita.count({ where: { estado: "Completa" } });

            /* ── Respuesta ─────────────────────────────── */
            return res.json({
                ventasEsteMes: ventasThis,
                comprasEsteMes: comprasThis,
                profitEsteMes: profitThis,
                ventasPorMes,
                comprasPorMes,
                gananciasPorMes,
                ventasChange: pct(ventasThis, ventasPrev),
                comprasChange: pct(comprasThis, comprasPrev),
                profitChange: pct(profitThis, profitPrev),
                topBarberos,
                topServicios,
                topHoras,
                tiposDeUsuarios,
                topProveedores,
                citasCompletadasTotales,
            });
        } catch (err) {
            console.error("💥 Dashboard error:", err);
            return res.status(500).json({ error: "Internal Server Error" });
        }
    };
}

export const dashboardController = new DashboardController();
