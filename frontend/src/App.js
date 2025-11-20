// frontend/src/App.js - Multi-Roles - VERSIÓN COMPLETA CON FIX
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = 'http://localhost:5000/api';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [usuario, setUsuario] = useState(null);
  const [permisos, setPermisos] = useState([]);
  const [vistaActual, setVistaActual] = useState('dashboard');
  const [mostrarRegistro, setMostrarRegistro] = useState(false);
  
  // Estados
  const [productos, setProductos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [estadisticas, setEstadisticas] = useState({});
  const [alertasStock, setAlertasStock] = useState([]);
  const [logActividades, setLogActividades] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [misPedidos, setMisPedidos] = useState([]);
  const [miPerfil, setMiPerfil] = useState(null);
  const [beneficiosDisponibles, setBeneficiosDisponibles] = useState([]);
  const [perfilesPendientes, setPerfilesPendientes] = useState([]);
  const [clientesCumpleanos, setClientesCumpleanos] = useState([]);
  const [perfilAprobado, setPerfilAprobado] = useState(false);
  
  // NUEVOS ESTADOS PARA FIX
  const [tieneCliente, setTieneCliente] = useState(false);
  const [cargandoPerfil, setCargandoPerfil] = useState(false);
  
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

  // Configurar axios con token
  const configurarAxios = (token) => {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  };

  // Verificar permiso
  const tienePermiso = (modulo, accion) => {
    const permiso = permisos.find(p => p.modulo === modulo);
    return permiso ? permiso[accion] : false;
  };

  // NUEVA FUNCIÓN: Verificar si el usuario tiene perfil de cliente
  const verificarPerfilCliente = async () => {
    if (usuario?.rol !== 'cliente') return;
    
    try {
      const response = await axios.get(`${API_URL}/verificar-cliente/${usuario.id}`);
      setTieneCliente(response.data.tiene_cliente);
      setPerfilAprobado(response.data.perfil_aprobado);
      
      if (!response.data.tiene_cliente) {
        console.warn('Usuario sin perfil de cliente asociado');
      } else if (!response.data.perfil_aprobado) {
        console.warn('Perfil pendiente de aprobación');
      }
    } catch (error) {
      console.error('Error al verificar cliente:', error);
      setTieneCliente(false);
      setPerfilAprobado(false);
    }
  };
  // Cargar perfiles pendientes
  const cargarPerfilesPendientes = async () => {
    try {
      const response = await axios.get(`${API_URL}/clientes/pendientes`);
      setPerfilesPendientes(response.data);
    } catch (error) {
      console.error('Error al cargar perfiles pendientes:', error);
    }
  };

  // Aprobar perfil
  const aprobarPerfil = async (id) => {
    if (window.confirm('¿Aprobar este perfil de cliente?')) {
      try {
        await axios.put(`${API_URL}/clientes/${id}/aprobar`);
        alert('✅ Perfil aprobado exitosamente');
        cargarPerfilesPendientes();
      } catch (error) {
        alert('❌ Error al aprobar perfil');
      }
    }
  };

  // Rechazar perfil
  const rechazarPerfil = async (id) => {
    if (window.confirm('¿Rechazar este perfil de cliente? Esta acción no se puede deshacer.')) {
      try {
        await axios.delete(`${API_URL}/clientes/${id}/rechazar`);
        alert('✅ Perfil rechazado');
        cargarPerfilesPendientes();
      } catch (error) {
        alert('❌ Error al rechazar perfil');
      }
    }
  };

  // Cargar clientes con cumpleaños
  const cargarCumpleanos = async () => {
    try {
      const response = await axios.get(`${API_URL}/clientes/cumpleanos-mes`);
      setClientesCumpleanos(response.data);
    } catch (error) {
      console.error('Error al cargar cumpleaños:', error);
    }
  };

  // Actualizar fecha de nacimiento
  const actualizarFechaNacimiento = async (id, fecha) => {
    try {
      await axios.put(`${API_URL}/clientes/${id}/fecha-nacimiento`, {
        fecha_nacimiento: fecha
      });
      alert('✅ Fecha de nacimiento actualizada');
      cargarMiPerfil();
    } catch (error) {
      alert('❌ Error al actualizar fecha de nacimiento');
    }
  };

  // Login
  const handleLogin = async (e) => {
    e.preventDefault();
    const correo = e.target.correo.value;
    const contrasena = e.target.contrasena.value;

    try {
      const response = await axios.post(`${API_URL}/login`, { correo, contrasena });
      const { token, usuario: usuarioData, permisos: permisosData } = response.data;
      
      localStorage.setItem('token', token);
      configurarAxios(token);
      
      setUsuario(usuarioData);
      setPermisos(permisosData);
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
    const rol = e.target.rol.value;

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
        rol
      });
      
      alert('✅ ' + response.data.mensaje + '\n\nAhora puedes iniciar sesión con tus credenciales.');
      setMostrarRegistro(false);
      e.target.reset();
    } catch (error) {
      alert('❌ Error: ' + (error.response?.data?.error || 'Error al registrar usuario'));
    }
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setIsLoggedIn(false);
    setUsuario(null);
    setPermisos([]);
    setTieneCliente(false);
  };

  // Cargar todos los datos
  const cargarDatos = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        configurarAxios(token);
      }

      const promesas = [
        axios.get(`${API_URL}/estadisticas`)
      ];

      // Solo cargar datos según permisos
      if (tienePermiso('productos', 'puede_ver') || permisos.length === 0) {
        promesas.push(axios.get(`${API_URL}/productos`));
      }
      if (tienePermiso('clientes', 'puede_ver') || permisos.length === 0) {
        promesas.push(axios.get(`${API_URL}/clientes`));
      }
      if (tienePermiso('pedidos', 'puede_ver') || permisos.length === 0) {
        promesas.push(axios.get(`${API_URL}/pedidos`));
      }

      const resultados = await Promise.allSettled(promesas);
      
      if (resultados[0].status === 'fulfilled') setEstadisticas(resultados[0].value.data);
      if (resultados[1]?.status === 'fulfilled') setProductos(resultados[1].value.data);
      if (resultados[2]?.status === 'fulfilled') setClientes(resultados[2].value.data);
      if (resultados[3]?.status === 'fulfilled') setPedidos(resultados[3].value.data);

      // Cargar alertas de stock si tiene permiso
      if (tienePermiso('inventario', 'puede_ver') || usuario?.rol === 'administrador') {
        const alertas = await axios.get(`${API_URL}/alertas-stock`);
        setAlertasStock(alertas.data);
      }

      // Cargar usuarios si es administrador
      if (usuario?.rol === 'administrador' && tienePermiso('usuarios', 'puede_ver')) {
        const usuariosRes = await axios.get(`${API_URL}/usuarios`);
        setUsuarios(usuariosRes.data);
      }

    } catch (error) {
      console.error('Error al cargar datos:', error);
      if (error.response?.status === 401) {
        handleLogout();
      }
    }
  };

  // MEJORADA: Cargar mis pedidos con validación
  const cargarMisPedidos = async () => {
    if (!tieneCliente) {
      setMisPedidos([]);
      return;
    }
    
    setCargandoPerfil(true);
    try {
      const response = await axios.get(`${API_URL}/pedidos/cliente/${usuario.id}`);
      setMisPedidos(response.data);
    } catch (error) {
      console.error('Error al cargar pedidos:', error);
      if (error.response?.status === 404) {
        setMisPedidos([]);
      }
    } finally {
      setCargandoPerfil(false);
    }
  };

  // MEJORADA: Cargar mi perfil con validación
  const cargarMiPerfil = async () => {
    if (!tieneCliente) {
      setMiPerfil(null);
      return;
    }
    
    setCargandoPerfil(true);
    try {
      const response = await axios.get(`${API_URL}/clientes/usuario/${usuario.id}`);
      setMiPerfil(response.data);
    } catch (error) {
      console.error('Error al cargar perfil:', error);
      if (error.response?.status === 404) {
        setMiPerfil(null);
      }
    } finally {
      setCargandoPerfil(false);
    }
  };

  // MEJORADA: Cargar beneficios con validación
  const cargarBeneficios = async () => {
    if (!tieneCliente) {
      setBeneficiosDisponibles([]);
      return;
    }
    
    setCargandoPerfil(true);
    try {
      const response = await axios.get(`${API_URL}/beneficios/cliente/${usuario.id}`);
      setBeneficiosDisponibles(response.data);
    } catch (error) {
      console.error('Error al cargar beneficios:', error);
      if (error.response?.status === 404) {
        setBeneficiosDisponibles([]);
      }
    } finally {
      setCargandoPerfil(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      configurarAxios(token);
      axios.get(`${API_URL}/estadisticas`)
        .then(() => setIsLoggedIn(true))
        .catch(() => {
          localStorage.removeItem('token');
          setIsLoggedIn(false);
        });
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn && permisos.length > 0) {
      cargarDatos();
      
      // ✅ Cargar perfiles pendientes si tiene permisos
      if (tienePermiso('clientes', 'puede_ver')) {
        cargarPerfilesPendientes();
      }
    }
  }, [isLoggedIn, permisos]);

  // NUEVO useEffect: Verificar perfil de cliente al iniciar sesión
  useEffect(() => {
    if (isLoggedIn && usuario?.rol === 'cliente') {
      verificarPerfilCliente();
    }
  }, [isLoggedIn, usuario]);

  // ========== PRODUCTOS ==========
  
  const crearProducto = async (e) => {
    e.preventDefault();
    if (!tienePermiso('productos', 'puede_crear')) {
      alert('No tienes permisos para crear productos');
      return;
    }

    try {
      await axios.post(`${API_URL}/productos`, formProducto);
      setFormProducto({ nombre: '', descripcion: '', precio: '', stock: '', categoria: '' });
      cargarDatos();
      alert('✅ Producto creado exitosamente');
    } catch (error) {
      alert('❌ Error al crear producto');
    }
  };

  const eliminarProducto = async (id) => {
    if (!tienePermiso('productos', 'puede_eliminar')) {
      alert('No tienes permisos para eliminar productos');
      return;
    }

    if (window.confirm('¿Eliminar este producto?')) {
      try {
        await axios.delete(`${API_URL}/productos/${id}`);
        cargarDatos();
        alert('✅ Producto eliminado');
      } catch (error) {
        alert('❌ Error al eliminar producto');
      }
    }
  };

  // ========== CLIENTES ==========
  
  const crearCliente = async (e) => {
    e.preventDefault();
    if (!tienePermiso('clientes', 'puede_crear')) {
      alert('No tienes permisos para crear clientes');
      return;
    }

    try {
      await axios.post(`${API_URL}/clientes`, formCliente);
      setFormCliente({ nombre: '', telefono: '', correo: '' });
      cargarDatos();
      alert('✅ Cliente registrado exitosamente');
    } catch (error) {
      alert('❌ Error al registrar cliente');
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
    
    if (!pedidoActual.cliente) {
      return { subtotal, descuento: 0, total: subtotal };
    }
    
    // Descuento base por nivel de fidelidad
    let descuentoPorcentaje = pedidoActual.cliente.descuento_actual || 0;
    
    // ✅ VERIFICAR SI HOY ES EL CUMPLEAÑOS DEL CLIENTE
    if (pedidoActual.cliente.fecha_nacimiento) {
      const hoy = new Date();
      const cumple = new Date(pedidoActual.cliente.fecha_nacimiento);
      const esCumpleanos = hoy.getDate() === cumple.getDate() && 
                          hoy.getMonth() === cumple.getMonth();
      
      if (esCumpleanos) {
        descuentoPorcentaje += 15; // ✅ Sumar 15% adicional por cumpleaños
      }
    }
    
    const descuento = (subtotal * descuentoPorcentaje) / 100;
    
    return { 
      subtotal, 
      descuento, 
      total: subtotal - descuento,
      descuentoPorcentaje // Retornar el porcentaje total para mostrarlo
    };
  };

  // ✅ MEJORAR LA FUNCIÓN crearPedido PARA MOSTRAR MENSAJE DE CUMPLEAÑOS

  const crearPedido = async () => {
    if (!tienePermiso('pedidos', 'puede_crear')) {
      alert('No tienes permisos para crear pedidos');
      return;
    }

    if (!pedidoActual.cliente) {
      alert('Selecciona un cliente primero');
      return;
    }
    
    if (pedidoActual.productos.length === 0) {
      alert('Agrega al menos un producto');
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/pedidos`, {
        id_cliente: pedidoActual.cliente.id_cliente,
        productos: pedidoActual.productos,
        notas: pedidoActual.notas
      });
      
      // ✅ Verificar si hay mensaje de cumpleaños en la respuesta
      let mensaje = '✅ ¡Pedido creado exitosamente!';
      if (response.data.mensaje_cumpleanos) {
        mensaje = `✅ ¡Pedido creado exitosamente!\n\n${response.data.mensaje_cumpleanos}`;
      }
      
      alert(mensaje);
      setPedidoActual({ cliente: null, productos: [], notas: '' });
      cargarDatos();
      setVistaActual('pedidos');
    } catch (error) {
      console.error('Error al crear pedido:', error);
      alert('❌ Error al crear pedido: ' + (error.response?.data?.error || error.message));
    }
  };

  // Resolver alerta de stock
  const resolverAlerta = async (id) => {
    try {
      await axios.put(`${API_URL}/alertas-stock/${id}/resolver`);
      cargarDatos();
    } catch (error) {
      alert('Error al resolver alerta');
    }
  };

  // ========== RENDERIZADO ==========

  if (!isLoggedIn) {
    return (
      <div className="login-container">
        <div className="login-box">
          <h1>🧁 Vins Bakery</h1>
          <p>Sistema de Gestión Multi-Roles</p>
          
          {!mostrarRegistro ? (
            <>
              <form onSubmit={handleLogin}>
                <input type="email" name="correo" placeholder="Correo electrónico" required />
                <input type="password" name="contrasena" placeholder="Contraseña" required />
                <button type="submit" className="btn-login">Iniciar Sesión</button>
              </form>
              <div className="divider"><span>o</span></div>
              <button className="btn-registro-toggle" onClick={() => setMostrarRegistro(true)}>
                Crear Nueva Cuenta
              </button>
              <small className="info-login">
                👤 Admin: admin@vinsbakery.com | admin123<br/>
                👤 Empleado: empleado@vinsbakery.com | empleado123<br/>
                👤 Cliente: cliente@vinsbakery.com | cliente123
              </small>
            </>
          ) : (
            <>
              <h2 className="registro-titulo">Crear Cuenta Nueva</h2>
              <form onSubmit={handleRegistro}>
                <input type="text" name="nombre" placeholder="Nombre completo" required minLength="3" />
                <input type="email" name="correo" placeholder="Correo electrónico" required />
                <input type="password" name="contrasena" placeholder="Contraseña (mínimo 6 caracteres)" required minLength="6" />
                <input type="password" name="confirmarContrasena" placeholder="Confirmar contraseña" required minLength="6" />
                <select name="rol" required>
                  <option value="">Seleccionar rol</option>
                  <option value="cliente">Cliente</option>
                  <option value="empleado">Empleado</option>
                  <option value="administrador">Administrador</option>
                </select>
                <button type="submit" className="btn-registro">Registrarme</button>
              </form>
              <div className="divider"><span>o</span></div>
              <button className="btn-volver-login" onClick={() => setMostrarRegistro(false)}>
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
          <span className={`badge ${usuario?.rol}`}>
            {usuario?.rol === 'administrador' && '👑 Administrador'}
            {usuario?.rol === 'empleado' && '👤 Empleado'}
            {usuario?.rol === 'cliente' && '🛍️ Cliente'}
            {usuario?.rol === 'sistema' && '⚙️ Sistema'}
          </span>
        </div>
        
        <nav>
          <button className={vistaActual === 'dashboard' ? 'active' : ''} onClick={() => setVistaActual('dashboard')}>
            📊 Dashboard
          </button>
          
          {usuario?.rol === 'cliente' && (
            <>
              <button className={vistaActual === 'catalogo' ? 'active' : ''} onClick={() => setVistaActual('catalogo')}>
                🧁 Catálogo
              </button>
              <button className={vistaActual === 'mis-pedidos' ? 'active' : ''} onClick={() => setVistaActual('mis-pedidos')}>
                📦 Mis Pedidos
              </button>
              <button className={vistaActual === 'mi-perfil' ? 'active' : ''} onClick={() => setVistaActual('mi-perfil')}>
                👤 Mi Perfil
              </button>
              <button className={vistaActual === 'beneficios' ? 'active' : ''} onClick={() => setVistaActual('beneficios')}>
                🎁 Mis Beneficios
              </button>
            </>
          )}
          
          {usuario?.rol !== 'cliente' && (
            <>
              {tienePermiso('productos', 'puede_ver') && (
                <button className={vistaActual === 'productos' ? 'active' : ''} onClick={() => setVistaActual('productos')}>
                  🧁 Productos
                </button>
              )}
              
              {tienePermiso('clientes', 'puede_ver') && (
                <>
                  <button className={vistaActual === 'clientes' ? 'active' : ''} onClick={() => setVistaActual('clientes')}>
                    👥 Clientes
                  </button>
                  {/* ✅ NUEVO BOTÓN */}
                  <button 
                    className={vistaActual === 'perfiles-pendientes' ? 'active' : ''} 
                    onClick={() => {
                      setVistaActual('perfiles-pendientes');
                      cargarPerfilesPendientes();
                    }}
                  >
                    ⏳ Perfiles Pendientes {perfilesPendientes.length > 0 && `(${perfilesPendientes.length})`}
                  </button>
                </>
              )}
              
              {tienePermiso('pedidos', 'puede_crear') && (
                <button className={vistaActual === 'nuevo-pedido' ? 'active' : ''} onClick={() => setVistaActual('nuevo-pedido')}>
                  ➕ Nuevo Pedido
                </button>
              )}
              
              {tienePermiso('pedidos', 'puede_ver') && (
                <button className={vistaActual === 'pedidos' ? 'active' : ''} onClick={() => setVistaActual('pedidos')}>
                  📦 Pedidos
                </button>
              )}
              
              {tienePermiso('inventario', 'puede_ver') && (
                <button className={vistaActual === 'alertas' ? 'active' : ''} onClick={() => setVistaActual('alertas')}>
                  🔔 Alertas Stock {alertasStock.length > 0 && `(${alertasStock.length})`}
                </button>
              )}
              
              {usuario?.rol === 'administrador' && tienePermiso('seguridad', 'puede_ver') && (
                <button className={vistaActual === 'log' ? 'active' : ''} onClick={() => setVistaActual('log')}>
                  📋 Log Actividades
                </button>
              )}
              
              {usuario?.rol === 'administrador' && tienePermiso('usuarios', 'puede_ver') && (
                <button className={vistaActual === 'usuarios' ? 'active' : ''} onClick={() => setVistaActual('usuarios')}>
                  👥 Usuarios
                </button>
              )}
            </>
          )}
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
              {estadisticas.alertas > 0 && (
                <div className="stat-card alerta">
                  <h3>🔔 Alertas Stock</h3>
                  <p className="stat-number">{estadisticas.alertas}</p>
                </div>
              )}
            </div>

            {tienePermiso('clientes', 'puede_ver') && (
              <div className="section">
                <h2>Clientes VIP (Nivel Oro)</h2>
                <div className="clientes-vip">
                  {clientes.filter(c => c.nivel_fidelidad === 'Oro').slice(0, 6).map(cliente => (
                    <div key={cliente.id_cliente} className="cliente-vip-card">
                      <h4>{cliente.nombre}</h4>
                      <span className="badge gold">⭐ Oro - {cliente.descuento_actual}% desc.</span>
                      <p>{cliente.total_compras} compras</p>
                      <p>${cliente.monto_total?.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* PRODUCTOS */}
        {vistaActual === 'productos' && tienePermiso('productos', 'puede_ver') && (
          <div>
            <h1>Gestión de Productos</h1>
            
            {tienePermiso('productos', 'puede_crear') && (
              <div className="form-card">
                <h2>Nuevo Producto</h2>
                <form onSubmit={crearProducto} className="form-grid">
                  <input type="text" placeholder="Nombre" value={formProducto.nombre}
                    onChange={(e) => setFormProducto({...formProducto, nombre: e.target.value})} required />
                  <input type="text" placeholder="Descripción" value={formProducto.descripcion}
                    onChange={(e) => setFormProducto({...formProducto, descripcion: e.target.value})} />
                  <input type="number" placeholder="Precio" value={formProducto.precio}
                    onChange={(e) => setFormProducto({...formProducto, precio: e.target.value})} required />
                  <input type="number" placeholder="Stock" value={formProducto.stock}
                    onChange={(e) => setFormProducto({...formProducto, stock: e.target.value})} required />
                  <select value={formProducto.categoria}
                    onChange={(e) => setFormProducto({...formProducto, categoria: e.target.value})} required>
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
            )}

            <div className="productos-grid">
              {productos.map(producto => (
                <div key={producto.id_producto} className="producto-card">
                  <h3>{producto.nombre}</h3>
                  <p className="categoria">{producto.categoria}</p>
                  <p className="descripcion">{producto.descripcion}</p>
                  <p className="precio">${producto.precio?.toLocaleString()}</p>
                  <p className="stock">Stock: {producto.stock}</p>
                  {tienePermiso('productos', 'puede_eliminar') && (
                    <button onClick={() => eliminarProducto(producto.id_producto)} className="btn-delete">
                      Eliminar
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CLIENTES */}
        {vistaActual === 'clientes' && tienePermiso('clientes', 'puede_ver') && (
          <div>
            <h1>Gestión de Clientes</h1>
            
            {tienePermiso('clientes', 'puede_crear') && (
              <div className="form-card">
                <h2>Nuevo Cliente</h2>
                <form onSubmit={crearCliente} className="form-grid">
                  <input type="text" placeholder="Nombre completo" value={formCliente.nombre}
                    onChange={(e) => setFormCliente({...formCliente, nombre: e.target.value})} required />
                  <input type="tel" placeholder="Teléfono" value={formCliente.telefono}
                    onChange={(e) => setFormCliente({...formCliente, telefono: e.target.value})} required />
                  <input type="email" placeholder="Correo (opcional)" value={formCliente.correo}
                    onChange={(e) => setFormCliente({...formCliente, correo: e.target.value})} />
                  <button type="submit" className="btn-primary">Registrar Cliente</button>
                </form>
              </div>
            )}

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
                      <td><span className={`badge ${cliente.nivel_fidelidad.toLowerCase()}`}>
                        {cliente.nivel_fidelidad}
                      </span></td>
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
        {vistaActual === 'perfiles-pendientes' && tienePermiso('clientes', 'puede_ver') && (
          <div>
            <h1>⏳ Perfiles Pendientes de Aprobación</h1>
            
            <button 
              onClick={cargarPerfilesPendientes} 
              className="btn-primary" 
              style={{marginBottom: '20px'}}
            >
              🔄 Actualizar Lista
            </button>

            {perfilesPendientes.length === 0 ? (
              <div className="section">
                <p style={{textAlign: 'center', color: '#4caf50', fontSize: '1.2em'}}>
                  ✅ No hay perfiles pendientes de aprobación
                </p>
              </div>
            ) : (
              <>
                <div className="section" style={{background: '#fff8e1', marginBottom: '20px', border: '2px solid #ff9800'}}>
                  <h3 style={{color: '#f57c00', marginBottom: '10px'}}>
                    ⚠️ Hay {perfilesPendientes.length} perfil{perfilesPendientes.length !== 1 ? 'es' : ''} pendiente{perfilesPendientes.length !== 1 ? 's' : ''} de aprobación
                  </h3>
                  <p style={{color: '#666'}}>
                    Revisa la información de cada cliente antes de aprobar o rechazar su perfil.
                  </p>
                </div>

                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Nombre</th>
                        <th>Teléfono</th>
                        <th>Correo</th>
                        <th>Fecha de Nacimiento</th>
                        <th>Fecha Registro</th>
                        <th>Perfil Completo</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perfilesPendientes.map(cliente => (
                        <tr key={cliente.id_cliente} style={{background: '#fff8e1'}}>
                          <td><strong>#{cliente.id_cliente}</strong></td>
                          <td><strong>{cliente.nombre}</strong></td>
                          <td>{cliente.telefono || '❌ No registrado'}</td>
                          <td>{cliente.correo_usuario || cliente.correo || '❌ No registrado'}</td>
                          <td>
                            {cliente.fecha_nacimiento ? (
                              <span>
                                📅 {new Date(cliente.fecha_nacimiento).toLocaleDateString('es-ES', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </span>
                            ) : (
                              <span style={{color: '#ff6f00', fontWeight: 'bold'}}>
                                ⚠️ Sin fecha de nacimiento
                              </span>
                            )}
                          </td>
                          <td>
                            {new Date(cliente.fecha_registro || cliente.fecha_registro_usuario).toLocaleDateString('es-ES', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td>
                            {cliente.perfil_completo ? (
                              <span className="badge" style={{background: '#4caf50', color: 'white'}}>
                                ✅ Completo
                              </span>
                            ) : (
                              <span className="badge" style={{background: '#ff9800', color: 'white'}}>
                                ⚠️ Incompleto
                              </span>
                            )}
                          </td>
                          <td>
                            <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
                              <button 
                                onClick={() => aprobarPerfil(cliente.id_cliente)}
                                className="btn-primary"
                                style={{
                                  padding: '8px 16px',
                                  fontSize: '14px',
                                  background: 'linear-gradient(135deg, #4caf50 0%, #66bb6a 100%)'
                                }}
                                title="Aprobar perfil de cliente"
                              >
                                ✅ Aprobar
                              </button>
                              <button 
                                onClick={() => rechazarPerfil(cliente.id_cliente)}
                                className="btn-delete"
                                style={{
                                  padding: '8px 16px',
                                  fontSize: '14px'
                                }}
                                title="Rechazar perfil"
                              >
                                ❌ Rechazar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="section" style={{marginTop: '30px', background: '#e3f2fd', border: '2px solid #1976d2'}}>
                  <h3 style={{color: '#1976d2', marginBottom: '15px'}}>
                    ℹ️ Información sobre Aprobación de Perfiles
                  </h3>
                  <ul style={{lineHeight: '2', color: '#555', paddingLeft: '20px'}}>
                    <li>
                      <strong>Perfil Completo:</strong> El cliente ha registrado toda su información incluyendo fecha de nacimiento
                    </li>
                    <li>
                      <strong>Perfil Incompleto:</strong> Falta información (generalmente fecha de nacimiento). Puedes aprobar igual y el cliente podrá completarlo después
                    </li>
                    <li>
                      <strong>Al aprobar:</strong> El cliente podrá iniciar sesión y realizar pedidos en línea inmediatamente
                    </li>
                    <li>
                      <strong>Al rechazar:</strong> El perfil será desactivado y el cliente no podrá acceder al sistema
                    </li>
                    <li>
                      <strong>Beneficios:</strong> Los clientes aprobados comienzan con nivel Bronce y pueden acumular descuentos según sus compras
                    </li>
                  </ul>
                </div>
              </>
            )}
          </div>
        )}

        {/* NUEVO PEDIDO */}
        {vistaActual === 'nuevo-pedido' && tienePermiso('pedidos', 'puede_crear') && (
          <div>
            <h1>Crear Nuevo Pedido</h1>
            
            <div className="pedido-container">
              <div className="form-card">
                <h2>1. Seleccionar Cliente</h2>
                {!pedidoActual.cliente ? (
                  <div>
                    <input type="tel" placeholder="Buscar por teléfono"
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

              <div className="form-card">
                <h2>2. Seleccionar Productos</h2>
                <div className="productos-grid-small">
                  {productos.map(producto => (
                    <div key={producto.id_producto} className="producto-card-small">
                      <h4>{producto.nombre}</h4>
                      <p>${producto.precio?.toLocaleString()}</p>
                      <p className="stock-small">Stock: {producto.stock}</p>
                      <button onClick={() => agregarProductoAPedido(producto)}
                        disabled={producto.stock === 0} className="btn-add">
                        Agregar
                      </button>
                    </div>
                  ))}
                </div>
              </div>

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
                              <input type="number" min="1" value={p.cantidad}
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
                              <button onClick={() => eliminarProductoDePedido(p.id_producto)}
                                className="btn-delete-small">✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="totales">
                        <p>Subtotal: ${calcularTotalPedido().subtotal.toLocaleString()}</p>
                        {pedidoActual.cliente && (
                          <>
                            {/* Mostrar descuento base */}
                            <p className="descuento">
                              Descuento Base ({pedidoActual.cliente.descuento_actual}%): 
                              -${((calcularTotalPedido().subtotal * pedidoActual.cliente.descuento_actual) / 100).toLocaleString()}
                            </p>
                            
                            {/* ✅ VERIFICAR Y MOSTRAR DESCUENTO DE CUMPLEAÑOS */}
                            {pedidoActual.cliente.fecha_nacimiento && (() => {
                              const hoy = new Date();
                              const cumple = new Date(pedidoActual.cliente.fecha_nacimiento);
                              const esCumpleanos = hoy.getDate() === cumple.getDate() && 
                                                  hoy.getMonth() === cumple.getMonth();
                              
                              if (esCumpleanos) {
                                return (
                                  <>
                                    <p className="descuento" style={{color: '#ff69b4', fontWeight: 'bold'}}>
                                      🎂 ¡Descuento Cumpleaños! (15%): 
                                      -${((calcularTotalPedido().subtotal * 15) / 100).toLocaleString()}
                                    </p>
                                    <p style={{color: '#ff69b4', fontStyle: 'italic', fontSize: '0.9em'}}>
                                      ¡Feliz Cumpleaños {pedidoActual.cliente.nombre}! 🎉
                                    </p>
                                  </>
                                );
                              }
                              return null;
                            })()}
                            
                            <p className="descuento" style={{fontSize: '1.1em', fontWeight: 'bold'}}>
                              Descuento Total: -${calcularTotalPedido().descuento.toLocaleString()}
                            </p>
                          </>
                        )}
                        <h3>Total a Pagar: ${calcularTotalPedido().total.toLocaleString()}</h3>
                      </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* LISTA DE PEDIDOS */}
        {vistaActual === 'pedidos' && tienePermiso('pedidos', 'puede_ver') && (
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

        {/* ALERTAS DE STOCK */}
        {vistaActual === 'alertas' && tienePermiso('inventario', 'puede_ver') && (
          <div>
            <h1>🔔 Alertas de Stock</h1>
            
            {alertasStock.length === 0 ? (
              <div className="section">
                <p style={{textAlign: 'center', color: '#4caf50', fontSize: '1.2em'}}>
                  ✅ No hay alertas activas
                </p>
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Categoría</th>
                      <th>Tipo Alerta</th>
                      <th>Stock Actual</th>
                      <th>Umbral</th>
                      <th>Fecha</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alertasStock.map(alerta => (
                      <tr key={alerta.id_alerta} className={alerta.tipo_alerta === 'agotado' ? 'alerta-critica' : ''}>
                        <td>{alerta.nombre_producto}</td>
                        <td>{alerta.categoria}</td>
                        <td>
                          <span className={`badge ${alerta.tipo_alerta}`}>
                            {alerta.tipo_alerta === 'agotado' && '🚨 AGOTADO'}
                            {alerta.tipo_alerta === 'bajo' && '⚠️ Stock Bajo'}
                            {alerta.tipo_alerta === 'critico' && '❗ Crítico'}
                          </span>
                        </td>
                        <td><strong>{alerta.stock_actual}</strong></td>
                        <td>{alerta.umbral}</td>
                        <td>{new Date(alerta.fecha_alerta).toLocaleDateString()}</td>
                        <td>
                          <button onClick={() => resolverAlerta(alerta.id_alerta)} className="btn-primary">
                            Resolver
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* LOG DE ACTIVIDADES - Solo Administradores */}
        {vistaActual === 'log' && usuario?.rol === 'administrador' && (
          <div>
            <h1>📋 Log de Actividades</h1>
            <button onClick={async () => {
              try {
                const response = await axios.get(`${API_URL}/log-actividades`);
                setLogActividades(response.data);
              } catch (error) {
                alert('Error al cargar log');
              }
            }} className="btn-primary" style={{marginBottom: '20px'}}>
              Actualizar Log
            </button>

            {logActividades.length === 0 ? (
              <div className="section">
                <p style={{textAlign: 'center'}}>Haz clic en "Actualizar Log" para ver las actividades</p>
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha/Hora</th>
                      <th>Usuario</th>
                      <th>Rol</th>
                      <th>Módulo</th>
                      <th>Acción</th>
                      <th>Detalle</th>
                      <th>IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logActividades.map(log => (
                      <tr key={log.id_log}>
                        <td>{new Date(log.fecha_hora).toLocaleString()}</td>
                        <td>{log.usuario_nombre}</td>
                        <td>
                          <span className={`badge ${log.rol}`}>
                            {log.rol}
                          </span>
                        </td>
                        <td>{log.modulo}</td>
                        <td>{log.accion}</td>
                        <td>{log.detalle || '-'}</td>
                        <td>{log.ip_address || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* USUARIOS - Solo Administradores */}
        {vistaActual === 'usuarios' && usuario?.rol === 'administrador' && (
          <div>
            <h1>👥 Gestión de Usuarios</h1>
            
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nombre</th>
                    <th>Correo</th>
                    <th>Rol</th>
                    <th>Fecha Registro</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map(user => (
                    <tr key={user.id_usuario}>
                      <td>#{user.id_usuario}</td>
                      <td>{user.nombre}</td>
                      <td>{user.correo}</td>
                      <td>
                        <span className={`badge ${user.rol}`}>
                          {user.rol === 'administrador' && '👑 Administrador'}
                          {user.rol === 'empleado' && '👤 Empleado'}
                          {user.rol === 'cliente' && '🛍️ Cliente'}
                          {user.rol === 'sistema' && '⚙️ Sistema'}
                        </span>
                      </td>
                      <td>{new Date(user.fecha_registro).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========== VISTAS PARA CLIENTES ========== */}
        
        {/* CATÁLOGO - Vista Cliente */}
        {vistaActual === 'catalogo' && usuario?.rol === 'cliente' && (
          <div>
            <h1>🧁 Catálogo de Productos</h1>
            <div className="productos-grid">
              {productos.map(producto => (
                <div key={producto.id_producto} className="producto-card">
                  <h3>{producto.nombre}</h3>
                  <p className="categoria">{producto.categoria}</p>
                  <p className="descripcion">{producto.descripcion}</p>
                  <p className="precio">${producto.precio?.toLocaleString()}</p>
                  <p className="stock">
                    {producto.stock > 0 ? `✅ Disponible (${producto.stock})` : '❌ Agotado'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MIS PEDIDOS - Vista Cliente CON VALIDACIÓN */}
        {vistaActual === 'mis-pedidos' && usuario?.rol === 'cliente' && (
          <div>
            <h1>📦 Mis Pedidos</h1>
            
            {!tieneCliente ? (
              <div className="section perfil-incompleto">
                <h2>⚠️ Perfil Incompleto</h2>
                <p>Tu cuenta de usuario no tiene un perfil de cliente asociado.</p>
                <p>Por favor contacta a un empleado o administrador para que complete tu registro.</p>
              </div>
            ) : (
              <>
                <button 
                  onClick={cargarMisPedidos} 
                  className="btn-primary" 
                  style={{marginBottom: '20px'}}
                  disabled={cargandoPerfil}
                >
                  {cargandoPerfil ? 'Cargando...' : 'Actualizar Pedidos'}
                </button>

                {cargandoPerfil ? (
                  <div className="section loading-section">
                    <p>Cargando pedidos...</p>
                  </div>
                ) : misPedidos.length === 0 ? (
                  <div className="section">
                    <p style={{textAlign: 'center', color: '#666'}}>
                      No tienes pedidos aún. ¡Explora nuestro catálogo!
                    </p>
                  </div>
                ) : (
                  <div className="mis-pedidos-grid">
                    {misPedidos.map(pedido => (
                      <div key={pedido.id_pedido} className="pedido-card">
                        <h3>Pedido #{pedido.id_pedido}</h3>
                        <p className="pedido-info">
                          📅 {new Date(pedido.fecha_pedido).toLocaleDateString('es-ES', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                        <p className="pedido-info">
                          Estado: <span className="badge">{pedido.estado}</span>
                        </p>
                        <p className="pedido-info">
                          Tu nivel: <span className={`badge ${pedido.nivel_fidelidad?.toLowerCase()}`}>
                            {pedido.nivel_fidelidad}
                          </span>
                        </p>
                        {pedido.descuento > 0 && (
                          <p className="pedido-info descuento">
                            💰 Descuento aplicado: ${pedido.descuento.toLocaleString()}
                          </p>
                        )}
                        {pedido.notas && (
                          <p className="pedido-info pedido-notas">
                            📝 {pedido.notas}
                          </p>
                        )}
                        <p className="pedido-total">${pedido.total_final?.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* MI PERFIL - Vista Cliente CON VALIDACIÓN */}
        {vistaActual === 'mi-perfil' && usuario?.rol === 'cliente' && (
          <div>
            <h1>👤 Mi Perfil</h1>
            
            {!tieneCliente ? (
              <div className="section perfil-incompleto">
                <h2>⚠️ Perfil Incompleto</h2>
                <p>Tu cuenta de usuario no tiene un perfil de cliente asociado.</p>
                <p>Por favor contacta a un empleado o administrador para que complete tu registro.</p>
              </div>
            ) : (
              <>
                <button 
                  onClick={cargarMiPerfil} 
                  className="btn-primary" 
                  style={{marginBottom: '20px'}}
                  disabled={cargandoPerfil}
                >
                  {cargandoPerfil ? 'Cargando...' : 'Actualizar Información'}
                </button>

                {cargandoPerfil ? (
                  <div className="section loading-section">
                    <p>Cargando perfil...</p>
                  </div>
                ) : miPerfil ? (
                  <>
                    <div className="perfil-card">
                      <h2>Información Personal</h2>
                      <div className="perfil-info">
                        <div className="perfil-item">
                          <h4>Nombre</h4>
                          <p>{miPerfil.nombre}</p>
                        </div>
                        <div className="perfil-item">
                          <h4>Teléfono</h4>
                          <p>{miPerfil.telefono}</p>
                        </div>
                        <div className="perfil-item">
                          <h4>Correo</h4>
                          <p>{miPerfil.correo || 'No registrado'}</p>
                        </div>
                        <div className="perfil-item">
                          <h4>Nivel de Fidelidad</h4>
                          <p>
                            <span className={`badge ${miPerfil.nivel_fidelidad?.toLowerCase()}`}>
                              {miPerfil.nivel_fidelidad}
                            </span>
                          </p>
                        </div>
                        <div className="perfil-item">
                          <h4>Descuento Actual</h4>
                          <p>{miPerfil.descuento_actual}%</p>
                        </div>
                        <div className="perfil-item">
                          <h4>Total de Compras</h4>
                          <p>{miPerfil.total_compras}</p>
                        </div>
                        <div className="perfil-item">
                          <h4>Monto Total Gastado</h4>
                          <p>${miPerfil.monto_total?.toLocaleString()}</p>
                        </div>
                        <div className="perfil-item">
                          <h4>Miembro desde</h4>
                          <p>{new Date(miPerfil.fecha_registro).toLocaleDateString('es-ES', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}</p>
                        </div>
                      </div>
                    </div>

                    <div className="section" style={{marginTop: '30px'}}>
                      <h2>Progreso de Fidelidad</h2>
                      <p style={{marginBottom: '15px', color: '#666'}}>
                        Sigue comprando para alcanzar el siguiente nivel y obtener más beneficios
                      </p>
                      {miPerfil.nivel_fidelidad === 'Bronce' && (
                        <p style={{fontSize: '1.1em'}}>
                          🥈 Te faltan <strong>{5 - miPerfil.total_compras}</strong> compras para nivel Plata (5% descuento)
                        </p>
                      )}
                      {miPerfil.nivel_fidelidad === 'Plata' && (
                        <p style={{fontSize: '1.1em'}}>
                          🥇 Te faltan <strong>{10 - miPerfil.total_compras}</strong> compras para nivel Oro (10% descuento)
                        </p>
                      )}
                      {miPerfil.nivel_fidelidad === 'Oro' && (
                        <p style={{fontSize: '1.1em', color: '#4caf50'}}>
                          ⭐ ¡Felicitaciones! Has alcanzado el nivel máximo con 10% de descuento permanente
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="section">
                    <p style={{textAlign: 'center', color: '#666'}}>
                      No se pudo cargar tu perfil. Intenta nuevamente.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* BENEFICIOS - Vista Cliente CON VALIDACIÓN */}
        {vistaActual === 'beneficios' && usuario?.rol === 'cliente' && (
          <div>
            <h1>🎁 Mis Beneficios</h1>
            
            {!tieneCliente ? (
              <div className="section perfil-incompleto">
                <h2>⚠️ Perfil Incompleto</h2>
                <p>Tu cuenta de usuario no tiene un perfil de cliente asociado.</p>
                <p>Por favor contacta a un empleado o administrador para que complete tu registro.</p>
              </div>
            ) : (
              <>
                <button 
                  onClick={cargarBeneficios} 
                  className="btn-primary" 
                  style={{marginBottom: '20px'}}
                  disabled={cargandoPerfil}
                >
                  {cargandoPerfil ? 'Cargando...' : 'Actualizar Beneficios'}
                </button>

                {cargandoPerfil ? (
                  <div className="section loading-section">
                    <p>Cargando beneficios...</p>
                  </div>
                ) : beneficiosDisponibles.length === 0 ? (
                  <div className="section">
                    <p style={{textAlign: 'center', color: '#666'}}>
                      No tienes beneficios disponibles en este momento
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="beneficios-grid">
                      {beneficiosDisponibles.filter(b => !b.usado).map(beneficio => (
                        <div key={beneficio.id_beneficio} className="beneficio-card">
                          <div className="beneficio-icono">
                            {beneficio.tipo_beneficio === 'cumpleanos' && '🎂'}
                            {beneficio.tipo_beneficio === 'caja_galletas' && '🍪'}
                          </div>
                          <h4>
                            {beneficio.tipo_beneficio === 'cumpleanos' && '15% Descuento Cumpleaños'}
                            {beneficio.tipo_beneficio === 'caja_galletas' && 'Caja de Galletas Gratis'}
                          </h4>
                          <p>📅 Disponible desde: {new Date(beneficio.fecha_aplicacion).toLocaleDateString('es-ES')}</p>
                          <p style={{marginTop: '10px', fontWeight: 'bold', color: '#2e7d32'}}>
                            ✅ Beneficio Activo
                          </p>
                          {beneficio.notas && (
                            <p style={{fontSize: '0.9em', marginTop: '10px'}}>
                              {beneficio.notas}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    {beneficiosDisponibles.some(b => b.usado) && (
                      <div style={{marginTop: '40px'}}>
                        <h2>Beneficios Usados</h2>
                        <div className="beneficios-grid">
                          {beneficiosDisponibles.filter(b => b.usado).map(beneficio => (
                            <div key={beneficio.id_beneficio} className="beneficio-card usado">
                              <div className="beneficio-icono">
                                {beneficio.tipo_beneficio === 'cumpleanos' && '🎂'}
                                {beneficio.tipo_beneficio === 'caja_galletas' && '🍪'}
                              </div>
                              <h4>
                                {beneficio.tipo_beneficio === 'cumpleanos' && '15% Descuento Cumpleaños'}
                                {beneficio.tipo_beneficio === 'caja_galletas' && 'Caja de Galletas Gratis'}
                              </h4>
                              <p>✓ Usado el: {new Date(beneficio.fecha_uso).toLocaleDateString('es-ES')}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="section" style={{marginTop: '30px'}}>
                  <h2>¿Cómo obtener más beneficios?</h2>
                  <ul style={{lineHeight: '2', color: '#666', paddingLeft: '20px'}}>
                    <li>🍪 Por cada 10 compras, recibe una caja de galletas gratis</li>
                    <li>⭐ Alcanza nivel Oro y obtén 10% de descuento permanente</li>
                    <li>🎂 Recibe un descuento especial del 15% en tu mes de cumpleaños</li>
                  </ul>
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

export default App;