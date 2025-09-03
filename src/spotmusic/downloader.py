# src/spotmusic/downloader.py
from __future__ import annotations
from pathlib import Path
from typing import Optional
from yt_dlp import YoutubeDL

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
