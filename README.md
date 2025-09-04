# SpotMusic

git clone https://github.com/<tu-user>/SpotMusic.git
cd SpotMusic

# 1) Crear venv
python -m venv .venv
.venv\Scripts\activate   # Windows

# 2) Instalar deps
pip install -r requirements.txt

# 3) Crear .env (a partir de .env.example)
copy .env.example .env
# y poner:
# SPOTIPY_CLIENT_ID=xxx
# SPOTIPY_CLIENT_SECRET=yyy
# SPOTIFY_MARKET=MX   (opcional)

# 4) FFmpeg:
#   Opción A: tener ffmpeg en PATH
#   Opción B: colocar binario en vendor/ffmpeg/ffmpeg.exe (Windows)
Para correr:

CLI: python -m spotmusic

GUI: python -m spotmusic.ui.main_window
