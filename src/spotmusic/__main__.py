from rich.console import Console
from urllib3.util import url

from . import __app_name__, __version__
from .spotify import obtener_canciones

console = Console()

def main():
    console.print(f"[bold cyan]{__app_name__}[/bold cyan] v{__version__}")

    url = console.input("[yellow]Pega un link de Spotify: [/yellow]").strip()
    canciones = obtener_canciones(url)

    console.print(f"[green]Encontradas {len(canciones)} canciones:[/green]")
    for c in canciones:
        console.print(f" - {c}")

if __name__ == "__main__":
    main()

