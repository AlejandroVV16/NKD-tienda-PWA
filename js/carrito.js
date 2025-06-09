// Carrito de compras con soporte PWA e IndexedDB
let productosEnCarrito = [];
let dbManager = null;

const contenedorCarritoVacio = document.querySelector("#carrito-vacio");
const contenedorCarritoProductos = document.querySelector("#carrito-productos");
const contenedorCarritoAcciones = document.querySelector("#carrito-acciones");
const contenedorCarritoComprado = document.querySelector("#carrito-comprado");
let botonesEliminar = [];
const botonVaciar = document.querySelector("#carrito-acciones-vaciar");
const contenedorTotal = document.querySelector("#total");
const botonComprar = document.querySelector("#carrito-acciones-comprar");

// Configuración de WhatsApp
const NUMERO_WHATSAPP = "573113081706";
const NOMBRE_TIENDA = "NKD Pereira";

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Carrito: Inicializando...');

    await esperarDBManager();

    // Eliminar migración desde localStorage para evitar borrado accidental de datos
    // Ahora solo cargamos productos desde IndexedDB
    await cargarProductosCarrito();

    console.log('Carrito: Inicialización completada');
});

// También escuchar el evento dbReady por si la DB se inicializa después
window.addEventListener('dbReady', async () => {
    if (!dbManager) {
        await esperarDBManager();
        await cargarProductosCarrito();
    }
});

// Esperar a que DBManager esté disponible
async function esperarDBManager() {
    return new Promise((resolve) => {
        const checkDB = () => {
            if (window.dbManager && window.dbManager.db) {
                dbManager = window.dbManager;
                console.log('Carrito: DBManager disponible');
                resolve();
            } else {
                setTimeout(checkDB, 100);
            }
        };
        checkDB();
    });
}

// Cargar productos del carrito desde IndexedDB y renderizar en DOM
async function cargarProductosCarrito() {
    try {
        console.log('Carrito: Cargando productos...');

        if (!dbManager) {
            console.error('Carrito: DBManager no disponible');
            mostrarCarritoVacio();
            return;
        }

        productosEnCarrito = await dbManager.obtenerCarrito();
        console.log('Carrito: Productos cargados:', productosEnCarrito.length);

        if (productosEnCarrito && productosEnCarrito.length > 0) {
            contenedorCarritoVacio.classList.add("disabled");
            contenedorCarritoProductos.classList.remove("disabled");
            contenedorCarritoAcciones.classList.remove("disabled");
            contenedorCarritoComprado.classList.add("disabled");

            contenedorCarritoProductos.innerHTML = "";

            productosEnCarrito.forEach(producto => {
                const div = document.createElement("div");
                div.classList.add("carrito-producto");
                div.innerHTML = `
                    <img class="carrito-producto-imagen" src="${producto.imagen}" alt="${producto.titulo}" loading="lazy" />
                    <div class="carrito-producto-titulo">
                        <small>Repuesto</small>
                        <h3>${producto.titulo}</h3>
                    </div>
                    <div class="carrito-producto-cantidad">
                        <small>Cantidad</small>
                        <div class="cantidad-controles">
                            <button class="cantidad-btn" data-id="${producto.id}" data-action="decrementar" aria-label="Disminuir cantidad de ${producto.titulo}">-</button>
                            <p class="cantidad-valor">${producto.cantidad}</p>
                            <button class="cantidad-btn" data-id="${producto.id}" data-action="incrementar" aria-label="Aumentar cantidad de ${producto.titulo}">+</button>
                        </div>
                    </div>
                    <div class="carrito-producto-precio">
                        <small>Precio</small>
                        <p>$${producto.precio.toLocaleString('es-CO')}</p>
                    </div>
                    <div class="carrito-producto-subtotal">
                        <small>Subtotal</small>
                        <p>$${(producto.precio * producto.cantidad).toLocaleString('es-CO')}</p>
                    </div>
                    <button class="carrito-producto-eliminar" data-id="${producto.id}" aria-label="Eliminar ${producto.titulo} del carrito">
                        <i class="bi bi-trash-fill"></i>
                    </button>
                `;

                contenedorCarritoProductos.appendChild(div);
            });

            actualizarBotonesEliminar();
            actualizarBotonesCantidad();
            actualizarTotal();
        } else {
            mostrarCarritoVacio();
        }
    } catch (error) {
        console.error('Carrito: Error al cargar productos:', error);
        mostrarCarritoVacio();
    }
}

// Mostrar carrito vacío
function mostrarCarritoVacio() {
    contenedorCarritoVacio.classList.remove("disabled");
    contenedorCarritoProductos.classList.add("disabled");
    contenedorCarritoAcciones.classList.add("disabled");
    contenedorCarritoComprado.classList.add("disabled");
}

// Actualizar botones eliminar de cada producto
function actualizarBotonesEliminar() {
    botonesEliminar = document.querySelectorAll(".carrito-producto-eliminar");
    botonesEliminar.forEach(boton => {
        boton.removeEventListener("click", eliminarDelCarrito);
        boton.addEventListener("click", eliminarDelCarrito);
    });
}

