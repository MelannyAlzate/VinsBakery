// backend/server.js
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
  database: process.env.DB_NAME || 'vins_bakery',
  password: process.env.DB_PASSWORD || 'mel1406',
  port: process.env.DB_PORT || 5432,
});

// Verificar conexión
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error de conexión:', err);
  } else {
    console.log('✅ Conectado a PostgreSQL');
    release();
  }
});

// Middlewares
app.use(cors());
app.use(express.json());

// ========== AUTENTICACIÓN ==========

// Login
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

    const token = jwt.sign(
      { id: usuario.id_usuario, correo: usuario.correo, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      usuario: {
        id: usuario.id_usuario,
        nombre: usuario.nombre,
        correo: usuario.correo,
        rol: usuario.rol
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});
// Registro de nuevo usuario
app.post('/api/register', async (req, res) => {
  try {
    const { nombre, correo, contrasena, rol } = req.body;
    
    // Verificar si el correo ya existe
    const usuarioExistente = await pool.query(
      'SELECT * FROM usuario WHERE correo = $1',
      [correo]
    );

    if (usuarioExistente.rows.length > 0) {
      return res.status(400).json({ error: 'El correo ya está registrado' });
    }

    // Encriptar contraseña
    const salt = await bcrypt.genSalt(10);
    const contrasenaEncriptada = await bcrypt.hash(contrasena, salt);

    // Crear usuario
    const result = await pool.query(
      'INSERT INTO usuario (nombre, correo, contrasena, rol) VALUES ($1, $2, $3, $4) RETURNING id_usuario, nombre, correo, rol',
      [nombre, correo, contrasenaEncriptada, rol || 'administrador']
    );

    res.status(201).json({
      mensaje: 'Usuario registrado exitosamente',
      usuario: result.rows[0]
    });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
});

// ========== PRODUCTOS ==========

// Obtener todos los productos
app.get('/api/productos', async (req, res) => {
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

// Crear producto
app.post('/api/productos', async (req, res) => {
  try {
    const { nombre, descripcion, precio, stock, categoria } = req.body;
    
    const result = await pool.query(
      'INSERT INTO producto (nombre, descripcion, precio, stock, categoria) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [nombre, descripcion, precio, stock, categoria]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear producto:', error);
    res.status(500).json({ error: 'Error al crear producto' });
  }
});

// Actualizar producto
app.put('/api/productos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, precio, stock, categoria } = req.body;
    
    const result = await pool.query(
      'UPDATE producto SET nombre = $1, descripcion = $2, precio = $3, stock = $4, categoria = $5 WHERE id_producto = $6 RETURNING *',
      [nombre, descripcion, precio, stock, categoria, id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
});

// Eliminar producto (lógico)
app.delete('/api/productos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.query(
      'UPDATE producto SET activo = false WHERE id_producto = $1',
      [id]
    );
    
    res.json({ mensaje: 'Producto eliminado' });
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
});

// ========== CLIENTES ==========

// Obtener todos los clientes
app.get('/api/clientes', async (req, res) => {
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

// Buscar cliente por teléfono
app.get('/api/clientes/telefono/:telefono', async (req, res) => {
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

// Crear cliente
app.post('/api/clientes', async (req, res) => {
  try {
    const { nombre, telefono, correo } = req.body;
    
    const result = await pool.query(
      'INSERT INTO cliente (nombre, telefono, correo) VALUES ($1, $2, $3) RETURNING *',
      [nombre, telefono, correo]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear cliente:', error);
    res.status(500).json({ error: 'Error al crear cliente' });
  }
});

// ========== PEDIDOS ==========

// Obtener todos los pedidos
app.get('/api/pedidos', async (req, res) => {
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

// Obtener detalles de un pedido
app.get('/api/pedidos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const pedido = await pool.query(
      'SELECT p.*, c.nombre as nombre_cliente FROM pedido p JOIN cliente c ON p.id_cliente = c.id_cliente WHERE p.id_pedido = $1',
      [id]
    );
    
    const detalles = await pool.query(
      'SELECT * FROM detalle_pedido WHERE id_pedido = $1',
      [id]
    );
    
    res.json({
      ...pedido.rows[0],
      detalles: detalles.rows
    });
  } catch (error) {
    console.error('Error al obtener pedido:', error);
    res.status(500).json({ error: 'Error al obtener pedido' });
  }
});

// Crear pedido
app.post('/api/pedidos', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id_cliente, productos, notas } = req.body;
    
    // Obtener descuento del cliente
    const clienteResult = await client.query(
      'SELECT descuento_actual FROM cliente WHERE id_cliente = $1',
      [id_cliente]
    );
    
    const descuentoPorcentaje = clienteResult.rows[0].descuento_actual;
    
    // Calcular total
    let total = 0;
    for (const prod of productos) {
      total += prod.precio_unitario * prod.cantidad;
    }
    
    // Aplicar descuento
    const descuento = (total * descuentoPorcentaje) / 100;
    const total_final = total - descuento;
    
    // Crear pedido
    const pedidoResult = await client.query(
      'INSERT INTO pedido (id_cliente, total, descuento, total_final, notas) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [id_cliente, total, descuento, total_final, notas]
    );
    
    const id_pedido = pedidoResult.rows[0].id_pedido;
    
    // Agregar detalles y actualizar stock
    for (const prod of productos) {
      await client.query(
        'INSERT INTO detalle_pedido (id_pedido, id_producto, nombre_producto, cantidad, precio_unitario, subtotal) VALUES ($1, $2, $3, $4, $5, $6)',
        [id_pedido, prod.id_producto, prod.nombre, prod.cantidad, prod.precio_unitario, prod.cantidad * prod.precio_unitario]
      );
      
      await client.query(
        'UPDATE producto SET stock = stock - $1 WHERE id_producto = $2',
        [prod.cantidad, prod.id_producto]
      );
    }
    
    await client.query('COMMIT');
    
    res.status(201).json(pedidoResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al crear pedido:', error);
    res.status(500).json({ error: 'Error al crear pedido' });
  } finally {
    client.release();
  }
});

// ========== ESTADÍSTICAS ==========

app.get('/api/estadisticas', async (req, res) => {
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
    
    res.json({
      ventas: parseFloat(totalVentas.rows[0].total),
      pedidos: parseInt(totalPedidos.rows[0].total),
      clientes: parseInt(totalClientes.rows[0].total),
      productos: parseInt(totalProductos.rows[0].total)
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

// Ruta principal
app.get('/', (req, res) => {
  res.json({ 
    mensaje: '🧁 API Vins Bakery',
    version: '1.0',
    estado: 'Activo'
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor en http://localhost:${PORT}`);
});

module.exports = app;