# src/spotmusic/downloader.py
from __future__ import annotations
from pathlib import Path
from typing import Optional, List
from yt_dlp import YoutubeDL
from time import sleep
import shutil, os, sys

# === paths portables (dev y .exe) ===
def _app_base() -> Path:
    return Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parents[2]))

def _ffmpeg_guess() -> Optional[str]:
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    cand = _app_base() / "vendor" / "ffmpeg" / ("ffmpeg.exe" if os.name == "nt" else "ffmpeg")
    return str(cand) if cand.exists() else None

def _aria2c_guess() -> Optional[str]:
    exe = shutil.which("aria2c")
    if exe:
        return exe
    cand = _app_base() / "vendor" / "aria2c" / ("aria2c.exe" if os.name == "nt" else "aria2c")
    return str(cand) if cand.exists() else None

def find_ytmusic_url(query: str) -> Optional[str]:
    """Devuelve la primera coincidencia de YouTube/YouTube Music para la consulta dada."""
    with YoutubeDL({"quiet": True, "noplaylist": True, "default_search": "ytsearch"}) as ydl:
        info = ydl.extract_info(f"ytsearch1:{query}", download=False)
        if not info or "entries" not in info or not info["entries"]:
            return None
        return info["entries"][0]["webpage_url"]

def _build_opts(out_dir: Path, audio_format: str) -> dict:
    """
    Opciones de yt-dlp pensadas para velocidad:
    - Usa m4a cuando se elige m4a para evitar recodificar (más rápido).
    - Aumenta descargas de fragmentos.
    - Si existe aria2c, lo usa como external_downloader (paraleliza conexiones).
    """
    out_dir.mkdir(parents=True, exist_ok=True)

    # Si pedimos m4a, intenta bajar directamente el stream en m4a (evita transcodificar).
    if audio_format.lower() == "m4a":
        ytdlp_format = "bestaudio[ext=m4a]/bestaudio/best"
        postprocessors: List[dict] = [
            {"key": "FFmpegMetadata"},
            {"key": "EmbedThumbnail"},
        ]
    elif audio_format.lower() == "opus":
        # Opus: normalmente YouTube sirve opus/webm. Si no es opus, se recodifica.
        ytdlp_format = "bestaudio[acodec=opus]/bestaudio/best"
        postprocessors = [
            {"key": "FFmpegExtractAudio", "preferredcodec": "opus", "preferredquality": "0"},
            {"key": "FFmpegMetadata"},
            {"key": "EmbedThumbnail"},
        ]
    else:  # mp3 (compatibilidad máxima, pero es el más lento por recodificación)
        ytdlp_format = "bestaudio/best"
        postprocessors = [
            {"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": "0"},
            {"key": "FFmpegMetadata"},
            {"key": "EmbedThumbnail"},
        ]

    opts: dict = {
        "outtmpl": str(out_dir / "%(title)s.%(ext)s"),
        "quiet": False,
        "noprogress": False,
        "windowsfilenames": True,
        "default_search": "ytsearch",
        "format": ytdlp_format,
        "retries": 5,
        "fragment_retries": 5,
        "concurrent_fragment_downloads": 10,  # subir si tu red lo permite
        "postprocessors": postprocessors,
    }

    ffmpeg = _ffmpeg_guess()
    if ffmpeg:
        opts["ffmpeg_location"] = ffmpeg

    aria2c = _aria2c_guess()
    if aria2c:
        # aria2c acelera bastante en conexiones buenas
        opts["external_downloader"] = aria2c
        opts["external_downloader_args"] = {
            "default": ["-x", "16", "-s", "16", "-k", "1M", "--file-allocation=none"]
        }

    return opts

def download_audio(src: str, out_dir: Path, audio_format: str = "mp3") -> None:
    opts = _build_opts(out_dir, audio_format)
    with YoutubeDL(opts) as ydl:
        ydl.download([src])

def download_batch(queries: list[str], out_dir: Path, audio_format: str = "mp3") -> None:
    """
    Descarga una lista de consultas (Artista - Título). Busca en YT y descarga.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    for i, q in enumerate(queries, 1):
        print(f"[{i}/{len(queries)}] Buscando:", q)
        url = find_ytmusic_url(q)
        if not url:
            print("  ⚠️  No encontrado en YouTube Music")
            continue
        try:
            download_audio(url, out_dir, audio_format=audio_format)
        except Exception as e:
            print("  ❌ Error descargando:", e)
            sleep(1.0)
