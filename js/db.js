// Gestor de IndexedDB para NKD Pereira
class DBManager {
    constructor() {
        this.dbName = 'NKDPereira';
        this.dbVersion = 1;
        this.db = null;
        this.isOnline = navigator.onLine;
        
        // Escuchar cambios de conectividad
        window.addEventListener('online', () => {
            this.isOnline = true;
            console.log('DB: Conexión restaurada');
            this.syncOfflineData();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('DB: Modo offline activado');
        });
    }

    // Inicializar la base de datos
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('DB: Error al abrir la base de datos');
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('DB: Base de datos abierta correctamente');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                this.db = event.target.result;
                console.log('DB: Actualizando esquema de base de datos');
                this.createStores();
            };
        });
    }

    // Crear los almacenes de objetos
    createStores() {
        // Store para productos
        if (!this.db.objectStoreNames.contains('productos')) {
            const productosStore = this.db.createObjectStore('productos', { keyPath: 'id' });
            productosStore.createIndex('categoria', 'categoria.id', { unique: false });
            productosStore.createIndex('precio', 'precio', { unique: false });
            console.log('DB: Store "productos" creado');
        }

        // Store para carrito
        if (!this.db.objectStoreNames.contains('carrito')) {
            const carritoStore = this.db.createObjectStore('carrito', { keyPath: 'id' });
            carritoStore.createIndex('fechaAgregado', 'fechaAgregado', { unique: false });
            console.log('DB: Store "carrito" creado');
        }

        // Store para configuración y estado
        if (!this.db.objectStoreNames.contains('config')) {
            const configStore = this.db.createObjectStore('config', { keyPath: 'key' });
            console.log('DB: Store "config" creado');
        }

        // Store para sincronización offline
        if (!this.db.objectStoreNames.contains('sincronizacion')) {
            const syncStore = this.db.createObjectStore('sincronizacion', { 
                keyPath: 'id', 
                autoIncrement: true 
            });
            syncStore.createIndex('tipo', 'tipo', { unique: false });
            syncStore.createIndex('timestamp', 'timestamp', { unique: false });
            console.log('DB: Store "sincronizacion" creado');
        }

        // Store para historial de compras
        if (!this.db.objectStoreNames.contains('compras')) {
            const comprasStore = this.db.createObjectStore('compras', { keyPath: 'id' });
            comprasStore.createIndex('fecha', 'fecha', { unique: false });
            comprasStore.createIndex('estado', 'estado', { unique: false });
            console.log('DB: Store "compras" creado');
        }
    }

    // MÉTODOS PARA PRODUCTOS
    async guardarProductos(productos) {
        const transaction = this.db.transaction(['productos'], 'readwrite');
        const store = transaction.objectStore('productos');
        
        try {
            // Limpiar productos existentes
            await store.clear();
            
            // Agregar nuevos productos
            for (const producto of productos) {
                await store.add({
                    ...producto,
                    fechaActualizacion: new Date()
                });
            }
            
            console.log('DB: Productos guardados correctamente');
            return true;
        } catch (error) {
            console.error('DB: Error al guardar productos:', error);
            return false;
        }
    }

    async obtenerProductos() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['productos'], 'readonly');
            const store = transaction.objectStore('productos');
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    async obtenerProductosPorCategoria(categoriaId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['productos'], 'readonly');
            const store = transaction.objectStore('productos');
            const index = store.index('categoria');
            const request = index.getAll(categoriaId);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    async obtenerProductoPorId(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['productos'], 'readonly');
            const store = transaction.objectStore('productos');
            const request = store.get(id);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    // MÉTODOS PARA CARRITO
    async agregarAlCarrito(producto) {
        return new Promise(async (resolve, reject) => {
            try {
                const transaction = this.db.transaction(['carrito'], 'readwrite');
                const store = transaction.objectStore('carrito');
                
                // Verificar si el producto ya existe en el carrito
                const productoExistente = await this.obtenerProductoCarrito(producto.id);
                
                if (productoExistente) {
                    // Actualizar cantidad
                    productoExistente.cantidad += 1;
                    productoExistente.fechaActualizacion = new Date();
                    const putRequest = store.put(productoExistente);
                    
                    putRequest.onsuccess = () => {
                        console.log('DB: Cantidad actualizada en carrito');
                        resolve(true);
                    };
                    putRequest.onerror = () => reject(putRequest.error);
                } else {
                    // Agregar nuevo producto
                    const addRequest = store.add({
                        ...producto,
                        cantidad: 1,
                        fechaAgregado: new Date(),
                        fechaActualizacion: new Date()
                    });
                    
                    addRequest.onsuccess = () => {
                        console.log('DB: Producto agregado al carrito');
                        resolve(true);
                    };
                    addRequest.onerror = () => reject(addRequest.error);
                }
                
                // Registrar acción para sincronización
                await this.registrarAccionSincronizacion('carrito_actualizado', {
                    productoId: producto.id,
                    accion: 'agregar',
                    timestamp: new Date()
                });
                
            } catch (error) {
                console.error('DB: Error al agregar al carrito:', error);
                reject(error);
            }
        });
    }

    async obtenerCarrito() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['carrito'], 'readonly');
            const store = transaction.objectStore('carrito');
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result || []);
            };

            request.onerror = () => {
                console.error('DB: Error al obtener carrito:', request.error);
                resolve([]);
            };
        });
    }

    async obtenerProductoCarrito(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['carrito'], 'readonly');
            const store = transaction.objectStore('carrito');
            const request = store.get(id);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                resolve(null);
            };
        });
    }

    async eliminarDelCarrito(id) {
        return new Promise(async (resolve, reject) => {
            try {
                const transaction = this.db.transaction(['carrito'], 'readwrite');
                const store = transaction.objectStore('carrito');
                
                const deleteRequest = store.delete(id);
                
                deleteRequest.onsuccess = () => {
                    console.log('DB: Producto eliminado del carrito');
                    resolve(true);
                };
                
                deleteRequest.onerror = () => {
                    console.error('DB: Error al eliminar del carrito:', deleteRequest.error);
                    reject(deleteRequest.error);
                };
                
                // Registrar acción para sincronización
                await this.registrarAccionSincronizacion('carrito_actualizado', {
                    productoId: id,
                    accion: 'eliminar',
                    timestamp: new Date()
                });
                
            } catch (error) {
                console.error('DB: Error al eliminar del carrito:', error);
                reject(error);
            }
        });
    }

    async vaciarCarrito() {
        return new Promise(async (resolve, reject) => {
            try {
                const transaction = this.db.transaction(['carrito'], 'readwrite');
                const store = transaction.objectStore('carrito');
                
                const clearRequest = store.clear();
                
                clearRequest.onsuccess = () => {
                    console.log('DB: Carrito vaciado');
                    resolve(true);
                };
                
                clearRequest.onerror = () => {
                    console.error('DB: Error al vaciar carrito:', clearRequest.error);
                    reject(clearRequest.error);
                };
                
                // Registrar acción para sincronización
                await this.registrarAccionSincronizacion('carrito_vaciado', {
                    timestamp: new Date()
                });
                
            } catch (error) {
                console.error('DB: Error al vaciar carrito:', error);
                reject(error);
            }
        });
    }

    async obtenerContadorCarrito() {
        try {
            const productos = await this.obtenerCarrito();
            return productos.reduce((total, producto) => total + producto.cantidad, 0);
        } catch (error) {
            console.error('DB: Error al obtener contador del carrito:', error);
            return 0;
        }
    }

    // NUEVO: Método para obtener total de productos en carrito
    async obtenerTotalProductosCarrito() {
        try {
            const productos = await this.obtenerCarrito();
            return productos.reduce((total, producto) => total + producto.cantidad, 0);
        } catch (error) {
            console.error('DB: Error al obtener total de productos en carrito:', error);
            return 0;
        }
    }

    // NUEVO: Incrementar cantidad de producto
    async incrementarCantidad(id) {
        return new Promise(async (resolve, reject) => {
            try {
                const producto = await this.obtenerProductoCarrito(id);
                if (producto) {
                    producto.cantidad += 1;
                    producto.fechaActualizacion = new Date();
                    
                    const transaction = this.db.transaction(['carrito'], 'readwrite');
                    const store = transaction.objectStore('carrito');
                    const putRequest = store.put(producto);
                    
                    putRequest.onsuccess = () => {
                        console.log('DB: Cantidad incrementada');
                        resolve(true);
                    };
                    putRequest.onerror = () => reject(putRequest.error);
                } else {
                    reject(new Error('Producto no encontrado en carrito'));
                }
            } catch (error) {
                console.error('DB: Error al incrementar cantidad:', error);
                reject(error);
            }
        });
    }

    // NUEVO: Decrementar cantidad de producto
    async decrementarCantidad(id) {
        return new Promise(async (resolve, reject) => {
            try {
                const producto = await this.obtenerProductoCarrito(id);
                if (producto) {
                    if (producto.cantidad > 1) {
                        producto.cantidad -= 1;
                        producto.fechaActualizacion = new Date();
                        
                        const transaction = this.db.transaction(['carrito'], 'readwrite');
                        const store = transaction.objectStore('carrito');
                        const putRequest = store.put(producto);
                        
                        putRequest.onsuccess = () => {
                            console.log('DB: Cantidad decrementada');
                            resolve(true);
                        };
                        putRequest.onerror = () => reject(putRequest.error);
                    } else {
                        // Si la cantidad es 1, eliminar el producto
                        await this.eliminarDelCarrito(id);
                        resolve(true);
                    }
                } else {
                    reject(new Error('Producto no encontrado en carrito'));
                }
            } catch (error) {
                console.error('DB: Error al decrementar cantidad:', error);
                reject(error);
            }
        });
    }

    // NUEVO: Registrar compra en historial
    async registrarCompra(compra) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['compras'], 'readwrite');
            const store = transaction.objectStore('compras');
            
            const addRequest = store.add(compra);
            
            addRequest.onsuccess = () => {
                console.log('DB: Compra registrada');
                resolve(true);
            };
            
            addRequest.onerror = () => {
                console.error('DB: Error al registrar compra:', addRequest.error);
                reject(addRequest.error);
            };
        });
    }

    // MÉTODOS PARA CONFIGURACIÓN
    async guardarConfiguracion(key, value) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['config'], 'readwrite');
            const store = transaction.objectStore('config');
            
            const putRequest = store.put({
                key: key,
                value: value,
                timestamp: new Date()
            });
            
            putRequest.onsuccess = () => {
                console.log(`DB: Configuración "${key}" guardada`);
                resolve(true);
            };
            
            putRequest.onerror = () => {
                console.error('DB: Error al guardar configuración:', putRequest.error);
                reject(putRequest.error);
            };
        });
    }

    async obtenerConfiguracion(key, defaultValue = null) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['config'], 'readonly');
            const store = transaction.objectStore('config');
            const request = store.get(key);

            request.onsuccess = () => {
                const result = request.result;
                resolve(result ? result.value : defaultValue);
            };

            request.onerror = () => {
                resolve(defaultValue);
            };
        });
    }

    // MÉTODOS PARA SINCRONIZACIÓN OFFLINE
    async registrarAccionSincronizacion(tipo, datos) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sincronizacion'], 'readwrite');
            const store = transaction.objectStore('sincronizacion');
            
            const addRequest = store.add({
                tipo: tipo,
                datos: datos,
                timestamp: new Date(),
                sincronizado: false
            });
            
            addRequest.onsuccess = () => {
                console.log(`DB: Acción de sincronización "${tipo}" registrada`);
                resolve(true);
            };
            
            addRequest.onerror = () => {
                console.error('DB: Error al registrar acción de sincronización:', addRequest.error);
                resolve(false);
            };
        });
    }

    async obtenerAccionesPendientes() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sincronizacion'], 'readonly');
            const store = transaction.objectStore('sincronizacion');
            const request = store.getAll();

            request.onsuccess = () => {
                const acciones = request.result.filter(accion => !accion.sincronizado);
                resolve(acciones);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    async marcarComoSincronizado(id) {
        return new Promise(async (resolve, reject) => {
            try {
                const transaction = this.db.transaction(['sincronizacion'], 'readwrite');
                const store = transaction.objectStore('sincronizacion');
                
                const getRequest = store.get(id);
                getRequest.onsuccess = () => {
                    const accion = getRequest.result;
                    if (accion) {
                        accion.sincronizado = true;
                        accion.fechaSincronizacion = new Date();
                        
                        const putRequest = store.put(accion);
                        putRequest.onsuccess = () => resolve(true);
                        putRequest.onerror = () => reject(putRequest.error);
                    } else {
                        resolve(false);
                    }
                };
                getRequest.onerror = () => reject(getRequest.error);
                
            } catch (error) {
                console.error('DB: Error al marcar como sincronizado:', error);
                reject(error);
            }
        });
    }

    // Sincronizar datos offline cuando se recupere la conexión
    async syncOfflineData() {
        if (!this.isOnline) return;
        
        try {
            const accionesPendientes = await this.obtenerAccionesPendientes();
            
            for (const accion of accionesPendientes) {
                // Aquí implementarías la lógica para sincronizar con el servidor
                console.log('DB: Sincronizando acción:', accion);
                
                // Simular sincronización exitosa
                await this.marcarComoSincronizado(accion.id);
            }
            
            console.log('DB: Sincronización offline completada');
        } catch (error) {
            console.error('DB: Error durante la sincronización offline:', error);
        }
    }

    // MÉTODOS DE UTILIDAD
    async limpiarBaseDatos() {
        return new Promise(async (resolve, reject) => {
            try {
                const transaction = this.db.transaction(['productos', 'carrito', 'config', 'sincronizacion', 'compras'], 'readwrite');
                
                await Promise.all([
                    transaction.objectStore('productos').clear(),
                    transaction.objectStore('carrito').clear(),
                    transaction.objectStore('config').clear(),
                    transaction.objectStore('sincronizacion').clear(),
                    transaction.objectStore('compras').clear()
                ]);
                
                console.log('DB: Base de datos limpiada');
                resolve(true);
            } catch (error) {
                console.error('DB: Error al limpiar base de datos:', error);
                reject(error);
            }
        });
    }

    async obtenerEstadisticas() {
        try {
            const productos = await this.obtenerProductos();
            const carrito = await this.obtenerCarrito();
            const accionesPendientes = await this.obtenerAccionesPendientes();
            
            return {
                totalProductos: productos.length,
                productosEnCarrito: carrito.length,
                valorTotalCarrito: carrito.reduce((total, producto) => 
                    total + (producto.precio * producto.cantidad), 0),
                accionesPendientesSincronizacion: accionesPendientes.length,
                ultimaActualizacion: productos.length > 0 ? 
                    productos[0].fechaActualizacion : null
            };
        } catch (error) {
            console.error('DB: Error al obtener estadísticas:', error);
            return null;
        }
    }
}

// Crear instancia global del gestor de DB
window.dbManager = new DBManager();

// Inicializar automáticamente cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await window.dbManager.init();
        console.log('DBManager: Inicializado correctamente');
        
        // Disparar evento personalizado para notificar que la DB está lista
        window.dispatchEvent(new CustomEvent('dbReady'));
    } catch (error) {
        console.error('DBManager: Error durante la inicialización:', error);
        window.dispatchEvent(new CustomEvent('dbError', { detail: error }));
    }
});
