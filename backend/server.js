// backend/server.js - Multi-Roles COMPLETO CON COMPRAS PARA CLIENTES
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Configuración de PostgreSQL
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'VinsBakery',
  password: process.env.DB_PASSWORD || 'mel1406',
  port: process.env.DB_PORT || 5432,
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error de conexión:', err);
  } else {
    console.log('✅ Conectado a PostgreSQL');
    release();
  }
});

app.use(cors());
app.use(express.json());

// ========== MIDDLEWARE DE AUTENTICACIÓN ==========

const verificarToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'vins_bakery_secret_2025');
    req.usuario = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }
};

// Middleware para verificar permisos (permite clientes hacer pedidos)
const verificarPermiso = (modulo, accion) => {
  return async (req, res, next) => {
    try {
      const { rol } = req.usuario;
      
      // Los clientes pueden crear sus propios pedidos
      if (rol === 'cliente' && modulo === 'pedidos' && accion === 'puede_crear') {
        return next();
      }
      
      const result = await pool.query(
        `SELECT ${accion} FROM permisos_rol WHERE rol = $1 AND modulo = $2`,
        [rol, modulo]
      );

      if (result.rows.length === 0 || !result.rows[0][accion]) {
        return res.status(403).json({ 
          error: 'No tienes permisos para realizar esta acción',
          modulo,
          accion
        });
      }

      next();
    } catch (error) {
      console.error('Error al verificar permisos:', error);
      res.status(500).json({ error: 'Error al verificar permisos' });
    }
  };
};

// Middleware para registrar actividades
const registrarActividad = async (req, accion, modulo, detalle = null) => {
  try {
    await pool.query(
      'INSERT INTO log_actividades (id_usuario, accion, modulo, detalle, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [req.usuario?.id, accion, modulo, detalle, req.ip]
    );
  } catch (error) {
    console.error('Error al registrar actividad:', error);
  }
};

// ========== AUTENTICACIÓN ==========