// Actualizar botones de cantidad (+ / -)
function actualizarBotonesCantidad() {
    const botonesCantidad = document.querySelectorAll(".cantidad-btn");
    botonesCantidad.forEach(boton => {
        boton.removeEventListener("click", modificarCantidad);
        boton.addEventListener("click", modificarCantidad);
    });
}

// Modificar cantidad de producto (incrementar o decrementar)
async function modificarCantidad(e) {
    const idProducto = e.currentTarget.dataset.id;
    const accion = e.currentTarget.dataset.action;

    if (!dbManager) {
        return;
    }

    try {
        if (accion === 'incrementar') {
            await dbManager.incrementarCantidad(idProducto);
        } else if (accion === 'decrementar') {
            await dbManager.decrementarCantidad(idProducto);
        }
        await cargarProductosCarrito();
        await actualizarNumerito();
    } catch (error) {
        console.error('Carrito: Error al modificar cantidad:', error);
    }
}

// Eliminar producto del carrito
async function eliminarDelCarrito(e) {
    const idProducto = e.currentTarget.dataset.id;

    if (!dbManager) {
        return;
    }

    try {
        await dbManager.eliminarDelCarrito(idProducto);
        await cargarProductosCarrito();
        await actualizarNumerito();
    } catch (error) {
        console.error('Carrito: Error al eliminar producto:', error);
    }
}

// Vaciar carrito completo
botonVaciar.addEventListener("click", async () => {
    try {
        const totalProductos = productosEnCarrito.reduce((acc, producto) => acc + producto.cantidad, 0);
        const resultado = await Swal.fire({
            title: '¿Estás seguro?',
            icon: 'question',
            html: `Se van a eliminar ${totalProductos} repuestos del carrito.`,
            showCancelButton: true,
            confirmButtonText: 'Sí, vaciar carrito',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#6b7280'
        });

        if (resultado.isConfirmed) {
            await dbManager.vaciarCarrito();
            await cargarProductosCarrito();
            await actualizarNumerito();
        }
    } catch (error) {
        console.error('Carrito: Error al vaciar carrito:', error);
    }
});

// Actualizar total del carrito
function actualizarTotal() {
    const totalCalculado = productosEnCarrito.reduce((acc, producto) =>
        acc + (producto.precio * producto.cantidad), 0);
    contenedorTotal.innerText = `$${totalCalculado.toLocaleString('es-CO')}`;
}

// Actualizar contador del carrito (numerito)
async function actualizarNumerito() {
    try {
        if (!dbManager) {
            return;
        }
        const totalProductos = await dbManager.obtenerContadorCarrito();

        const numerito = document.querySelector("#numerito");
        if (numerito) {
            numerito.innerText = totalProductos;
        }

        if ('BroadcastChannel' in window) {
            const channel = new BroadcastChannel('carrito-updates');
            channel.postMessage({
                type: 'carrito-actualizado',
                total: totalProductos
            });
            setTimeout(() => channel.close(), 1000);
        }
    } catch (error) {
        console.error('Carrito: Error al actualizar numerito:', error);
    }
}

// Escuchar actualizaciones del carrito desde otras pestañas
if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel('carrito-updates');
    channel.addEventListener('message', (event) => {
        if (event.data.type === 'carrito-actualizado') {
            const numerito = document.querySelector("#numerito");
            if (numerito) {
                numerito.innerText = event.data.total;
            }
        }
    });
}

console.log('Carrito.js: Script cargado correctamente');


// Generar mensaje de WhatsApp para la compra
function generarMensajeWhatsApp() {
    const totalCompra = productosEnCarrito.reduce((acc, producto) => acc + (producto.precio * producto.cantidad), 0);
    const cantidadProductos = productosEnCarrito.reduce((acc, producto) => acc + producto.cantidad, 0);
    const fecha = new Date().toLocaleDateString('es-CO');

    let mensaje = `🏍️ *${NOMBRE_TIENDA}* - Nueva Orden de Compra\n\n`;
    mensaje += `🗓️ *Fecha:* ${fecha}\n`;
    mensaje += `📦 *Productos solicitados:* ${cantidadProductos}\n\n`;
    mensaje += `*DETALLE DEL PEDIDO:*\n`;
    mensaje += `━━━━━━━━━━━━━━━━━━━━\n`;

    productosEnCarrito.forEach((producto, index) => {
        mensaje += `${index + 1}. *${producto.titulo}*\n`;
        mensaje += `   Cantidad: ${producto.cantidad}\n`;
        mensaje += `   Precio unitario: $${producto.precio.toLocaleString('es-CO')}\n`;
        mensaje += `   Subtotal: $${(producto.precio * producto.cantidad).toLocaleString('es-CO')}\n\n`;
    });

    mensaje += `━━━━━━━━━━━━━━━━━━━━\n`;
    mensaje += `💰 *TOTAL A PAGAR: $${totalCompra.toLocaleString('es-CO')}*\n\n`;
    mensaje += `✅ *Solicito cotización y disponibilidad*\n`;
    mensaje += `💳 *Medio de pago preferido:* A coordinar\n`;
    mensaje += `🚛 *Entrega:* A coordinar\n\n`;
    mensaje += `¡Gracias por elegir ${NOMBRE_TIENDA}! 🏍️`;

    return encodeURIComponent(mensaje);
}

