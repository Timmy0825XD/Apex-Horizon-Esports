# Transcripts HTML

El bot genera sus transcripts con código propio. No usa una librería de transcripts ni guarda el chat en MongoDB: toma una **foto del estado final visible** del canal, crea uno o más HTML y los publica en Discord.

## Vista

El HTML imita el cliente de Discord en tema oscuro (solo oscuro), con la fuente Noto Sans de Google Fonts (sin conexión cae a la del sistema). Los textos fijos van en inglés; fechas y horas se formatean en el navegador de quien lo abre.

- **Tres columnas.** Izquierda: servidor, datos del transcript (canal, mensajes, participantes, rango de fechas, generado), enlaces a cada parte si se dividió, e IDs de canal y servidor. Centro: barra de canal (`#` nombre, topic y buscador), el chat y una barra de solo lectura donde iría el composer. Derecha: participantes agrupados por su rol principal (el rol separado o, si no hay, el más alto), con color y conteo de mensajes; los bots van en **Apps**. Bajo 1100 px los participantes pasan a un cajón; bajo 760 px también la info.
- **Chat.** Arranca con el "Welcome to #canal!" de Discord. Separadores de día y agrupado de mensajes seguidos del mismo autor (menos de 7 minutos), con la hora al pasar el ratón. Cabecera `Today at` / `Yesterday at` / fecha, badge **APP** para bots y `(edited)`.
- **Respuestas y comandos.** Línea curva con mini avatar y nombre en color de quien se cita o de quien usó el comando (`Valen used /bracket upload`). Si hay comando, se muestra el comando. Clic en una respuesta salta al original y lo resalta.
- **Detalles técnicos.** Botón al pasar el ratón con un popover (ID de mensaje y usuario, username, tipo, edición, comando e interacción) y otro para copiar el enlace al mensaje.
- **Avatares.** Cada avatar se incrusta una sola vez por página (una regla CSS por autor); sin imagen, círculo de color con la inicial.

## Cobertura

- texto y markdown de Discord; menciones de usuarios, roles, canales, slash commands, timestamps, emojis y spoilers
- nombre, avatar, color y rol principal actual del autor
- comandos que Discord guarda en la interacción del mensaje, incluidas las respuestas del bot, y respuestas citadas
- reenvíos con el contenido, embeds, componentes y archivos visibles del mensaje original
- mensajes del sistema como una línea con icono (anclados, cambio de nombre del canal, hilos, boosts, uniones y avisos de Discord)
- embeds clásicos y Components V2 (container con barra de acento, secciones, galerías, archivos, botones y selects)
- imágenes, reacciones, stickers y archivos que no sean audio o vídeo
- icono del servidor

No incluye respuestas efímeras, hilos, audio, vídeo, historial de ediciones ni mensajes ya eliminados. Discord no devuelve esos datos al leer el canal. Un mensaje editado aparece con su contenido final y la marca `edited`.

## Imágenes

El HTML es híbrido. El bot descarga previews desde HTTPS público, las reduce con `sharp` y las incrusta hasta completar el presupuesto del archivo. Conserva el enlace original para abrir la imagen completa.

Toda descarga tiene timeout, límite de bytes, límite de redirects, concurrencia acotada y validación DNS/IP. No se descargan recursos que resuelvan a loopback, redes privadas o rangos reservados. Si una imagen no responde, no es realmente una imagen o excede los límites, el transcript conserva su URL y continúa.

## Tamaño y publicación

Cada página se mantiene por debajo de un límite conservador de subida. Los mensajes nunca se cortan entre páginas. Si una sola tarjeta sería demasiado grande por sus previews, esa tarjeta usa URLs externas en vez de previews incrustadas.

Un transcript pequeño se adjunta al mismo Components V2 que lo anuncia. Si hace falta dividirlo, cada parte enlaza a las demás por nombre de archivo (funciona si se descargan juntas en la misma carpeta), cada parte se sube como HTML y un Components V2 final funciona como índice. La URL de ese índice es la que se enlaza desde `/schedule results add`.

Si falla una publicación multiparte, el bot intenta borrar las partes incompletas. En un ticket de validación, cualquier fallo conserva el canal. En una sala de partido ya archivada, el fallo se informa y nunca se anuncia un transcript parcial como completo.

## Rendimiento

Los mensajes se obtienen en páginas de 100, siempre desde el más antiguo de cada página. Las descargas se deduplican y tienen un máximo de trabajo paralelo. Red, compresión, envío y el armado del HTML ceden el event loop: el cierre que pidió el transcript espera su resultado, pero el bot puede seguir atendiendo el resto.
