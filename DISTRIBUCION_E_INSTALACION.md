# Guía de Distribución, Instalación y Licenciamiento — SpotMusic 🎵

Esta guía detalla cómo distribuir los instaladores de SpotMusic para macOS y Windows a tus clientes, cómo instalarlos sin bloqueos del sistema operativo y cómo activar sus licencias con el panel **KeyForge Pro**.

---

## 📦 1. Archivos Generados para Distribución

En la carpeta `dist/` tienes los paquetes listos para enviar a tus usuarios:

### 🍎 Para macOS
- **`SpotMusic-1.0.0-arm64.dmg`** *(Recomendado para Macs modernas: Apple Silicon M1, M2, M3, M4)*
- **`SpotMusic-1.0.0.dmg`** *(Para Macs con procesadores Intel)*
- **`SpotMusic-1.0.0-arm64-mac.zip`** / **`SpotMusic-1.0.0-mac.zip`** *(Versiones comprimidas listas para descomprimir)*

> **Todo Incluido:** Los binarios de extracción de audio (`yt-dlp` y `ffmpeg`) van completamente empaquetados dentro de la aplicación (`Contents/Resources/bin`). El usuario no tiene que instalar Homebrew, ni abrir la terminal, ni configurar nada técnico.

### 🪟 Para Windows
- **`SpotMusic Setup 1.0.0.exe`** *(Instalador estándar NSIS con asistente paso a paso, acceso directo en escritorio y menú inicio)*
- **`SpotMusic 1.0.0.exe`** *(Versión portable: doble clic y se abre directamente sin instalar en archivos de programa)*

> **Todo Incluido:** Viene con `yt-dlp.exe` y `ffmpeg.exe` preempaquetados de fábrica dentro de la carpeta `resources/bin`.

---

## 🚀 2. Guía de Instalación para el Usuario Final

### En macOS:
1. El usuario abre el archivo `.dmg` y arrastra **SpotMusic** a su carpeta de **Aplicaciones**.
2. **Primer inicio (Gatekeeper de Apple):**
   Dado que no se utiliza un certificado de pago anual de Apple Developer (\$99 USD/año), macOS mostrará una advertencia de seguridad al abrirla por primera vez (*"Apple no puede comprobar si contiene software malicioso"* o *"La aplicación proviene de un desarrollador no identificado"*).
3. **Cómo abrirla fácilmente (2 métodos):**
   - **Método A (Gráfico - Recomendado):**
     1. Ir a la carpeta **Aplicaciones**.
     2. Hacer **clic derecho** (o mantener presionada la tecla `Control` y hacer clic) sobre **SpotMusic**.
     3. Seleccionar **Abrir**.
     4. En el diálogo que aparece, pulsar el botón **Abrir**. (Solo se hace una sola vez; en las siguientes ocasiones se abrirá normalmente con doble clic).
   - **Método B (Terminal - Si macOS bloquea con "está dañada"):**
     Ejecutar en la terminal de la Mac:
     ```bash
     xattr -cr /Applications/SpotMusic.app
     ```
     *(Esto retira la bandera de cuarentena que macOS asigna a las apps descargadas de internet).*

### En Windows:
1. El usuario ejecuta `SpotMusic Setup 1.0.0.exe`.
2. Si aparece el aviso de **Windows Defender SmartScreen** (*"Windows protegió su PC"*):
   - Hacer clic en **"Más información"** (More info).
   - Hacer clic en el botón **"Ejecutar de todas formas"** (Run anyway).
3. El instalador creará el acceso directo en el Escritorio y en el Menú Inicio.

---

## 🔑 3. Flujo de Licenciamiento con KeyForge Pro

1. El usuario abre SpotMusic en su equipo y hace clic en la pestaña **Licencia** en la barra lateral izquierda.
2. La aplicación detecta el hardware de su placa madre y le muestra su **Machine ID** único (ejemplo: `923636A3-51EA-5F36-B957-83F7CDF844A4`).
3. El usuario pulsa **"Copiar ID"** y te lo envía por WhatsApp, correo o mensaje.
4. Tú entras a tu panel web **KeyForge Pro** desplegado en Vercel.
5. Seleccionas **Generar Licencia**:
   - Ingresas el nombre del cliente (ej. *Carlos Pérez*).
   - Pegas su **Machine ID**.
   - Eliges el tipo: `30 días`, `90 días`, `1 año` o `Permanente / Vitalicia`.
   - Presionas **Generar**.
6. Copias el Token criptográfico generado y se lo envías al cliente.
7. El cliente pega el Token en la casilla **"Token de Activación"** dentro de SpotMusic y presiona **"Activar Licencia"**.
8. ¡Listo! La app se desbloquea al instante, muestra el Machine ID exacto verificado, el nombre del titular y los días de vigencia.

---

## 🛠️ 4. Automatización con GitHub Actions (Compilación en la Nube)

En el repositorio se ha configurado el flujo `.github/workflows/build-and-release.yml`.

Cuando desees compilar nuevas versiones automáticamente en servidores de GitHub sin usar tu Mac:
1. Ve a la pestaña **Actions** en tu repositorio de GitHub `Maverick-Dev01/SpotMusic`.
2. Selecciona el workflow **"Build and Release SpotMusic"** y pulsa **"Run workflow"**.
3. O crea un tag de versión:
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```
4. GitHub Actions compilará automáticamente en máquinas virtuales macOS y Windows nativas, y creará un **GitHub Release** público con todos los `.dmg`, `.zip` y `.exe` listos para descargar.
