# src/spotmusic/downloader.py
from __future__ import annotations
from pathlib import Path
from typing import Optional
from yt_dlp import YoutubeDL
from time import sleep


def find_ytmusic_url(query: str) -> Optional[str]:
    """
    Devuelve la primera coincidencia de YouTube/YouTube Music para la consulta dada.
    """
    with YoutubeDL({"quiet": True, "noplaylist": True, "default_search": "ytsearch"}) as ydl:
        info = ydl.extract_info(f"ytsearch1:{query}", download=False)
        if not info or "entries" not in info or not info["entries"]:
            return None
        return info["entries"][0]["webpage_url"]

def download_audio(src: str, out_dir: Path, audio_format: str = "mp3") -> None:
    """
    Descarga el audio y lo convierte a mp3 (requiere FFmpeg).
    """
    out_dir.mkdir(parents=True, exist_ok=True)

    opts = {
        "outtmpl": str(out_dir / "%(title)s.%(ext)s"),
        "quiet": False,
        "noprogress": False,
        "windowsfilenames": True,
        "default_search": "ytsearch",
        "postprocessors": [
            {"key": "FFmpegExtractAudio", "preferredcodec": audio_format, "preferredquality": "0"},
            {"key": "FFmpegMetadata"},
            {"key": "EmbedThumbnail"},
        ],
        "retries": 5,
        "fragment_retries": 5,
    }

    with YoutubeDL(opts) as ydl:
        ydl.download([src])

def download_batch(queries: list[str], out_dir: Path, audio_format: str = "mp3") -> None:
    """
    Descarga una lista de consultas (Artista - Título).
    Busca en YT cada una y descarga en out_dir.
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
            # pausa pequeña por si hay rate limit
            sleep(1.0)