app.post('/api/login', async (req, res) => {
  try {
    const { correo, contrasena } = req.body;
    
    const result = await pool.query(
      'SELECT * FROM usuario WHERE correo = $1',
      [correo]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const usuario = result.rows[0];
    const esValido = await bcrypt.compare(contrasena, usuario.contrasena);

    if (!esValido) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Obtener permisos del usuario
    const permisosResult = await pool.query(
      'SELECT * FROM permisos_rol WHERE rol = $1',
      [usuario.rol]
    );

    const token = jwt.sign(
      { id: usuario.id_usuario, correo: usuario.correo, rol: usuario.rol },
      process.env.JWT_SECRET || 'vins_bakery_secret_2025',
      { expiresIn: '8h' }
    );

    // Registrar login
    await pool.query(
      'INSERT INTO log_actividades (id_usuario, accion, modulo) VALUES ($1, $2, $3)',
      [usuario.id_usuario, 'login', 'autenticacion']
    );

    res.json({
      token,
      usuario: {
        id: usuario.id_usuario,
        nombre: usuario.nombre,
        correo: usuario.correo,
        rol: usuario.rol
      },
      permisos: permisosResult.rows
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

app.post('/api/register', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { nombre, correo, contrasena, rol, telefono } = req.body;
    
    const usuarioExistente = await client.query(
      'SELECT * FROM usuario WHERE correo = $1',
      [correo]
    );

    if (usuarioExistente.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El correo ya está registrado' });
    }

    const salt = await bcrypt.genSalt(10);
    const contrasenaEncriptada = await bcrypt.hash(contrasena, salt);

    const userResult = await client.query(
      'INSERT INTO usuario (nombre, correo, contrasena, rol) VALUES ($1, $2, $3, $4) RETURNING id_usuario, nombre, correo, rol',
      [nombre, correo, contrasenaEncriptada, rol || 'cliente']
    );

    const nuevoUsuario = userResult.rows[0];

    // Si es cliente, crear registro en tabla cliente
    if (nuevoUsuario.rol === 'cliente') {
      await client.query(
        'INSERT INTO cliente (nombre, telefono, correo, id_usuario) VALUES ($1, $2, $3, $4)',
        [nombre, telefono || '', correo, nuevoUsuario.id_usuario]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      mensaje: 'Usuario registrado exitosamente',
      usuario: nuevoUsuario
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en registro:', error);
    res.status(500).json({ error: 'Error al registrar usuario' });
  } finally {
    client.release();
  }
});

// ========== PRODUCTOS (Públicos para clientes) ==========

app.get('/api/productos', verificarToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM producto WHERE activo = true ORDER BY nombre'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener productos:', error);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

app.post('/api/productos', verificarToken, verificarPermiso('productos', 'puede_crear'), async (req, res) => {
  try {
    const { nombre, descripcion, precio, stock, categoria } = req.body;
    
    const result = await pool.query(
      'INSERT INTO producto (nombre, descripcion, precio, stock, categoria) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [nombre, descripcion, precio, stock, categoria]
    );
    
    await registrarActividad(req, 'crear_producto', 'productos', `Producto: ${nombre}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear producto:', error);
    res.status(500).json({ error: 'Error al crear producto' });
  }
});

app.put('/api/productos/:id', verificarToken, verificarPermiso('productos', 'puede_editar'), async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, precio, stock, categoria } = req.body;
    
    const result = await pool.query(
      'UPDATE producto SET nombre = $1, descripcion = $2, precio = $3, stock = $4, categoria = $5 WHERE id_producto = $6 RETURNING *',
      [nombre, descripcion, precio, stock, categoria, id]
    );
    
    await registrarActividad(req, 'editar_producto', 'productos', `ID: ${id}`);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
});

app.delete('/api/productos/:id', verificarToken, verificarPermiso('productos', 'puede_eliminar'), async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.query(
      'UPDATE producto SET activo = false WHERE id_producto = $1',
      [id]
    );
    
    await registrarActividad(req, 'eliminar_producto', 'productos', `ID: ${id}`);
    res.json({ mensaje: 'Producto eliminado' });
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
});

// ========== CLIENTES ==========

app.get('/api/clientes', verificarToken, verificarPermiso('clientes', 'puede_ver'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM cliente WHERE activo = true ORDER BY nombre'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    res.status(500).json({ error: 'Error al obtener clientes' });
  }
});

app.get('/api/clientes/telefono/:telefono', verificarToken, async (req, res) => {
  try {
    const { telefono } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM cliente WHERE telefono = $1 AND activo = true',
      [telefono]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al buscar cliente:', error);
    res.status(500).json({ error: 'Error al buscar cliente' });
  }
});

app.post('/api/clientes', verificarToken, verificarPermiso('clientes', 'puede_crear'), async (req, res) => {
  try {
    const { nombre, telefono, correo } = req.body;
    
    const result = await pool.query(
      'INSERT INTO cliente (nombre, telefono, correo) VALUES ($1, $2, $3) RETURNING *',
      [nombre, telefono, correo]
    );
    
    await registrarActividad(req, 'crear_cliente', 'clientes', `Cliente: ${nombre}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear cliente:', error);
    res.status(500).json({ error: 'Error al crear cliente' });
  }
});

// ========== PEDIDOS ==========

// Ver todos los pedidos (Admin/Empleado)
app.get('/api/pedidos', verificarToken, verificarPermiso('pedidos', 'puede_ver'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, c.nombre as nombre_cliente, c.telefono, c.nivel_fidelidad
      FROM pedido p
      JOIN cliente c ON p.id_cliente = c.id_cliente
      ORDER BY p.fecha_pedido DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener pedidos:', error);
    res.status(500).json({ error: 'Error al obtener pedidos' });
  }
});

// Crear pedido (Admin, Empleado o Cliente)
app.post('/api/pedidos', verificarToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id_cliente, productos, notas } = req.body;
    
    // Si es un cliente, verificar que esté creando pedido para sí mismo
    if (req.usuario.rol === 'cliente') {
      const clienteResult = await client.query(
        'SELECT id_cliente FROM cliente WHERE id_usuario = $1',
        [req.usuario.id]
      );
      
      if (clienteResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Perfil de cliente no encontrado' });
      }
      
      if (clienteResult.rows[0].id_cliente !== id_cliente) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Solo puedes crear pedidos para ti mismo' });
      }
    }
    
    // Obtener descuento del cliente
    const clienteData = await client.query(
      'SELECT descuento_actual FROM cliente WHERE id_cliente = $1',
      [id_cliente]
    );
    
    const descuentoPorcentaje = clienteData.rows[0].descuento_actual;
    
    // Calcular totales
    let total = 0;
    for (const prod of productos) {
      // Verificar stock
      const stockCheck = await client.query(
        'SELECT stock FROM producto WHERE id_producto = $1',
        [prod.id_producto]
      );
      
      if (stockCheck.rows[0].stock < prod.cantidad) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: `Stock insuficiente para ${prod.nombre}. Disponible: ${stockCheck.rows[0].stock}` 
        });
      }
      
      total += prod.precio_unitario * prod.cantidad;
    }
    
    const descuento = (total * descuentoPorcentaje) / 100;
    const total_final = total - descuento;
    
    // Crear pedido
    const pedidoResult = await client.query(
      'INSERT INTO pedido (id_cliente, total, descuento, total_final, notas, estado) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [id_cliente, total, descuento, total_final, notas, 'pendiente']
    );
    
    const id_pedido = pedidoResult.rows[0].id_pedido;
    
    // Agregar productos al pedido
    for (const prod of productos) {
      await client.query(
        'INSERT INTO detalle_pedido (id_pedido, id_producto, nombre_producto, cantidad, precio_unitario, subtotal) VALUES ($1, $2, $3, $4, $5, $6)',
        [id_pedido, prod.id_producto, prod.nombre, prod.cantidad, prod.precio_unitario, prod.cantidad * prod.precio_unitario]
      );
      
      // Actualizar stock
      await client.query(
        'UPDATE producto SET stock = stock - $1 WHERE id_producto = $2',
        [prod.cantidad, prod.id_producto]
      );
    }
    
    await client.query('COMMIT');
    await registrarActividad(req, 'crear_pedido', 'pedidos', `Pedido #${id_pedido}`);
    
    res.status(201).json(pedidoResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al crear pedido:', error);
    res.status(500).json({ error: 'Error al crear pedido: ' + error.message });
  } finally {
    client.release();
  }
});

