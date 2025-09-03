from rich.console import Console
from rich.prompt import IntPrompt, Confirm
from pathlib import Path
from . import __app_name__, __version__
from .spotify import obtener_canciones
from .downloader import download_batch

console = Console()

def main():
    console.print(f"[bold cyan]{__app_name__}[/bold cyan] v{__version__}")

    url = console.input("[yellow]Pega un link de Spotify: [/yellow]").strip()
    canciones = obtener_canciones(url)
    if not canciones:
        console.print("[red]No se encontraron canciones[/red]")
        return

    console.print(f"[green]Encontradas {len(canciones)} canciones[/green]")

    # ¿Descargar todas o las primeras N?
    if Confirm.ask("¿Descargar TODAS?", default=True):
        a_descargar = canciones
    else:
        n = IntPrompt.ask("¿Cuántas (primeras N)?", default=min(3, len(canciones)))
        a_descargar = canciones[:max(0, min(n, len(canciones)))]

    out_dir = Path("downloads")
    console.print(f"Descargando en: [cyan]{out_dir.resolve()}[/cyan]")
    download_batch(a_descargar, out_dir, audio_format="mp3")
    console.print("[bold green]Listo.[/bold green]")

if __name__ == "__main__":
    main()
