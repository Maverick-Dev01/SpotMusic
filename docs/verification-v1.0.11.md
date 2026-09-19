# Verificación 1.0.11

Se comprobó en Electron/macOS que la importación sin una cuenta vinculada solicita autorización PKCE y devuelve un estado explícito de inicio de sesión requerido, sin cargar la vista pública parcial. La apertura del navegador se sustituyó por un doble de prueba; no se autorizó una cuenta real del usuario.

Tras el callback correcto, la interfaz reintenta el enlace pendiente siempre que el usuario no haya cambiado la búsqueda. Los rechazos 401/403 se muestran con instrucciones para renovar la sesión o revisar la autorización en Spotify Developer.

Cuatro pruebas existentes pasan. Los paquetes de Mac ARM64, Mac Intel y Windows x64 fueron compilados y su código empacado se comparó con el código fuente. Windows no se ejecutó en este equipo.
