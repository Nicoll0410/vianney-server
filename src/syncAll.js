// src/models/index.js (o donde estés centralizando tus asociaciones)

import { sequelize } from "./database.js";

/* MODELOS */
import { Rol } from "./modules/roles/roles.model.js";
import { Permiso } from "./modules/roles/permisos.model.js";
import { RolesPorPermisos } from "./modules/roles/roles_por_permisos.js";

import { Usuario } from "./modules/usuarios/usuarios.model.js";
import { CodigosVerificacion } from "./modules/usuarios/codigos_verificacion.model.js";
import { CodigosRecuperarVerificacion } from "./modules/usuarios/codigos_recuperar_password.model.js";

import { Notificacion } from "./modules/notifications/notifications.model.js"
import { Cliente } from "./modules/clientes/clientes.model.js";
import { Barbero } from "./modules/barberos/barberos.model.js";

import { CategoriaProducto } from "./modules/categoria-insumos/categoria_insumos.model.js";
import { Insumo } from "./modules/insumos/insumos.model.js";

import { Movimiento } from "./modules/movimientos/movimientos.model.js";

import { Proveedor } from "./modules/proveedores/proveedores.model.js";
import { Compra } from "./modules/compras/compras.model.js";
import { DetalleCompra } from "./modules/compras/detalles_compras.model.js";

import { Servicio } from "./modules/servicios/servicios.model.js";
import { ServiciosPorInsumos } from "./modules/servicios/servicios_insumos.model.js";

import { Cita } from "./modules/citas/citas.model.js";
import { Venta } from "./modules/ventas/ventas.model.js";

/* USUARIOS Y ROLES */
Usuario.belongsTo(Rol, { foreignKey: "rolID", as: "rol" });
Rol.hasMany(Usuario, { foreignKey: "rolID" });

Cliente.belongsTo(Usuario, { foreignKey: "usuarioID" });
Usuario.hasMany(Cliente, { foreignKey: "usuarioID", as: "cliente" });

Barbero.belongsTo(Usuario, { foreignKey: "usuarioID", onDelete: "CASCADE" });
Usuario.hasMany(Barbero, { foreignKey: "usuarioID", onDelete: "CASCADE" });

CodigosVerificacion.belongsTo(Usuario, { foreignKey: "usuarioID", onDelete: "CASCADE" });
CodigosRecuperarVerificacion.belongsTo(Usuario, { foreignKey: "usuarioID" });

/* ROLES Y PERMISOS */
RolesPorPermisos.belongsTo(Rol, { foreignKey: "rolID" });
RolesPorPermisos.belongsTo(Permiso, { foreignKey: "permisoID" });
Rol.hasMany(RolesPorPermisos, { foreignKey: "rolID" });
Permiso.hasMany(RolesPorPermisos, { foreignKey: "permisoID" });

/* INSUMOS Y MOVIMIENTOS */
Insumo.belongsTo(CategoriaProducto, { foreignKey: "categoriaID" });
CategoriaProducto.hasMany(Insumo, { foreignKey: "categoriaID" });

Movimiento.belongsTo(Insumo, { foreignKey: "insumoID", onDelete: "CASCADE", as: "insumo" });

/* SERVICIOS */
ServiciosPorInsumos.belongsTo(Servicio, { foreignKey: "servicioID" });
ServiciosPorInsumos.belongsTo(Insumo, { foreignKey: "insumoID" });

Servicio.hasMany(Cita, { foreignKey: "servicioID", as: "citas" });
Cita.belongsTo(Servicio, { foreignKey: "servicioID", as: "servicio" });

/* CITAS Y BARBEROS */
Barbero.hasMany(Cita, { foreignKey: "barberoID", as: "citas" });
Cita.belongsTo(Barbero, { foreignKey: "barberoID", as: "barbero" });

/* CLIENTES Y CITAS */
Cliente.hasMany(Cita, { foreignKey: "pacienteID", as: "citas" });
Cita.belongsTo(Cliente, { foreignKey: "pacienteID", as: "cliente", constraints: false }); // ✅ Corrección aplicada aquí

    Cita.hasOne(Venta, {
        foreignKey: 'citaID',
        as: 'venta'
    });

/* COMPRAS Y DETALLES */
Compra.belongsTo(Proveedor, { foreignKey: "proveedorID", as: "proveedor" });
Proveedor.hasMany(Compra, { foreignKey: "proveedorID", as: "compras" });

Compra.hasMany(DetalleCompra, { foreignKey: "compraID", as: "productos" });
DetalleCompra.belongsTo(Compra, { foreignKey: "compraID", onDelete: "CASCADE" });

DetalleCompra.belongsTo(Insumo, {
  foreignKey: "insumoID",
  onDelete: "CASCADE",
  as: "insumo",
});
Insumo.hasMany(DetalleCompra, { foreignKey: "insumoID" });

Notificacion.belongsTo(Usuario, { 
  foreignKey: "usuarioID", 
  onDelete: "CASCADE" 
});
Usuario.hasMany(Notificacion, { 
  foreignKey: "usuarioID", 
  as: "notificaciones",
  onDelete: "CASCADE" 
});

/* SYNC */
export async function syncAllModels() {
  try {
    await sequelize.sync({ alter: true });
    console.log("✅ Base de datos sincronizada correctamente");
  } catch (err) {
    console.error("❌ Error al sincronizar:", err);
  }
}
