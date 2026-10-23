# Transcripts HTML

El bot genera sus transcripts con código propio. No usa una librería de transcripts ni guarda el chat en MongoDB: toma una **foto del estado final visible** del canal, crea uno o más HTML y los publica en Discord.

## Cobertura

El HTML usa una vista responsive inspirada en Discord oscuro e incluye:

- texto y markdown de Discord; menciones de usuarios, roles, canales, slash commands, timestamps, emojis y spoilers
- nombre, avatar y color del rol principal actual del autor
- comandos que Discord guarda en la interacción del mensaje, incluidas las respuestas del bot, y respuestas citadas
- reenvíos con el contenido, embeds, componentes y archivos visibles del mensaje original
- mensajes del sistema (anclados, cambios de canal, boosts y avisos de Discord) cuando el mensaje no trae texto propio
- embeds clásicos y Components V2
- imágenes, reacciones, stickers y archivos que no sean audio o vídeo
- fecha exacta e IDs técnicos en un detalle desplegable

No incluye respuestas efímeras, hilos, audio, vídeo, historial de ediciones ni mensajes ya eliminados. Discord no devuelve esos datos al leer el canal. Un mensaje editado aparece con su contenido final y la marca `edited`.

## Imágenes

El HTML es híbrido. El bot descarga previews desde HTTPS público, las reduce con `sharp` y las incrusta hasta completar el presupuesto del archivo. Conserva el enlace original para abrir la imagen completa.

Toda descarga tiene timeout, límite de bytes, límite de redirects, concurrencia acotada y validación DNS/IP. No se descargan recursos que resuelvan a loopback, redes privadas o rangos reservados. Si una imagen no responde, no es realmente una imagen o excede los límites, el transcript conserva su URL y continúa.

## Tamaño y publicación

Cada página se mantiene por debajo de un límite conservador de subida. Los mensajes nunca se cortan entre páginas. Si una sola tarjeta sería demasiado grande por sus previews, esa tarjeta usa URLs externas en vez de previews incrustadas.

Un transcript pequeño se adjunta al mismo Components V2 que lo anuncia. Si hace falta dividirlo, cada parte se sube como HTML y un Components V2 final funciona como índice. La URL de ese índice es la que se enlaza desde `/schedule results`.

Si falla una publicación multiparte, el bot intenta borrar las partes incompletas. En un ticket de validación, cualquier fallo conserva el canal. En una sala de partido ya archivada, el fallo se informa y nunca se anuncia un transcript parcial como completo.

## Rendimiento

Los mensajes se obtienen en páginas de 100, siempre desde el más antiguo de cada página. Las descargas se deduplican y tienen un máximo de trabajo paralelo. Red, compresión, envío y el armado del HTML ceden el event loop: el cierre que pidió el transcript espera su resultado, pero el bot puede seguir atendiendo el resto.
