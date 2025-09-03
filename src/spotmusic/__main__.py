# src/spotmusic/__main__.py
from rich.console import Console
from pathlib import Path
from . import __app_name__, __version__
from .spotify import obtener_canciones
from .downloader import find_ytmusic_url, download_audio

console = Console()

def main():
    console.print(f"[bold cyan]{__app_name__}[/bold cyan] v{__version__}")

    url = console.input("[yellow]Pega un link de Spotify: [/yellow]").strip()
    canciones = obtener_canciones(url)
    console.print(f"[green]Encontradas {len(canciones)} canciones[/green]")

    if not canciones:
        return

    query = canciones[0]
    console.print(f"Probando con: [cyan]{query}[/cyan]")

    yt = find_ytmusic_url(query)
    if not yt:
        console.print("[red]No se encontró en YouTube Music[/red]")
        return

    console.print(f"URL encontrada: {yt}")
    download_dir = Path("downloads")
    download_audio(yt, download_dir, audio_format="mp3")
    console.print(f"[bold green]Listo.[/bold green] Revisa {download_dir.resolve()}")

if __name__ == "__main__":
    main()