// Abrir WhatsApp con mensaje prellenado
function abrirWhatsApp() {
    const mensaje = generarMensajeWhatsApp();
    const urlWhatsApp = `https://wa.me/${NUMERO_WHATSAPP}?text=${mensaje}`;

    window.open(urlWhatsApp, '_blank');
}

// Procesar compra al hacer clic en botón "Comprar ahora"
botonComprar.addEventListener("click", async () => {
    const totalCompra = productosEnCarrito.reduce((acc, producto) => acc + (producto.precio * producto.cantidad), 0);
    const cantidadProductos = productosEnCarrito.reduce((acc, producto) => acc + producto.cantidad, 0);

    try {
        const resultado = await Swal.fire({
            title: '¡Compra realizada!',
            icon: 'success',
            html: `
                <p>Has seleccionado ${cantidadProductos} repuestos</p>
                <p><strong>Total: $${totalCompra.toLocaleString('es-CO')}</strong></p>
                <p>¡Gracias por confiar en ${NOMBRE_TIENDA}!</p>
            `,
            confirmButtonText: 'Proceder al pago por WhatsApp',
            confirmButtonColor: '#25D366',
            showCancelButton: true,
            cancelButtonText: 'Cancelar',
            cancelButtonColor: '#6b7280'
        });

        if (resultado.isConfirmed) {
            const segundoResultado = await Swal.fire({
                title: '📱 Contactar por WhatsApp',
                icon: 'info',
                html: `
                    <p>Se abrirá WhatsApp con tu pedido completo.</p>
                    <p><strong>Podrás coordinar:</strong></p>
                    <ul style="text-align: left; display: inline-block;">
                        <li>✅ Disponibilidad de productos</li>
                        <li>💰 Método de pago</li>
                        <li>🚚 Forma de entrega</li>
                        <li>📍 Dirección de envío</li>
                    </ul>
                    <br>
                    <small>Si WhatsApp no se abre automáticamente, verifica que esté instalado en tu dispositivo.</small>
                `,
                confirmButtonText: 'Abrir WhatsApp',
                confirmButtonColor: '#25D366',
                showCancelButton: true,
                cancelButtonText: 'Volver',
                cancelButtonColor: '#6b7280'
            });

            if (segundoResultado.isConfirmed) {
                // Registrar la compra antes de limpiar el carrito
                await registrarCompra();

                // Abrir WhatsApp
                abrirWhatsApp();

                // Limpiar carrito después de un breve delay
                setTimeout(async () => {
                    try {
                        await dbManager.vaciarCarrito();
                        await actualizarNumerito();

                        contenedorCarritoVacio.classList.add("disabled");
                        contenedorCarritoProductos.classList.add("disabled");
                        contenedorCarritoAcciones.classList.add("disabled");
                        contenedorCarritoComprado.classList.remove("disabled");

                    } catch (error) {
                        console.error('Carrito: Error al limpiar después de compra:', error);
                    }
                }, 1000);
            }
        }
    } catch (error) {
        console.error('Carrito: Error durante la compra:', error);
        mostrarToast('Error al procesar la compra', 'error');
    }
});

// Registrar compra en historial en IndexedDB
async function registrarCompra() {
    try {
        const compra = {
            id: Date.now().toString(),
            fecha: new Date().toISOString(),
            productos: [...productosEnCarrito],
            total: productosEnCarrito.reduce((acc, producto) => acc + (producto.precio * producto.cantidad), 0),
            cantidad: productosEnCarrito.reduce((acc, producto) => acc + producto.cantidad, 0),
            estado: 'enviado_whatsapp'
        };

        await dbManager.registrarCompra(compra);
        console.log('Carrito: Compra registrada en historial');

    } catch (error) {
        console.error('Carrito: Error al registrar compra:', error);
    }
}

// Función para mostrar toast con Toastify.js
function mostrarToast(mensaje, tipo = 'info') {
    if (typeof Toastify !== 'undefined') {
        const colores = {
            success: 'linear-gradient(to right, #00b09b, #96c93d)',
            error: 'linear-gradient(to right, #ff5f6d, #ffc371)',
            info: 'linear-gradient(to right, #667eea, #764ba2)',
            warning: 'linear-gradient(to right, #f093fb, #f5576c)'
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
    } else {
        console.log(`Toast (${tipo}): ${mensaje}`);
    }
}

// Detectar cambios de conexión y mostrar notificaciones
window.addEventListener('online', () => {
    mostrarToast('Conexión restaurada', 'success');
});

window.addEventListener('offline', () => {
    mostrarToast('Modo offline activado', 'info');
});

// Limpiar recursos BroadcastChannel al cerrar pestaña
window.addEventListener('beforeunload', () => {
    if ('BroadcastChannel' in window) {
        const channel = new BroadcastChannel('carrito-updates');
        channel.close();
    }
});

console.log('Carrito.js: Script cargado correctamente');