// Actualizar estado del pedido (Admin/Empleado)
app.put('/api/pedidos/:id/estado', verificarToken, verificarPermiso('pedidos', 'puede_editar'), async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    
    const result = await pool.query(
      'UPDATE pedido SET estado = $1 WHERE id_pedido = $2 RETURNING *',
      [estado, id]
    );
    
    await registrarActividad(req, 'actualizar_estado_pedido', 'pedidos', `Pedido #${id} -> ${estado}`);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar pedido:', error);
    res.status(500).json({ error: 'Error al actualizar pedido' });
  }
});

// Ver detalle de un pedido
app.get('/api/pedidos/:id/detalle', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM detalle_pedido WHERE id_pedido = $1',
      [id]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener detalle:', error);
    res.status(500).json({ error: 'Error al obtener detalle del pedido' });
  }
});

// ========== ALERTAS DE STOCK ==========

app.get('/api/alertas-stock', verificarToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, p.nombre as nombre_producto, p.categoria
      FROM alertas_stock a
      JOIN producto p ON a.id_producto = p.id_producto
      WHERE a.resuelta = false
      ORDER BY a.fecha_alerta DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener alertas:', error);
    res.status(500).json({ error: 'Error al obtener alertas' });
  }
});

app.put('/api/alertas-stock/:id/resolver', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.query(
      'UPDATE alertas_stock SET resuelta = true WHERE id_alerta = $1',
      [id]
    );
    
    res.json({ mensaje: 'Alerta resuelta' });
  } catch (error) {
    console.error('Error al resolver alerta:', error);
    res.status(500).json({ error: 'Error al resolver alerta' });
  }
});

// ========== LOG DE ACTIVIDADES ==========

app.get('/api/log-actividades', verificarToken, verificarPermiso('seguridad', 'puede_ver'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT l.*, u.nombre as usuario_nombre, u.rol
      FROM log_actividades l
      JOIN usuario u ON l.id_usuario = u.id_usuario
      ORDER BY l.fecha_hora DESC
      LIMIT 100
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener log:', error);
    res.status(500).json({ error: 'Error al obtener log' });
  }
});

// ========== USUARIOS (Solo Administradores) ==========

