# SpotMusic 🎵 (SnapMusic Desktop)

Una aplicación de escritorio moderna, ultrarrápida y con interfaz oscura inspirada en Spotify para **buscar, preescuchar y descargar canciones, álbumes y playlists completas de Spotify por lotes** con la más alta calidad de audio (`MP3 320 kbps`, `FLAC`, `M4A`, `OPUS`, `WAV`), incrustando metadatos completos y carátulas en alta resolución.

Incluye además un **reproductor de audio integrado** con vista previa de 30 segundos, **sugerencias en vivo al escribir**, y un **Sistema de Licencias Criptográfico Multiplataforma** (Universal License Hub) con vinculación a hardware (Machine ID).

---

## 📋 Requisitos Previos (¿Qué necesitas tener instalado?)

Para poder ejecutar o compilar el proyecto en tu máquina, necesitas contar con las siguientes 3 herramientas instaladas en tu sistema:

### 1. Node.js (v18, v20 o v22 recomendado)
- **macOS:**
  ```bash
  brew install node
  ```
  O descarga el instalador `.pkg` desde [nodejs.org](https://nodejs.org/).
- **Windows:**
  ```powershell
  winget install OpenJS.NodeJS
  ```
  O descarga el instalador `.msi` desde [nodejs.org](https://nodejs.org/).
- **Linux (Ubuntu/Debian):**
  ```bash
  sudo apt update && sudo apt install nodejs npm
  ```

---

### 2. yt-dlp (Motor de extracción y streaming de audio)
Es la herramienta de terminal que localiza las pistas y extrae el stream de audio con la mayor calidad disponible.
- **macOS (con Homebrew):**
  ```bash
  brew install yt-dlp
  ```
- **Windows (con Winget o Chocolatey):**
  ```powershell
  winget install yt-dlp
  # o con Chocolatey:
  choco install yt-dlp
  ```
- **Linux:**
  ```bash
  sudo wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp
  sudo chmod a+rx /usr/local/bin/yt-dlp
  ```

---

### 3. FFmpeg (Conversor de audio y etiquetador ID3)
Necesario para convertir las pistas a MP3 320k, FLAC sin pérdida o M4A, e incrustar las etiquetas ID3 y las carátulas oficiales en el archivo de audio.
- **macOS (con Homebrew):**
  ```bash
  brew install ffmpeg
  ```
- **Windows:**
  ```powershell
  winget install Gyan.FFmpeg
  # o con Chocolatey:
  choco install ffmpeg
  ```
- **Linux:**
  ```bash
  sudo apt update && sudo apt install ffmpeg
  ```

> 💡 **Verificación:** Puedes comprobar que las dependencias están correctamente instaladas ejecutando en tu terminal:
> ```bash
> node -v && npm -v
> yt-dlp --version
> ffmpeg -version
> ```

---

## 🚀 Instalación y Puesta en Marcha

### Paso 1: Clonar el Repositorio
```bash
git clone https://github.com/Maverick-Dev01/SpotMusic.git
cd SpotMusic
```

### Paso 2: Instalar Dependencias de Node.js
```bash
npm install
```

### Paso 3: Ejecutar la Aplicación en Modo Desarrollo
```bash
npm start
```

*(En macOS también puedes hacer doble clic sobre el archivo ejecutable `SnapMusic.command`).*

---

## ✨ Características Principales

### 🎧 Búsqueda y Descarga
- **Buscador Directo de Catálogo:** Escribe el nombre de un artista o canción (ej. *Coldplay*, *Queen*, *Duki*) para ver canciones, álbumes y playlists coincidentes.
- **Sugerencias en Vivo (Autocomplete):** Despliega sugerencias instantáneas mientras escribes.
- **Preescucha de 30 Segundos:** Escucha la pista antes de descargarla con el reproductor Spotify-style en la parte inferior.
- **Explorador de Playlists y Álbumes:** Pega cualquier enlace de Spotify (`https://open.spotify.com/playlist/...`, `/album/...`, `/track/...`).
- **Doble Motor:** Funciona con la API Oficial de Spotify o mediante el scraper de embeds públicos (no requiere login obligatorio).
- **Selector Rápido de Carpeta Raíz:** Cambia o abre tu carpeta de descargas directamente desde la barra superior de la interfaz.

### 📦 Múltiples Formatos y Calidades
- `MP3 320 kbps` (Máxima fidelidad estándar con carátula incrustada)
- `MP3 192 kbps` (Equilibrio de peso y calidad)
- `FLAC Lossless` (Audio sin pérdida de calidad para audiófilos)
- `M4A / AAC` (256 kbps optimizado para dispositivos Apple)
- `OPUS` (Máxima eficiencia de compresión)
- `WAV` (Audio PCM sin comprimir)

### ⚡ Descargas en Paralelo
- Cola de descargas simultáneas configurables (1 a 5 hilos en paralelo).
- Métricas en tiempo real: porcentaje, velocidad de descarga (`MiB/s`) y tiempo estimado (`ETA`).
- Cancelación individual de tareas o de toda la cola con 1 clic.

---

## 🔒 Activación y Licencia de Uso

SpotMusic cuenta con un sistema de activación personal vinculado al hardware del equipo (Machine ID):

- Al abrir la aplicación, en el apartado **Licencia** podrás visualizar tu identificador de equipo (**Machine ID**).
- Para activar la aplicación y habilitar las descargas, ingresa la clave de activación provista por el desarrollador.
- Cada licencia es personal, válida únicamente para el equipo autorizado.

---

## ⚙️ Configuración de la API de Spotify (Opcional)

Para habilitar la búsqueda por texto en el catálogo oficial de Spotify:

1. Ve a [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) e inicia sesión con tu cuenta.
2. Haz clic en **Create App**:
   - Nombre: `SpotMusic`
   - APIs a utilizar: Marca **Web API**.
   - Redirect URIs: `http://localhost:8888/callback`
3. Copia tu **Client ID** y **Client Secret** desde los ajustes de tu app.
4. En SpotMusic, ve a **Ajustes & API**, pega tus credenciales y pulsa **Probar Conexión** -> **Guardar Cambios**.

---

## 📦 Empaquetado para Distribución (.dmg y .exe)

El proyecto utiliza `electron-builder` para generar los instaladores finales:

### Para macOS (.dmg y .zip):
```bash
npm run build:mac
```
*(Genera los instaladores en la carpeta `dist/` para arquitecturas Intel y Apple Silicon).*

### Para Windows (.exe NSIS y versión portable):
```bash
npm run build:win
```
*(Genera el instalador `.exe` en la carpeta `dist/`).*

---

## 📁 Estructura del Proyecto

```
SpotMusic/
├── src/
│   ├── index.html             # Interfaz de usuario (Dark Theme estilo Spotify)
│   ├── js/
│   │   └── app.js             # Controlador frontend, buscador, reproductor y colas
│   ├── styles/
│   │   └── app.css            # Estilos CSS modernos, responsivos y animaciones
│   └── services/
│       ├── spotify.js         # Scraper de embeds y cliente Web API de Spotify
│       ├── downloader.js      # Orquestador de descargas y conversión con yt-dlp & ffmpeg
│       ├── licenseService.js  # Lector de UUID de hardware y verificador de token
│       └── settings.js        # Gestor de configuración persistente en JSON
├── main.js                    # Proceso principal de Electron e IPC handlers
├── preload.js                 # Bridge seguro de Electron (Context Isolation)
├── package.json               # Dependencias, scripts y configuración de electron-builder
├── SnapMusic.command          # Acceso directo para ejecución en macOS
└── README.md                  # Documentación completa del proyecto
```

---

## 📄 Licencia

Este proyecto fue desarrollado para uso personal y privado con fines educativos y de respaldo multimedia.

