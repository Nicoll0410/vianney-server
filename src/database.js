/* =========================================================
   src/database.js  —  CONEXIÓN ROBUSTA
   ========================================================= */
import { Sequelize } from "sequelize";
import mySQLDialect from "mysql2";

export class Database {
  constructor() {
    this.database = null;
    this.init();
  }

  async init() {
    const {
      DB_USER,
      DB_PASS,
      DB_HOST,
      DB_PORT,
      DB_NAME,
      NODE_ENV
    } = process.env;

    try {
      /* ───────────── Sequelize instance ───────────── */
      this.database = new Sequelize({
        username: DB_USER,
        password: DB_PASS,
        host: DB_HOST,
        port: DB_PORT,
        database: DB_NAME,
        dialect: "mysql",
        dialectModule: mySQLDialect,

        /*  👇  ver todas las queries en consola SOLO en desarrollo  👇  */
        logging: NODE_ENV === 'development' ? console.log : false,

        /*  👇  fija la zona horaria a Colombia  👇  */
        timezone: "-05:00",
        dialectOptions: { 
          timezone: "-05:00",
          connectTimeout: 60000, // 60 segundos timeout
          // SSL para producción si es necesario
          ssl: NODE_ENV === 'production' ? {
            require: true,
            rejectUnauthorized: false
          } : false
        },

        // 🔥 NUEVA CONFIGURACIÓN PARA CONEXIONES ESTABLES
        pool: {
          max: 5,
          min: 0,
          acquire: 30000,
          idle: 10000,
          evict: 10000 // Cerrar conexiones después de 10s inactivas
        },

        // 🔥 RECONEXIÓN AUTOMÁTICA
        retry: {
          max: 3,
          match: [
            /Connection lost/,
            /SequelizeConnectionError/,
            /ECONNRESET/,
            /ECONNREFUSED/,
            /ETIMEDOUT/,
          ],
        }
      });

      await this.database.authenticate();
      console.log("\x1b[32m", "✅ Base de datos conectada 🎉");

      // Manejar eventos de conexión
      this.database.connectionManager.on('disconnect', () => {
        console.log("\x1b[33m", "⚠️  Conexión a BD perdida, reconectando...");
      });

      this.database.connectionManager.on('connect', () => {
        console.log("\x1b[32m", "✅ Conexión a BD reestablecida");
      });

    } catch (error) {
      console.log("\x1b[31m", "❌ Error conectando la base de datos:");
      console.log(error.message);
      
      // Intentar reconectar después de 5 segundos
      setTimeout(() => this.init(), 5000);
    }
  }

  getDatabase() {
    return this.database;
  }
}

export const database = new Database();
export const sequelize = database.getDatabase();

// Función para verificar salud de la BD
export const checkDatabaseHealth = async () => {
  try {
    await sequelize.authenticate();
    return { status: 'connected', timestamp: new Date() };
  } catch (error) {
    return { status: 'disconnected', error: error.message, timestamp: new Date() };
  }
};