app.get('/api/usuarios', verificarToken, verificarPermiso('usuarios', 'puede_ver'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id_usuario, nombre, correo, rol, fecha_registro FROM usuario ORDER BY fecha_registro DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// ========== ESTADÍSTICAS ==========

app.get('/api/estadisticas', verificarToken, async (req, res) => {
  try {
    const totalVentas = await pool.query(
      'SELECT COALESCE(SUM(total_final), 0) as total FROM pedido'
    );
    
    const totalPedidos = await pool.query(
      'SELECT COUNT(*) as total FROM pedido'
    );
    
    const totalClientes = await pool.query(
      'SELECT COUNT(*) as total FROM cliente WHERE activo = true'
    );
    
    const totalProductos = await pool.query(
      'SELECT COUNT(*) as total FROM producto WHERE activo = true'
    );
    
    const alertasActivas = await pool.query(
      'SELECT COUNT(*) as total FROM alertas_stock WHERE resuelta = false'
    );
    
    res.json({
      ventas: parseFloat(totalVentas.rows[0].total),
      pedidos: parseInt(totalPedidos.rows[0].total),
      clientes: parseInt(totalClientes.rows[0].total),
      productos: parseInt(totalProductos.rows[0].total),
      alertas: parseInt(alertasActivas.rows[0].total)
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

// ========== ENDPOINTS PARA CLIENTES ==========

// Obtener pedidos de un cliente específico
app.get('/api/pedidos/cliente/:id_usuario', verificarToken, async (req, res) => {
  try {
    const { id_usuario } = req.params;
    
    // Verificar que el usuario solo pueda ver sus propios pedidos (a menos que sea admin/empleado)
    if (req.usuario.rol === 'cliente' && req.usuario.id !== parseInt(id_usuario)) {
      return res.status(403).json({ error: 'No tienes permisos para ver estos pedidos' });
    }
    
    // Buscar cliente asociado al usuario
    const clienteResult = await pool.query(
      'SELECT id_cliente FROM cliente WHERE id_usuario = $1',
      [id_usuario]
    );
    
    if (clienteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    const id_cliente = clienteResult.rows[0].id_cliente;
    
    const result = await pool.query(`
      SELECT p.*, c.nombre as nombre_cliente, c.nivel_fidelidad
      FROM pedido p
      JOIN cliente c ON p.id_cliente = c.id_cliente
      WHERE p.id_cliente = $1
      ORDER BY p.fecha_pedido DESC
    `, [id_cliente]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener pedidos del cliente:', error);
    res.status(500).json({ error: 'Error al obtener pedidos' });
  }
});

// Obtener perfil de cliente
app.get('/api/clientes/usuario/:id_usuario', verificarToken, async (req, res) => {
  try {
    const { id_usuario } = req.params;
    
    // Verificar que el usuario solo pueda ver su propio perfil (a menos que sea admin/empleado)
    if (req.usuario.rol === 'cliente' && req.usuario.id !== parseInt(id_usuario)) {
      return res.status(403).json({ error: 'No tienes permisos para ver este perfil' });
    }
    
    const result = await pool.query(
      'SELECT * FROM cliente WHERE id_usuario = $1',
      [id_usuario]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
});

// Obtener beneficios de un cliente
app.get('/api/beneficios/cliente/:id_usuario', verificarToken, async (req, res) => {
  try {
    const { id_usuario } = req.params;
    
    // Verificar permisos
    if (req.usuario.rol === 'cliente' && req.usuario.id !== parseInt(id_usuario)) {
      return res.status(403).json({ error: 'No tienes permisos para ver estos beneficios' });
    }
    
    // Buscar cliente asociado al usuario
    const clienteResult = await pool.query(
      'SELECT id_cliente FROM cliente WHERE id_usuario = $1',
      [id_usuario]
    );
    
    if (clienteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    const id_cliente = clienteResult.rows[0].id_cliente;
    
    const result = await pool.query(`
      SELECT * FROM beneficios_cliente
      WHERE id_cliente = $1
      ORDER BY fecha_aplicacion DESC
    `, [id_cliente]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener beneficios:', error);
    res.status(500).json({ error: 'Error al obtener beneficios' });
  }
});

// Ruta principal
app.get('/', (req, res) => {
  res.json({ 
    mensaje: '🧁 API Vins Bakery - Multi-Roles con Compras',
    version: '3.0',
    estado: 'Activo',
    roles: ['administrador', 'empleado', 'cliente', 'sistema'],
    features: ['Clientes pueden hacer pedidos', 'Fidelización automática', 'Gestión de stock']
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor en http://localhost:${PORT}`);
});

module.exports = app;