from rich.console import Console
from rich.prompt import IntPrompt, Confirm, Prompt
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

    # Carpeta de salida (por defecto ./downloads)
    out_str = Prompt.ask("Carpeta de salida", default="downloads")
    out_dir = Path(out_str).expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    # Formato de audio
    formato = Prompt.ask("Formato [mp3/m4a/opus]", choices=["mp3", "m4a", "opus"], default="mp3")

    console.print(f"Descargando en: [cyan]{out_dir}[/cyan] como: [cyan]{formato}[/cyan]")
    download_batch(a_descargar, out_dir, audio_format=formato)
    console.print("[bold green]Listo.[/bold green]")


if __name__ == "__main__":
    main()
