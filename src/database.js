/* =========================================================
   src/database.js  —  COMPLETO (con logging de SQL habilitado)
   ========================================================= */
import { Sequelize } from "sequelize";
import mySQLDialect from "mysql2";

export class Database {
  constructor() {
    this.database = null;

    (async () => {
      const {
        DATABASE_USERNAME,
        DATABASE_PASSWORD,
        DATABASE_HOST,
        DATABASE_PORT,
        DATABASE_NAME,
      } = process.env;

      try {
        /* ───────────── Sequelize instance ───────────── */
        this.database = new Sequelize({
          username: DATABASE_USERNAME,
          password: DATABASE_PASSWORD,
          host:     DATABASE_HOST,
          port:     DATABASE_PORT,
          database: DATABASE_NAME,
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
