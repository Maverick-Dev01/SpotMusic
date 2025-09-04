# src/spotmusic/spotify.py
from __future__ import annotations
from urllib.parse import urlparse
from typing import List, Tuple
from pathlib import Path
import os, sys
from dotenv import load_dotenv
import spotipy
from spotipy.oauth2 import SpotifyClientCredentials

# === carga .env tanto en dev como en .exe (PyInstaller) ===
def _app_base() -> Path:
    return Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parents[2]))

load_dotenv(_app_base() / ".env")
load_dotenv()  # fallback

MARKET = os.getenv("SPOTIFY_MARKET", "MX")

# === errores "bonitos" para la UI/CLI ===
class SpotifyPrivada(Exception): pass
class SpotifySinResultados(Exception): pass
class SpotifyURLInvalida(Exception): pass

_sp = spotipy.Spotify(
    auth_manager=SpotifyClientCredentials(
        client_id=os.getenv("SPOTIPY_CLIENT_ID"),
        client_secret=os.getenv("SPOTIPY_CLIENT_SECRET"),
    ),
    requests_timeout=20,
)

def _parse_spotify_url(url: str) -> Tuple[str, str]:
    """
    Devuelve (tipo, id) donde tipo ∈ {'track','album','playlist'}.
    Soporta rutas con /intl-xx/ y formatos viejos.
    """
    p = urlparse(url)
    parts = [seg for seg in p.path.split("/") if seg]
    for i, seg in enumerate(parts):
        if seg in {"track", "album", "playlist"} and i + 1 < len(parts):
            return seg, parts[i + 1]
    raise SpotifyURLInvalida("Link inválido: usa track/album/playlist públicos de Spotify.")

def obtener_canciones(spotify_url: str) -> List[str]:
    tipo, spotify_id = _parse_spotify_url(spotify_url)

    try:
        if tipo == "track":
            tr = _sp.track(spotify_id, market=MARKET)
            songs = [f"{tr['artists'][0]['name']} - {tr['name']}"]

        elif tipo == "album":
            songs: List[str] = []
            offset = 0
            while True:
                res = _sp.album_tracks(spotify_id, limit=50, offset=offset, market=MARKET)
                songs += [f"{t['artists'][0]['name']} - {t['name']}" for t in res["items"]]
                if not res.get("next"): break
                offset += 50

        else:  # playlist
            songs = []
            offset = 0
            while True:
                res = _sp.playlist_items(
                    spotify_id,
                    limit=100,
                    offset=offset,
                    market=MARKET,
                    additional_types=("track",),
                )
                songs += [
                    f"{it['track']['artists'][0]['name']} - {it['track']['name']}"
                    for it in res["items"] if it.get("track")
                ]
                if not res.get("next"): break
                offset += 100

        if not songs:
            raise SpotifySinResultados("Sin canciones (¿privado o no disponible en tu región?).")
        return songs

    except spotipy.SpotifyException as e:
        if e.http_status in (401, 403, 404):
            # 404 muy común cuando es privado/no público con Client Credentials
            raise SpotifyPrivada("Privado o no público. Hazlo público para probar.") from e
        raise
