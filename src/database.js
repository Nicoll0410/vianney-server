/* =========================================================
   src/database.js  —  CONEXIÓN ROBUSTA
   ========================================================= */
import { Sequelize } from "sequelize";
import mySQLDialect from "mysql2";

export class Database {
  constructor() {
    this.database = null;

   (async () => {
      const {
        DB_USER,
        DB_PASS,
        DB_HOST,
        DB_PORT,
        DB_NAME,
      } = process.env;

      try {
        /* ───────────── Sequelize instance ───────────── */
        this.database = new Sequelize({
          username: DB_USER,
          password: DB_PASS,
          host:     DB_HOST,
          port:     DB_PORT,
          database: DB_NAME,
          dialect:  "mysql",
          dialectModule: mySQLDialect,

          /*  👇  ver todas las queries en consola  👇  */
          logging: console.log,

        /*  👇  fija la zona horaria a Colombia  👇  */
          timezone: "-05:00",
          dialectOptions: { timezone: "-05:00" },
        });

        await this.database.authenticate();
        console.log("\x1b[32m", "Base de datos conectada 🎉🎉🎉");
      } catch (error) {
        console.log("\x1b[31m", "Ocurrió un error conectando la base de datos:");
        console.log(error.message);
      }
    })();
  }

  getDatabase() {
    return this.database;
  }
}

export const database  = new Database();
export const sequelize = database.getDatabase();
