let productos = [];
let productosEnCarrito = [];

// Inicializar aplicación
async function inicializarApp() {
    try {
        // Esperar a que la base de datos esté lista
        if (window.dbManager) {
            await window.dbManager.init();
            console.log('App: Base de datos inicializada');
        }

        // Cargar productos desde JSON o IndexedDB
        await cargarProductosIniciales();
        
        // Cargar carrito desde IndexedDB
        await cargarCarritoDesdeDB();
        
        // Configurar eventos
        configurarEventos();
        
        console.log('App: Inicialización completada');
    } catch (error) {
        console.error('App: Error durante la inicialización:', error);
        // Fallback a localStorage si IndexedDB falla
        cargarProductosDesdeJSON();
        cargarCarritoDesdeLocalStorage();
    }
}

// Cargar productos iniciales
async function cargarProductosIniciales() {
    try {
        // Intentar cargar desde IndexedDB primero
        if (window.dbManager) {
            const productosDB = await window.dbManager.obtenerProductos();
            
            if (productosDB && productosDB.length > 0) {
                productos = productosDB;
                console.log('App: Productos cargados desde IndexedDB');
                cargarProductos(productos);
                return;
            }
        }

        // Si no hay productos en DB, cargar desde JSON
        await cargarProductosDesdeJSON();
        
        // Guardar en IndexedDB para uso offline
        if (window.dbManager && productos.length > 0) {
            await window.dbManager.guardarProductos(productos);
            console.log('App: Productos guardados en IndexedDB');
        }
    } catch (error) {
        console.error('App: Error al cargar productos iniciales:', error);
        await cargarProductosDesdeJSON();
    }
}

// Cargar productos desde JSON
async function cargarProductosDesdeJSON() {
    try {
        const response = await fetch("./js/productos.json");
        const data = await response.json();
        productos = data;
        cargarProductos(productos);
        console.log('App: Productos cargados desde JSON');
    } catch (error) {
        console.error('App: Error al cargar productos desde JSON:', error);
        mostrarErrorCarga();
    }
}

// Cargar carrito desde IndexedDB
async function cargarCarritoDesdeDB() {
    try {
        if (window.dbManager) {
            productosEnCarrito = await window.dbManager.obtenerCarrito();
            console.log('App: Carrito cargado desde IndexedDB');
        } else {
            // Fallback a localStorage
            cargarCarritoDesdeLocalStorage();
        }
        actualizarNumerito();
    } catch (error) {
        console.error('App: Error al cargar carrito desde DB:', error);
        cargarCarritoDesdeLocalStorage();
    }
}

// Fallback para cargar carrito desde localStorage
function cargarCarritoDesdeLocalStorage() {
    let productosEnCarritoLS = localStorage.getItem("productos-en-carrito");
    if (productosEnCarritoLS) {
        productosEnCarrito = JSON.parse(productosEnCarritoLS);
        console.log('App: Carrito cargado desde localStorage');
    } else {
        productosEnCarrito = [];
    }
    actualizarNumerito();
}

// Configurar eventos de la aplicación
function configurarEventos() {
    // Eventos de categorías
    botonesCategorias.forEach(boton => {
        boton.addEventListener("click", (e) => {
            // Cerrar menú en móvil
            aside.classList.remove("aside-visible");
            
            // Actualizar categoría activa
            botonesCategorias.forEach(btn => btn.classList.remove("active"));
            e.currentTarget.classList.add("active");

            // Filtrar productos
            filtrarPorCategoria(e.currentTarget.id);
        });
    });
}

// Filtrar productos por categoría
function filtrarPorCategoria(categoriaId) {
    if (categoriaId !== "todos") {
        const productoCategoria = productos.find(producto => producto.categoria.id === categoriaId);
        if (productoCategoria) {
            tituloPrincipal.innerText = productoCategoria.categoria.nombre;
            const productosBoton = productos.filter(producto => producto.categoria.id === categoriaId);
            cargarProductos(productosBoton);
        }
    } else {
        tituloPrincipal.innerText = "Todos los repuestos";
        cargarProductos(productos);
    }
}

// Mostrar error de carga
function mostrarErrorCarga() {
    contenedorProductos.innerHTML = `
        <div class="error-carga">
            <i class="bi bi-exclamation-triangle" style="font-size: 3rem; color: #ff0000; margin-bottom: 1rem;"></i>
            <h3>Error al cargar productos</h3>
            <p>No se pudieron cargar los productos. Verifica tu conexión e intenta nuevamente.</p>
            <button onclick="location.reload()" class="producto-agregar">
                <i class="bi bi-arrow-clockwise"></i> Reintentar
            </button>
        </div>
    `;
}

// Elementos del DOM
const contenedorProductos = document.querySelector("#contenedor-productos");
const botonesCategorias = document.querySelectorAll(".boton-categoria");
const tituloPrincipal = document.querySelector("#titulo-principal");
const numerito = document.querySelector("#numerito");
const aside = document.querySelector("aside");
let botonesAgregar = document.querySelectorAll(".producto-agregar");

