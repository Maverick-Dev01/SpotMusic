from rich.console import Console
from . import __app_name__, __version__

console = Console()

def main():
    console.print(f"[bold cyan]{__app_name__}[/bold cyan] v{__version__}")
    console.print("Proyecto inicializado correctamente 🚀")

if __name__ == "__main__":
    main()
