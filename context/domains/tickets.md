# Cierre de ticket, transcript y resultados

Cerrar un ticket **no** es lo mismo que reportar el score. El canal nace en [bracket-rooms.md](bracket-rooms.md): su descripción es `Tournament ID: <id de Challonge> | Match ID: <id del match>`.

| Comando | Efecto |
|---|---|
| `/ticket close` | Sala de partido: silencia y mueve a categoría de cerrados. Se puede reabrir. Ticket de `/tournament validate`: transcript HTML al canal guardado en el topic y el canal se borra. |
| `/ticket reopen` | Restaura permisos y, si se sabe, la categoría original. |
| `/ticket delete` | El canal desaparece; se olvida el vínculo partido↔canal. Irreversible. |
| `/bracket upload` | Además de reportar al bracket, renombra/cierra/archiva y transcribe como parte del cierre **oficial** del partido. |

Regla dura (producto): **un partido, una sala**. Ver [../product/overview.md](../product/overview.md).

`/tournament validate` abre canales de validación de roster. No son salas de partido. `/ticket close` en ese canal avisa en efímero que se borra en **5** segundos, envía el HTML al transcript elegido al crearlo (no al de las salas) y después borra el canal. `/ticket reopen` y `/ticket delete` no lo archivan.

## Transcript

El transcript es una **foto HTML** del estado final visible del canal, generada por el bot con su renderer propio. Incluye texto y markdown, menciones, comandos y respuestas, embeds, Components V2, imágenes, reacciones, stickers, emojis y archivos no audiovisuales. No incluye efímeros, hilos, audio, vídeo, mensajes eliminados ni versiones anteriores de mensajes editados. Las imágenes usan previews incrustados con enlace al original; si excede el tamaño seguro, el transcript se divide en varias páginas HTML bajo un mensaje índice.

Vive en Discord (canal de transcripts del torneo). Si se pierde el mensaje, se perdió el archivo. Tras `/bracket upload`, la URL del mensaje índice se enlaza al título de los embeds de `/schedule results`. Detalle técnico y límites: [../platform/transcripts.md](../platform/transcripts.md).

Los transcripts **no** son el sistema de auditoría: son el archivo del chat, en otro canal, con otra identidad (ver [../platform/audit.md](../platform/audit.md)).

## Relacionado

- Ciclo: [../product/match-lifecycle.md](../product/match-lifecycle.md)
- Bracket: [bracket-rooms.md](bracket-rooms.md)
- Comandos: [../commands/tickets.md](../commands/tickets.md)
