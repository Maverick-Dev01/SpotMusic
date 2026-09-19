# SpotMusic Desktop 1.0.10

Verificado en Electron para macOS: reproducción de archivos locales de prueba, anterior/siguiente, aleatorio, repetición de una pista, selección de todas las descargas y eliminación física de tres archivos de prueba. Las pruebas se realizaron con un directorio de datos y audio separado del usuario.

Cuatro pruebas automatizadas cubren navegación, repetición/aleatorio, eliminación de la cola, paginación de 1000 canciones y validación de estado/intercambio PKCE sin secreto.

Instaladores compilados para macOS ARM64/Intel y Windows x64. FFmpeg es universal para ambos tipos de Mac. No se ejecutó Windows en este equipo. Los paquetes mantienen la configuración existente sin firma de distribución/notarización de Apple ni firma Authenticode configurada.

Para consultar todas las páginas de playlists accesibles se añadió Vincular Spotify en Ajustes, con PKCE y el callback spotmusic-login://callback. La sesión persistente se cifra mediante Electron safeStorage cuando el sistema lo permite. No se completó un inicio de sesión real con una cuenta del usuario; el flujo PKCE se probó de forma automatizada. Spotify puede restringir listas y cuentas según el modo y permisos de la aplicación.
