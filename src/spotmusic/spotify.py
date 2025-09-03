from __future__ import annotations
from urllib.parse import urlparse
from typing import Tuple, List
import os
from dotenv import load_dotenv
import spotipy
from spotipy.oauth2 import SpotifyClientCredentials

load_dotenv()

_sp = spotipy.Spotify(
    auth_manager=SpotifyClientCredentials(
        client_id=os.getenv("SPOTIPY_CLIENT_ID"),
        client_secret=os.getenv("SPOTIPY_CLIENT_SECRET"),
    ),
    requests_timeout=20,
)

def _parse_spotify_url(url: str) -> Tuple[str, str]:
    """Devuelve (tipo, id) donde tipo ∈ {'track','album','playlist'}."""
    p = urlparse(url)
    parts = [seg for seg in p.path.split("/") if seg]  # limpia vacíos
    for i, seg in enumerate(parts):
        if seg in {"track", "album", "playlist"} and i + 1 < len(parts):
            return seg, parts[i + 1]
    raise ValueError("URL de Spotify no reconocida. Esperaba track/album/playlist.")

def obtener_canciones(spotify_url: str) -> List[str]:
    canciones: List[str] = []
    try:
        tipo, spotify_id = _parse_spotify_url(spotify_url)

        if tipo == "track":
            tr = _sp.track(spotify_id)
            canciones = [f"{tr['artists'][0]['name']} - {tr['name']}"]

        elif tipo == "album":
            offset = 0
            while True:
                res = _sp.album_tracks(spotify_id, limit=50, offset=offset)
                canciones += [f"{t['artists'][0]['name']} - {t['name']}" for t in res["items"]]
                if not res.get("next"):
                    break
                offset += 50

        elif tipo == "playlist":
            offset = 0
            while True:
                res = _sp.playlist_items(spotify_id, limit=100, offset=offset, additional_types=("track",))
                canciones += [
                    f"{it['track']['artists'][0]['name']} - {it['track']['name']}"
                    for it in res["items"] if it.get("track")
                ]
                if not res.get("next"):
                    break
                offset += 100

    except Exception as e:
        print("❌ Error al obtener canciones:", e)

    return canciones
