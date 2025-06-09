// Gestor PWA para NKD Pereira
class PWAManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.deferredPrompt = null;
        this.isInstalled = false;
        this.updateAvailable = false;
        
        this.init();
    }

    async init() {
        console.log('PWA Manager: Inicializando...');
        
        // Registrar Service Worker
        await this.registerServiceWorker();
        
        // Configurar eventos de instalación
        this.setupInstallPrompt();
        
        // Configurar eventos de conectividad
        this.setupConnectivityEvents();
        
        // Configurar actualizaciones
        this.setupUpdateHandling();
        
        // Inicializar base de datos
        await this.initDatabase();
        
        // Verificar si está instalado
        this.checkInstallStatus();
        
        // Mostrar indicadores de estado
        this.updateUIStatus();
        
        console.log('PWA Manager: Inicialización completada');
    }

    // Registrar Service Worker
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('PWA: Service Worker registrado correctamente');
                
                // Escuchar actualizaciones
                registration.addEventListener('updatefound', () => {
                    console.log('PWA: Nueva versión disponible');
                    this.handleUpdateFound(registration);
                });

                // Verificar si ya hay una actualización esperando
                if (registration.waiting) {
                    this.showUpdateAvailable();
                }

                return registration;
            } catch (error) {
                console.error('PWA: Error al registrar Service Worker:', error);
            }
        } else {
            console.warn('PWA: Service Workers no soportados en este navegador');
        }
    }

    // Configurar prompt de instalación
    setupInstallPrompt() {
        // Capturar el evento beforeinstallprompt
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('PWA: Prompt de instalación disponible');
            e.preventDefault();
            this.deferredPrompt = e;
            this.showInstallButton();
        });

        // Detectar cuando la app se instala
        window.addEventListener('appinstalled', () => {
            console.log('PWA: Aplicación instalada');
            this.isInstalled = true;
            this.hideInstallButton();
            this.showToast('¡NKD Pereira instalado correctamente!', 'success');
        });
    }

    // Mostrar botón de instalación
    showInstallButton() {
        let installButton = document.getElementById('install-button');
        
        if (!installButton) {
            installButton = document.createElement('button');
            installButton.id = 'install-button';
            installButton.className = 'install-button';
            installButton.innerHTML = `
                <i class="bi bi-download"></i>
                Instalar App
            `;
            
            // Añadir estilos
            installButton.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: linear-gradient(135deg, #ff0000, #cc0000);
                color: white;
                border: none;
                padding: 12px 20px;
                border-radius: 25px;
                font-weight: bold;
                cursor: pointer;
                box-shadow: 0 4px 15px rgba(255, 0, 0, 0.3);
                z-index: 1000;
                font-size: 14px;
                display: flex;
                align-items: center;
                gap: 8px;
                transition: all 0.3s ease;
            `;
            
            installButton.addEventListener('click', () => this.installApp());
            document.body.appendChild(installButton);
        }
        
        installButton.style.display = 'flex';
    }

    // Ocultar botón de instalación
    hideInstallButton() {
        const installButton = document.getElementById('install-button');
        if (installButton) {
            installButton.style.display = 'none';
        }
    }

    // Instalar la aplicación
    async installApp() {
        if (!this.deferredPrompt) return;

        try {
            this.deferredPrompt.prompt();
            const { outcome } = await this.deferredPrompt.userChoice;
            
            if (outcome === 'accepted') {
                console.log('PWA: Usuario aceptó la instalación');
            } else {
                console.log('PWA: Usuario rechazó la instalación');
            }
            
            this.deferredPrompt = null;
            this.hideInstallButton();
        } catch (error) {
            console.error('PWA: Error durante la instalación:', error);
        }
    }

    // Configurar eventos de conectividad
    setupConnectivityEvents() {
        window.addEventListener('online', () => {
            console.log('PWA: Conexión restaurada');
            this.isOnline = true;
            this.handleOnline();
        });

        window.addEventListener('offline', () => {
            console.log('PWA: Sin conexión');
            this.isOnline = false;
            this.handleOffline();
        });
    }

    // Manejar estado online
    async handleOnline() {
        this.updateUIStatus();
        this.showToast('Conexión restaurada', 'success');
        
        // Sincronizar datos pendientes
        if (window.dbManager) {
            await window.dbManager.syncOfflineData();
        }
        
        // Registrar sincronización en segundo plano
        this.registerBackgroundSync();
    }

    // Manejar estado offline
    handleOffline() {
        this.updateUIStatus();
        this.showToast('Modo offline activado', 'info');
    }

    // Configurar manejo de actualizaciones
    setupUpdateHandling() {
        // Escuchar cuando el service worker toma control
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('PWA: Nueva versión activa');
            window.location.reload();
        });
    }

    // Manejar nueva actualización encontrada
    handleUpdateFound(registration) {
        const newWorker = registration.installing;
        
        newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                this.showUpdateAvailable();
            }
        });
    }

    // Mostrar actualización disponible
    showUpdateAvailable() {
        this.updateAvailable = true;
        
        const updateButton = document.createElement('button');
        updateButton.id = 'update-button';
        updateButton.className = 'update-button';
        updateButton.innerHTML = `
            <i class="bi bi-arrow-clockwise"></i>
            Actualizar
        `;
        
        updateButton.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #28a745, #20c997);
            color: white;
            border: none;
            padding: 10px 16px;
            border-radius: 20px;
            font-weight: bold;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3);
            z-index: 1000;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 6px;
            animation: pulse 2s infinite;
        `;
        
        // Añadir animación CSS
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }
        `;
        document.head.appendChild(style);
        
        updateButton.addEventListener('click', () => this.updateApp());
        document.body.appendChild(updateButton);
        
        this.showToast('Nueva versión disponible', 'info');
    }

    // Actualizar la aplicación
    async updateApp() {
        if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.getRegistration();
            if (registration && registration.waiting) {
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
        }
        
        const updateButton = document.getElementById('update-button');
        if (updateButton) {
            updateButton.remove();
        }
    }

    // Inicializar base de datos
    async initDatabase() {
        try {
            if (window.dbManager) {
                await window.dbManager.init();
                console.log('PWA: Base de datos inicializada');
            }
        } catch (error) {
            console.error('PWA: Error al inicializar base de datos:', error);
        }
    }

    // Verificar estado de instalación
    checkInstallStatus() {
        // Verificar si se ejecuta como PWA instalada
        if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
            this.isInstalled = true;
            console.log('PWA: Ejecutándose como aplicación instalada');
        }
    }

    // Actualizar indicadores de UI
    updateUIStatus() {
        // Crear indicador de estado si no existe
        let statusIndicator = document.getElementById('pwa-status');
        
        if (!statusIndicator) {
            statusIndicator = document.createElement('div');
            statusIndicator.id = 'pwa-status';
            statusIndicator.style.cssText = `
                position: fixed;
                top: 10px;
                left: 10px;
                background: rgba(0, 0, 0, 0.7);
                color: white;
                padding: 5px 10px;
                border-radius: 15px;
                font-size: 12px;
                z-index: 999;
                display: flex;
                align-items: center;
                gap: 5px;
                transition: all 0.3s ease;
            `;
            document.body.appendChild(statusIndicator);
        }
        
        // Actualizar contenido del indicador
        const onlineIcon = this.isOnline ? '🟢' : '🔴';
        const onlineText = this.isOnline ? 'Online' : 'Offline';
        const installedIcon = this.isInstalled ? '📱' : '🌐';
        
        statusIndicator.innerHTML = `
            ${onlineIcon} ${onlineText} ${installedIcon}
        `;
        
        // Auto-ocultar después de 3 segundos
        setTimeout(() => {
            if (statusIndicator) {
                statusIndicator.style.opacity = '0.3';
            }
        }, 3000);
    }

    // Registrar sincronización en segundo plano
    registerBackgroundSync() {
        if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
            navigator.serviceWorker.ready.then(registration => {
                return registration.sync.register('background-sync');
            }).catch(error => {
                console.error('PWA: Error al registrar sync:', error);
            });
        }
    }

    // Mostrar notificaciones toast
    showToast(message, type = 'info') {
        if (typeof Toastify !== 'undefined') {
            const colors = {
                success: 'linear-gradient(to right, #00b09b, #96c93d)',
                error: 'linear-gradient(to right, #ff5f6d, #ffc371)',
                info: 'linear-gradient(to right, #667eea, #764ba2)',
                warning: 'linear-gradient(to right, #f093fb, #f5576c)'
            };

            Toastify({
                text: message,
                duration: 3000,
                close: true,
                gravity: "top",
                position: "center",
                style: {
                    background: colors[type] || colors.info,
                    borderRadius: "2rem",
                    fontSize: "14px"
                },
                offset: {
                    y: '1rem'
                }
            }).showToast();
        } else {
            console.log(`PWA Toast (${type}):`, message);
        }
    }

    // Obtener información de la PWA
    getInfo() {
        return {
            isOnline: this.isOnline,
            isInstalled: this.isInstalled,
            updateAvailable: this.updateAvailable,
            canInstall: !!this.deferredPrompt,
            hasServiceWorker: 'serviceWorker' in navigator,
            hasIndexedDB: 'indexedDB' in window,
            hasNotifications: 'Notification' in window
        };
    }

    // Limpiar recursos
    cleanup() {
        const installButton = document.getElementById('install-button');
        const updateButton = document.getElementById('update-button');
        const statusIndicator = document.getElementById('pwa-status');
        
        if (installButton) installButton.remove();
        if (updateButton) updateButton.remove();
        if (statusIndicator) statusIndicator.remove();
    }

    // Forzar actualización de cache
    async forceUpdate() {
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
            console.log('PWA: Cache limpiado');
            window.location.reload();
        }
    }

    // Obtener estadísticas de uso
    async getUsageStats() {
        const stats = {
            cacheSize: 0,
            dbSize: 0,
            lastUpdate: null
        };

        try {
            // Tamaño de cache
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                for (const name of cacheNames) {
                    const cache = await caches.open(name);
                    const requests = await cache.keys();
                    stats.cacheSize += requests.length;
                }
            }

            // Estadísticas de DB
            if (window.dbManager) {
                const dbStats = await window.dbManager.obtenerEstadisticas();
                if (dbStats) {
                    stats.dbSize = dbStats.totalProductos;
                    stats.lastUpdate = dbStats.ultimaActualizacion;
                }
            }
        } catch (error) {
            console.error('PWA: Error al obtener estadísticas:', error);
        }

        return stats;
    }
}

// Inicializar PWA Manager cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.pwaManager = new PWAManager();
});

// Exportar para uso global
window.PWAManager = PWAManager;