// Función para cargar productos en el DOM
function cargarProductos(productosElegidos) {
    contenedorProductos.innerHTML = "";

    if (!productosElegidos || productosElegidos.length === 0) {
        contenedorProductos.innerHTML = `
            <div class="sin-productos">
                <i class="bi bi-box" style="font-size: 3rem; color: #666; margin-bottom: 1rem;"></i>
                <h3>No hay productos disponibles</h3>
                <p>No se encontraron productos en esta categoría.</p>
            </div>
        `;
        return;
    }

    productosElegidos.forEach(producto => {
        const div = document.createElement("div");
        div.classList.add("producto");
        div.innerHTML = `
            <img class="producto-imagen" src="${producto.imagen}" alt="${producto.titulo}" loading="lazy">
            <div class="producto-detalles">
                <h3 class="producto-titulo">${producto.titulo}</h3>
                <p class="producto-precio">$${producto.precio.toLocaleString('es-CO')}</p>
                <button class="producto-agregar" id="${producto.id}" data-producto='${JSON.stringify(producto)}'>
                    <i class="bi bi-cart-plus"></i> Agregar al carrito
                </button>
            </div>
        `;

        contenedorProductos.append(div);
    });

    actualizarBotonesAgregar();
}

// Actualizar botones de agregar al carrito
function actualizarBotonesAgregar() {
    botonesAgregar = document.querySelectorAll(".producto-agregar");

    botonesAgregar.forEach(boton => {
        boton.addEventListener("click", agregarAlCarrito);
    });
}

// Agregar producto al carrito
async function agregarAlCarrito(e) {
    const boton = e.currentTarget;
    const idBoton = boton.id;
    
    try {
        // Obtener datos del producto
        const productoData = boton.getAttribute('data-producto');
        const productoAgregado = productoData ? JSON.parse(productoData) : productos.find(producto => producto.id === idBoton);

        if (!productoAgregado) {
            console.error('App: Producto no encontrado');
            return;
        }

        // Agregar a IndexedDB
        let agregadoExitosamente = false;
        if (window.dbManager) {
            agregadoExitosamente = await window.dbManager.agregarAlCarrito(productoAgregado);
        }

        // Fallback a localStorage si falla IndexedDB
        if (!agregadoExitosamente) {
            agregarAlCarritoLocalStorage(productoAgregado);
        }

        // Actualizar carrito en memoria
        const index = productosEnCarrito.findIndex(producto => producto.id === idBoton);
        if (index !== -1) {
            productosEnCarrito[index].cantidad++;
        } else {
            productosEnCarrito.push({
                ...productoAgregado,
                cantidad: 1
            });
        }

        // Mostrar notificación
        mostrarToast("Repuesto agregado al carrito", "success");
        
        // Actualizar contador
        actualizarNumerito();

        // Efecto visual en el botón
        animarBotonAgregar(boton);

    } catch (error) {
        console.error('App: Error al agregar al carrito:', error);
        mostrarToast("Error al agregar producto", "error");
    }
}

// Fallback para agregar al carrito con localStorage
function agregarAlCarritoLocalStorage(productoAgregado) {
    let productosLS = JSON.parse(localStorage.getItem("productos-en-carrito")) || [];
    
    const index = productosLS.findIndex(producto => producto.id === productoAgregado.id);
    if (index !== -1) {
        productosLS[index].cantidad++;
    } else {
        productosLS.push({
            ...productoAgregado,
            cantidad: 1
        });
    }
    
    localStorage.setItem("productos-en-carrito", JSON.stringify(productosLS));
}

// Actualizar contador del carrito
async function actualizarNumerito() {
    let nuevoNumerito = 0;
    
    try {
        if (window.dbManager) {
            nuevoNumerito = await window.dbManager.obtenerContadorCarrito();
        } else {
            nuevoNumerito = productosEnCarrito.reduce((acc, producto) => acc + producto.cantidad, 0);
        }
    } catch (error) {
        console.error('App: Error al actualizar numerito:', error);
        nuevoNumerito = productosEnCarrito.reduce((acc, producto) => acc + producto.cantidad, 0);
    }
    
    if (numerito) {
        numerito.innerText = nuevoNumerito;
        
        // Efecto visual
        if (nuevoNumerito > 0) {
            numerito.style.transform = 'scale(1.2)';
            setTimeout(() => {
                numerito.style.transform = 'scale(1)';
            }, 200);
        }
    }
}

// Animación para botón agregar
function animarBotonAgregar(boton) {
    boton.style.transform = 'scale(0.95)';
    boton.style.backgroundColor = '#28a745';
    boton.innerHTML = '<i class="bi bi-check"></i> Agregado';
    
    setTimeout(() => {
        boton.style.transform = 'scale(1)';
        boton.style.backgroundColor = '';
        boton.innerHTML = '<i class="bi bi-cart-plus"></i> Agregar al carrito';
    }, 1000);
}

// Mostrar notificaciones
function mostrarToast(mensaje, tipo = "info") {
    if (typeof Toastify !== 'undefined') {
        const colores = {
            success: "linear-gradient(to right, #00b09b, #96c93d)",
            error: "linear-gradient(to right, #ff5f6d, #ffc371)",
            info: "linear-gradient(to right, #667eea, #764ba2)"
        };

        Toastify({
            text: mensaje,
            duration: 3000,
            close: true,
            gravity: "top",
            position: "right",
            stopOnFocus: true,
            style: {
                background: colores[tipo] || colores.info,
                borderRadius: "2rem",
                textTransform: "uppercase",
                fontSize: ".75rem"
            },
            offset: {
                x: '1.5rem',
                y: '1.5rem'
            }
        }).showToast();
    }
}

// Manejar errores de red
window.addEventListener('online', () => {
    console.log('App: Conexión restaurada');
    // Recargar productos desde servidor si es necesario
    if (productos.length === 0) {
        cargarProductosDesdeJSON();
    }
});

window.addEventListener('offline', () => {
    console.log('App: Modo offline');
});

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarApp);
} else {
    inicializarApp();
}