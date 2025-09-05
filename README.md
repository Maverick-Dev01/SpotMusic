# SpotMusic

Descarga canciones desde enlaces de **Spotify** (track/album/playlist) buscando automáticamente en **YouTube Music** y convirtiendo con **FFmpeg**. Incluye **GUI** con `ttkbootstrap`.

---

## Requisitos

- **Windows 10/11** (probado).  
- **Python 3.11+** (funciona también con 3.13).  
- **Credenciales de Spotify** (Client ID/Secret) – crea una app en https://developer.spotify.com/
- **FFmpeg** instalado y en el **PATH** (recomendado instalar desde https://www.gyan.dev/ffmpeg/builds/ → “release full” y agregar `ffmpeg/bin` al PATH).

> Nota: Si recibes errores 404 con playlists, probablemente son **privadas**. Con el flujo de *Client Credentials* solo se accede a contenido **público**.

---

## Clonar y preparar

```powershell
git clone https://github.com/<tu-usuario>/SpotMusic.git
cd SpotMusic

# 1) Crear entorno virtual
python -m venv .venv
.\.venv\Scripts\activate   # Windows PowerShell

# 2) Instalar dependencias
pip install -r requirements.txt

# 3) Variables de entorno
copy .env.example .env
# Edita .env y coloca tus claves:
# SPOTIPY_CLIENT_ID=xxx
# SPOTIPY_CLIENT_SECRET=yyy
# SPOTIFY_MARKET=MX        # opcional, ayuda con catálogos regionales
