# src/spotmusic/ui/main_window.py
from __future__ import annotations
import threading
from pathlib import Path
from tkinter import BooleanVar, Canvas, Scrollbar, filedialog
import ttkbootstrap as ttk
from ttkbootstrap.constants import *

from spotmusic.spotify import obtener_canciones
from spotmusic.downloader import find_ytmusic_url, download_audio

class App(ttk.Window):
    def __init__(self):
        super().__init__(themename="darkly")
        self.title("SoundSnap")
        self.geometry("820x700")
        self.resizable(False, False)

        # state
        self.url_var = ttk.StringVar()
        self.dir_var = ttk.StringVar(value=str(Path.home() / "Downloads" / "SoundSnap"))
        self.checks: list[ttk.Checkbutton] = []
        self.cancel_flag = False

        # header
        ttk.Label(self, text="🎧 SoundSnap: Descarga canciones de Spotify",
                  font=("Segoe UI Semibold", 16)).pack(pady=(10, 2))
        ttk.Label(self, text="Spotify Playlist / Track / Album",
                  font=("Segoe UI", 10, "italic")).pack()

        # url input
        f_url = ttk.Frame(self); f_url.pack(fill="x", padx=15, pady=8)
        ttk.Entry(f_url, textvariable=self.url_var).pack(side="left", fill="x", expand=True)
        self.btn_search = ttk.Button(f_url, text="🔍 Search", bootstyle="primary", command=self.on_search)
        self.btn_search.pack(side="left", padx=8)

        # output dir
        f_dir = ttk.Frame(self); f_dir.pack(fill="x", padx=15, pady=(0, 8))
        ttk.Label(f_dir, text="📥 Download to", font=("Segoe UI", 10, "bold")).pack(anchor="w")
        ff = ttk.Frame(f_dir); ff.pack(fill="x", pady=4)
        ttk.Entry(ff, textvariable=self.dir_var).pack(side="left", fill="x", expand=True)
        ttk.Button(ff, text="📁 Elegir carpeta", command=self.choose_dir).pack(side="left", padx=8)

        # formato de salida
        f_fmt = ttk.Frame(self);
        f_fmt.pack(fill="x", padx=15, pady=(0, 8))
        ttk.Label(f_fmt, text="Formato de salida", font=("Segoe UI", 10, "bold")).pack(side="left")
        self.format_var = ttk.StringVar(value="mp3")
        ttk.Combobox(
            f_fmt,
            textvariable=self.format_var,
            values=("mp3", "m4a", "opus"),
            state="readonly",
            width=8
        ).pack(side="left", padx=10)

        # scrollable list
        wrap = ttk.Frame(self); wrap.pack(fill="both", expand=False, padx=15, pady=(4, 0))
        self.canvas = Canvas(wrap, bg="#1a1a1a", height=320, highlightthickness=0)
        self.scroll_y = Scrollbar(wrap, orient="vertical", command=self.canvas.yview)
        self.list_frame = ttk.Frame(self.canvas)
        self.list_frame.bind("<Configure>", lambda e: self.canvas.configure(scrollregion=self.canvas.bbox("all")))
        self.canvas.create_window((0, 0), window=self.list_frame, anchor="nw")
        self.canvas.configure(yscrollcommand=self.scroll_y.set)
        self.canvas.pack(side="left", fill="both", expand=True)
        self.scroll_y.pack(side="right", fill="y")
        self.canvas.bind_all("<MouseWheel>", lambda e: self.canvas.yview_scroll(int(-1 * (e.delta/120)), "units"))

        # counters + toggle
        fc = ttk.Frame(self); fc.pack(pady=6)
        self.lbl_total = ttk.Label(fc, text="Total: 0 canciones"); self.lbl_total.pack(side="left", padx=10)
        self.lbl_sel = ttk.Label(fc, text="Seleccionadas: 0"); self.lbl_sel.pack(side="left")
        self.btn_toggle = ttk.Button(self, text="✔️ Select All", bootstyle="secondary", command=self.toggle_all, state="disabled")
        self.btn_toggle.pack()

        # status + progress
        self.lbl_status = ttk.Label(self, text="", font=("Segoe UI", 10))
        self.lbl_status.pack(pady=(10, 0))
        self.pb = ttk.Progressbar(self, length=560, mode="determinate"); self.pb.pack(pady=8)

        # actions
        fa = ttk.Frame(self); fa.pack(pady=(0, 10))
        self.btn_cancel = ttk.Button(fa, text="✖ Cancelar", bootstyle="danger", command=self.cancel, state="disabled")
        self.btn_cancel.pack(side="left", padx=6)
        self.btn_download = ttk.Button(fa, text="⬇️ Download Selected", bootstyle="primary", command=self.download_selected, state="disabled")
        self.btn_download.pack(side="left", padx=6)

    # UI helpers
    def choose_dir(self):
        path = filedialog.askdirectory(initialdir=self.dir_var.get())
        if path:
            self.dir_var.set(path)

    def toggle_all(self):
        if not self.checks: return
        all_selected = all(chk.var.get() for chk in self.checks)
        for chk in self.checks:
            chk.var.set(not all_selected)
        self.update_selected_count()

    def update_selected_count(self, *_):
        sel = sum(1 for chk in self.checks if chk.var.get())
        self.lbl_sel.configure(text=f"Seleccionadas: {sel}")

    # Search flow
    def on_search(self):
        url = self.url_var.get().strip()
        if not url:
            self.set_status("⚠️ Pega un enlace de Spotify", "orange"); return
        self.btn_search.configure(state="disabled")
        self.set_status("Buscando canciones…", "cyan")
        self.clear_list()

        def task():
            try:
                songs = obtener_canciones(url)
            except Exception as e:
                songs = []
                self.set_status(f"❌ Error al obtener canciones: {e}", "red")

            def build():
                if not songs:
                    self.lbl_total.configure(text="Total: 0 canciones")
                    self.btn_search.configure(state="normal")
                    return
                for s in songs:
                    var = BooleanVar()
                    chk = ttk.Checkbutton(self.list_frame, text=s, variable=var, command=self.update_selected_count)
                    chk.var = var; chk.cancion = s
                    chk.pack(anchor="w", padx=10, pady=1)
                    self.checks.append(chk)
                self.lbl_total.configure(text=f"Total: {len(songs)} canciones")
                self.update_selected_count()
                self.btn_toggle.configure(state="normal")
                self.btn_download.configure(state="normal")
                self.btn_search.configure(state="normal")
                self.set_status("Listo para descargar.", "lime")
            self.after(0, build)

        threading.Thread(target=task, daemon=True).start()

    def clear_list(self):
        for w in self.list_frame.winfo_children():
            w.destroy()
        self.checks.clear()
        self.lbl_total.configure(text="Total: 0 canciones")
        self.lbl_sel.configure(text="Seleccionadas: 0")
        self.btn_toggle.configure(state="disabled")
        self.btn_download.configure(state="disabled")

    # Download flow
    def cancel(self):
        self.cancel_flag = True
        self.set_status("Cancelando…", "orange")

    def download_selected(self):
        selected = [chk.cancion for chk in self.checks if chk.var.get()]
        if not selected:
            self.set_status("⚠️ No seleccionaste ninguna canción.", "orange"); return
        out_dir = Path(self.dir_var.get()).expanduser()
        out_dir.mkdir(parents=True, exist_ok=True)
        self.pb.configure(maximum=len(selected), value=0)
        self.cancel_flag = False
        self.btn_cancel.configure(state="normal")
        self.btn_download.configure(state="disabled")
        self.set_status("Descargando…", "cyan")

        def worker():
            ok = 0
            for i, q in enumerate(selected, 1):
                if self.cancel_flag: break
                url = find_ytmusic_url(q)
                if not url:
                    self.set_status(f"⚠️ No encontrado en YouTube Music: {q}", "orange")
                    self.after(0, lambda v=i: self.pb.configure(value=v))
                    continue
                try:
                    download_audio(url, out_dir, audio_format=self.format_var.get())
                    ok += 1
                except Exception as e:
                    self.set_status(f"❌ Error descargando: {e}", "red")
                finally:
                    self.after(0, lambda v=i: self.pb.configure(value=v))
            def done():
                self.btn_cancel.configure(state="disabled")
                self.btn_download.configure(state="normal")
                if self.cancel_flag:
                    self.set_status("Descarga cancelada por el usuario.", "orange")
                else:
                    self.set_status(f"✅ Descarga terminada. Éxitos: {ok}/{len(selected)}", "lime")
            self.after(0, done)

        threading.Thread(target=worker, daemon=True).start()

    def set_status(self, msg: str, color: str = "white"):
        self.lbl_status.configure(text=msg, foreground=color)

def main():
    App().mainloop()

if __name__ == "__main__":
    main()
