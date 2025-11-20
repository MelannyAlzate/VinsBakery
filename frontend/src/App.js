// frontend/src/App.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = 'http://localhost:5000/api';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [usuario, setUsuario] = useState(null);
  const [vistaActual, setVistaActual] = useState('dashboard');
  const [mostrarRegistro, setMostrarRegistro] = useState(false);
  
  // Estados
  const [productos, setProductos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [estadisticas, setEstadisticas] = useState({});
  
  // Estados para formularios
  const [formProducto, setFormProducto] = useState({
    nombre: '', descripcion: '', precio: '', stock: '', categoria: ''
  });
  const [formCliente, setFormCliente] = useState({
    nombre: '', telefono: '', correo: ''
  });
  const [pedidoActual, setPedidoActual] = useState({
    cliente: null,
    productos: [],
    notas: ''
  });

  // Login
  const handleLogin = async (e) => {
    e.preventDefault();
    const correo = e.target.correo.value;
    const contrasena = e.target.contrasena.value;

    try {
      const response = await axios.post(`${API_URL}/login`, { correo, contrasena });
      localStorage.setItem('token', response.data.token);
      setUsuario(response.data.usuario);
      setIsLoggedIn(true);
      cargarDatos();
    } catch (error) {
      alert('Error: ' + (error.response?.data?.error || 'Credenciales inválidas'));
    }
  };

  // Registro
  const handleRegistro = async (e) => {
    e.preventDefault();
    const nombre = e.target.nombre.value;
    const correo = e.target.correo.value;
    const contrasena = e.target.contrasena.value;
    const confirmarContrasena = e.target.confirmarContrasena.value;

    if (contrasena !== confirmarContrasena) {
      alert('Las contraseñas no coinciden');
      return;
    }

    if (contrasena.length < 6) {
      alert('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/register`, {
        nombre,
        correo,
        contrasena,
        rol: 'administrador'
      });
      
      alert('✅ ' + response.data.mensaje + '\n\nAhora puedes iniciar sesión con tus credenciales.');
      setMostrarRegistro(false);
      
      // Limpiar formulario
      e.target.reset();
    } catch (error) {
      alert('❌ Error: ' + (error.response?.data?.error || 'Error al registrar usuario'));
    }
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsLoggedIn(false);
    setUsuario(null);
  };

  // Cargar todos los datos
  const cargarDatos = async () => {
    try {
      const [prodRes, cliRes, pedRes, estRes] = await Promise.all([
        axios.get(`${API_URL}/productos`),
        axios.get(`${API_URL}/clientes`),
        axios.get(`${API_URL}/pedidos`),
        axios.get(`${API_URL}/estadisticas`)
      ]);
      
      setProductos(prodRes.data);
      setClientes(cliRes.data);
      setPedidos(pedRes.data);
      setEstadisticas(estRes.data);
    } catch (error) {
      console.error('Error al cargar datos:', error);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsLoggedIn(true);
      cargarDatos();
    }
  }, []);

  // ========== PRODUCTOS ==========
  
  const crearProducto = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/productos`, formProducto);
      setFormProducto({ nombre: '', descripcion: '', precio: '', stock: '', categoria: '' });
      cargarDatos();
      alert('Producto creado exitosamente');
    } catch (error) {
      alert('Error al crear producto');
    }
  };

  const eliminarProducto = async (id) => {
    if (window.confirm('¿Eliminar este producto?')) {
      try {
        await axios.delete(`${API_URL}/productos/${id}`);
        cargarDatos();
      } catch (error) {
        alert('Error al eliminar producto');
      }
    }
  };

  // ========== CLIENTES ==========
  
  const crearCliente = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/clientes`, formCliente);
      setFormCliente({ nombre: '', telefono: '', correo: '' });
      cargarDatos();
      alert('Cliente registrado exitosamente');
    } catch (error) {
      alert('Error al registrar cliente');
    }
  };

  const buscarClientePorTelefono = async (telefono) => {
    try {
      const response = await axios.get(`${API_URL}/clientes/telefono/${telefono}`);
      return response.data;
    } catch (error) {
      return null;
    }
  };

  // ========== PEDIDOS ==========
  
  const agregarProductoAPedido = (producto) => {
    const existe = pedidoActual.productos.find(p => p.id_producto === producto.id_producto);
    
    if (existe) {
      setPedidoActual({
        ...pedidoActual,
        productos: pedidoActual.productos.map(p =>
          p.id_producto === producto.id_producto
            ? { ...p, cantidad: p.cantidad + 1 }
            : p
        )
      });
    } else {
      setPedidoActual({
        ...pedidoActual,
        productos: [...pedidoActual.productos, {
          id_producto: producto.id_producto,
          nombre: producto.nombre,
          precio_unitario: producto.precio,
          cantidad: 1
        }]
      });
    }
  };

  const eliminarProductoDePedido = (id_producto) => {
    setPedidoActual({
      ...pedidoActual,
      productos: pedidoActual.productos.filter(p => p.id_producto !== id_producto)
    });
  };

  const calcularTotalPedido = () => {
    const subtotal = pedidoActual.productos.reduce(
      (sum, p) => sum + (p.precio_unitario * p.cantidad), 0
    );
    
    const descuento = pedidoActual.cliente 
      ? (subtotal * pedidoActual.cliente.descuento_actual) / 100 
      : 0;
    
    return { subtotal, descuento, total: subtotal - descuento };
  };

  const crearPedido = async () => {
    if (!pedidoActual.cliente) {
      alert('Selecciona un cliente primero');
      return;
    }
    
    if (pedidoActual.productos.length === 0) {
      alert('Agrega al menos un producto');
      return;
    }

    try {
      await axios.post(`${API_URL}/pedidos`, {
        id_cliente: pedidoActual.cliente.id_cliente,
        productos: pedidoActual.productos,
        notas: pedidoActual.notas
      });
      
      alert('¡Pedido creado exitosamente!');
      setPedidoActual({ cliente: null, productos: [], notas: '' });
      cargarDatos();
      setVistaActual('pedidos');
    } catch (error) {
      alert('Error al crear pedido');
    }
  };

  // ========== RENDERIZADO ==========

  if (!isLoggedIn) {
    return (
      <div className="login-container">
        <div className="login-box">
          <h1>🧁 Vins Bakery</h1>
          <p>Sistema de Gestión y Fidelización</p>
          
          {!mostrarRegistro ? (
            // FORMULARIO DE LOGIN
            <>
              <form onSubmit={handleLogin}>
                <input type="email" name="correo" placeholder="Correo electrónico" required />
                <input type="password" name="contrasena" placeholder="Contraseña" required />
                <button type="submit" className="btn-login">Iniciar Sesión</button>
              </form>
              <div className="divider">
                <span>o</span>
              </div>
              <button 
                className="btn-registro-toggle" 
                onClick={() => setMostrarRegistro(true)}
              >
                Crear Nueva Cuenta
              </button>
              <small className="info-login">Usuario demo: admin@vinsbakery.com | Contraseña: admin123</small>
            </>
          ) : (
            // FORMULARIO DE REGISTRO
            <>
              <h2 className="registro-titulo">Crear Cuenta Nueva</h2>
              <form onSubmit={handleRegistro}>
                <input 
                  type="text" 
                  name="nombre" 
                  placeholder="Nombre completo" 
                  required 
                  minLength="3"
                />
                <input 
                  type="email" 
                  name="correo" 
                  placeholder="Correo electrónico" 
                  required 
                />
                <input 
                  type="password" 
                  name="contrasena" 
                  placeholder="Contraseña (mínimo 6 caracteres)" 
                  required 
                  minLength="6"
                />
                <input 
                  type="password" 
                  name="confirmarContrasena" 
                  placeholder="Confirmar contraseña" 
                  required 
                  minLength="6"
                />
                <button type="submit" className="btn-registro">Registrarme</button>
              </form>
              <div className="divider">
                <span>o</span>
              </div>
              <button 
                className="btn-volver-login" 
                onClick={() => setMostrarRegistro(false)}
              >
                Ya tengo cuenta - Iniciar Sesión
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Sidebar */}
      <div className="sidebar">
        <h2>🧁 Vins Bakery</h2>
        <div className="user-info">
          <p>{usuario?.nombre}</p>
          <span>{usuario?.rol}</span>
        </div>
        
        <nav>
          <button className={vistaActual === 'dashboard' ? 'active' : ''} onClick={() => setVistaActual('dashboard')}>
            📊 Dashboard
          </button>
          <button className={vistaActual === 'productos' ? 'active' : ''} onClick={() => setVistaActual('productos')}>
            🧁 Productos
          </button>
          <button className={vistaActual === 'clientes' ? 'active' : ''} onClick={() => setVistaActual('clientes')}>
            👥 Clientes
          </button>
          <button className={vistaActual === 'nuevo-pedido' ? 'active' : ''} onClick={() => setVistaActual('nuevo-pedido')}>
            ➕ Nuevo Pedido
          </button>
          <button className={vistaActual === 'pedidos' ? 'active' : ''} onClick={() => setVistaActual('pedidos')}>
            📦 Pedidos
          </button>
        </nav>
        
        <button className="logout-btn" onClick={handleLogout}>
          Cerrar Sesión
        </button>
      </div>

      {/* Contenido principal */}
      <div className="main-content">
        
        {/* DASHBOARD */}
        {vistaActual === 'dashboard' && (
          <div>
            <h1>Dashboard</h1>
            <div className="stats-grid">
              <div className="stat-card">
                <h3>💰 Ventas Totales</h3>
                <p className="stat-number">${estadisticas.ventas?.toLocaleString()}</p>
              </div>
              <div className="stat-card">
                <h3>📦 Pedidos</h3>
                <p className="stat-number">{estadisticas.pedidos}</p>
              </div>
              <div className="stat-card">
                <h3>👥 Clientes</h3>
                <p className="stat-number">{estadisticas.clientes}</p>
              </div>
              <div className="stat-card">
                <h3>🧁 Productos</h3>
                <p className="stat-number">{estadisticas.productos}</p>
              </div>
            </div>

            <div className="section">
              <h2>Clientes VIP (Nivel Oro)</h2>
              <div className="clientes-vip">
                {clientes.filter(c => c.nivel_fidelidad === 'Oro').map(cliente => (
                  <div key={cliente.id_cliente} className="cliente-vip-card">
                    <h4>{cliente.nombre}</h4>
                    <span className="badge gold">⭐ Oro - {cliente.descuento_actual}% desc.</span>
                    <p>{cliente.total_compras} compras</p>
                    <p>${cliente.monto_total?.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PRODUCTOS */}
        {vistaActual === 'productos' && (
          <div>
            <h1>Gestión de Productos</h1>
            
            <div className="form-card">
              <h2>Nuevo Producto</h2>
              <form onSubmit={crearProducto} className="form-grid">
                <input
                  type="text"
                  placeholder="Nombre"
                  value={formProducto.nombre}
                  onChange={(e) => setFormProducto({...formProducto, nombre: e.target.value})}
                  required
                />
                <input
                  type="text"
                  placeholder="Descripción"
                  value={formProducto.descripcion}
                  onChange={(e) => setFormProducto({...formProducto, descripcion: e.target.value})}
                />
                <input
                  type="number"
                  placeholder="Precio"
                  value={formProducto.precio}
                  onChange={(e) => setFormProducto({...formProducto, precio: e.target.value})}
                  required
                />
                <input
                  type="number"
                  placeholder="Stock"
                  value={formProducto.stock}
                  onChange={(e) => setFormProducto({...formProducto, stock: e.target.value})}
                  required
                />
                <select
                  value={formProducto.categoria}
                  onChange={(e) => setFormProducto({...formProducto, categoria: e.target.value})}
                  required
                >
                  <option value="">Categoría</option>
                  <option value="Pasteles">Pasteles</option>
                  <option value="Cupcakes">Cupcakes</option>
                  <option value="Galletas">Galletas</option>
                  <option value="Postres">Postres</option>
                  <option value="Panes">Panes</option>
                </select>
                <button type="submit" className="btn-primary">Crear Producto</button>
              </form>
            </div>

            <div className="productos-grid">
              {productos.map(producto => (
                <div key={producto.id_producto} className="producto-card">
                  <h3>{producto.nombre}</h3>
                  <p className="categoria">{producto.categoria}</p>
                  <p className="descripcion">{producto.descripcion}</p>
                  <p className="precio">${producto.precio?.toLocaleString()}</p>
                  <p className="stock">Stock: {producto.stock}</p>
                  <button onClick={() => eliminarProducto(producto.id_producto)} className="btn-delete">
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CLIENTES */}
        {vistaActual === 'clientes' && (
          <div>
            <h1>Gestión de Clientes</h1>
            
            <div className="form-card">
              <h2>Nuevo Cliente</h2>
              <form onSubmit={crearCliente} className="form-grid">
                <input
                  type="text"
                  placeholder="Nombre completo"
                  value={formCliente.nombre}
                  onChange={(e) => setFormCliente({...formCliente, nombre: e.target.value})}
                  required
                />
                <input
                  type="tel"
                  placeholder="Teléfono"
                  value={formCliente.telefono}
                  onChange={(e) => setFormCliente({...formCliente, telefono: e.target.value})}
                  required
                />
                <input
                  type="email"
                  placeholder="Correo (opcional)"
                  value={formCliente.correo}
                  onChange={(e) => setFormCliente({...formCliente, correo: e.target.value})}
                />
                <button type="submit" className="btn-primary">Registrar Cliente</button>
              </form>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Teléfono</th>
                    <th>Nivel</th>
                    <th>Descuento</th>
                    <th>Compras</th>
                    <th>Total Gastado</th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.map(cliente => (
                    <tr key={cliente.id_cliente}>
                      <td>{cliente.nombre}</td>
                      <td>{cliente.telefono}</td>
                      <td>
                        <span className={`badge ${cliente.nivel_fidelidad.toLowerCase()}`}>
                          {cliente.nivel_fidelidad}
                        </span>
                      </td>
                      <td>{cliente.descuento_actual}%</td>
                      <td>{cliente.total_compras}</td>
                      <td>${cliente.monto_total?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* NUEVO PEDIDO */}
        {vistaActual === 'nuevo-pedido' && (
          <div>
            <h1>Crear Nuevo Pedido</h1>
            
            <div className="pedido-container">
              {/* Seleccionar Cliente */}
              <div className="form-card">
                <h2>1. Seleccionar Cliente</h2>
                {!pedidoActual.cliente ? (
                  <div>
                    <input
                      type="tel"
                      placeholder="Buscar por teléfono"
                      onBlur={async (e) => {
                        const cliente = await buscarClientePorTelefono(e.target.value);
                        if (cliente) {
                          setPedidoActual({...pedidoActual, cliente});
                          alert(`Cliente encontrado: ${cliente.nombre} - ${cliente.nivel_fidelidad} (${cliente.descuento_actual}% desc.)`);
                        } else {
                          alert('Cliente no encontrado');
                        }
                      }}
                    />
                    <p>O selecciona de la lista:</p>
                    <select onChange={(e) => {
                      const cliente = clientes.find(c => c.id_cliente === parseInt(e.target.value));
                      setPedidoActual({...pedidoActual, cliente});
                    }}>
                      <option value="">Seleccionar cliente</option>
                      {clientes.map(c => (
                        <option key={c.id_cliente} value={c.id_cliente}>
                          {c.nombre} - {c.nivel_fidelidad} ({c.descuento_actual}%)
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="cliente-seleccionado">
                    <h3>✅ {pedidoActual.cliente.nombre}</h3>
                    <span className={`badge ${pedidoActual.cliente.nivel_fidelidad.toLowerCase()}`}>
                      {pedidoActual.cliente.nivel_fidelidad} - {pedidoActual.cliente.descuento_actual}% descuento
                    </span>
                    <p>{pedidoActual.cliente.total_compras} compras realizadas</p>
                    <button onClick={() => setPedidoActual({...pedidoActual, cliente: null})}>
                      Cambiar Cliente
                    </button>
                  </div>
                )}
              </div>

              {/* Seleccionar Productos */}
              <div className="form-card">
                <h2>2. Seleccionar Productos</h2>
                <div className="productos-grid-small">
                  {productos.map(producto => (
                    <div key={producto.id_producto} className="producto-card-small">
                      <h4>{producto.nombre}</h4>
                      <p>${producto.precio?.toLocaleString()}</p>
                      <p className="stock-small">Stock: {producto.stock}</p>
                      <button 
                        onClick={() => agregarProductoAPedido(producto)}
                        disabled={producto.stock === 0}
                        className="btn-add"
                      >
                        Agregar
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Resumen del Pedido */}
              <div className="form-card">
                <h2>3. Resumen del Pedido</h2>
                {pedidoActual.productos.length === 0 ? (
                  <p>No hay productos agregados</p>
                ) : (
                  <div>
                    <table className="tabla-resumen">
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th>Cantidad</th>
                          <th>Precio Unit.</th>
                          <th>Subtotal</th>
                          <th>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pedidoActual.productos.map(p => (
                          <tr key={p.id_producto}>
                            <td>{p.nombre}</td>
                            <td>
                              <input
                                type="number"
                                min="1"
                                value={p.cantidad}
                                onChange={(e) => {
                                  setPedidoActual({
                                    ...pedidoActual,
                                    productos: pedidoActual.productos.map(prod =>
                                      prod.id_producto === p.id_producto
                                        ? {...prod, cantidad: parseInt(e.target.value)}
                                        : prod
                                    )
                                  });
                                }}
                                style={{width: '60px'}}
                              />
                            </td>
                            <td>${p.precio_unitario?.toLocaleString()}</td>
                            <td>${(p.precio_unitario * p.cantidad).toLocaleString()}</td>
                            <td>
                              <button 
                                onClick={() => eliminarProductoDePedido(p.id_producto)}
                                className="btn-delete-small"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="totales">
                      <p>Subtotal: ${calcularTotalPedido().subtotal.toLocaleString()}</p>
                      {pedidoActual.cliente && (
                        <p className="descuento">
                          Descuento ({pedidoActual.cliente.descuento_actual}%): 
                          -${calcularTotalPedido().descuento.toLocaleString()}
                        </p>
                      )}
                      <h3>Total: ${calcularTotalPedido().total.toLocaleString()}</h3>
                    </div>

                    <textarea
                      placeholder="Notas del pedido (opcional)"
                      value={pedidoActual.notas}
                      onChange={(e) => setPedidoActual({...pedidoActual, notas: e.target.value})}
                      rows="3"
                    />

                    <button onClick={crearPedido} className="btn-primary btn-large">
                      Confirmar Pedido
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* LISTA DE PEDIDOS */}
        {vistaActual === 'pedidos' && (
          <div>
            <h1>Historial de Pedidos</h1>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Cliente</th>
                    <th>Nivel</th>
                    <th>Fecha</th>
                    <th>Total</th>
                    <th>Descuento</th>
                    <th>Total Final</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidos.map(pedido => (
                    <tr key={pedido.id_pedido}>
                      <td>#{pedido.id_pedido}</td>
                      <td>{pedido.nombre_cliente}</td>
                      <td>
                        <span className={`badge ${pedido.nivel_fidelidad?.toLowerCase()}`}>
                          {pedido.nivel_fidelidad}
                        </span>
                      </td>
                      <td>{new Date(pedido.fecha_pedido).toLocaleDateString()}</td>
                      <td>${pedido.total?.toLocaleString()}</td>
                      <td className="descuento">-${pedido.descuento?.toLocaleString()}</td>
                      <td><strong>${pedido.total_final?.toLocaleString()}</strong></td>
                      <td>
                        <span className="badge">{pedido.estado}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;