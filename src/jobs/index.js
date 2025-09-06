import { CitasAVentasJob } from "./citasAVentas.job.js";

export class JobsManager {
    static iniciarTodos() {
        CitasAVentasJob.iniciar();
        console.log('✅ Todos los jobs programados iniciados');
    }
}