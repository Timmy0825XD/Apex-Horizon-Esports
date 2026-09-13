# Cierre de ticket, transcript y resultados

Cerrar un ticket **no** es lo mismo que reportar el score.

| Comando | Efecto |
|---|---|
| `/ticket close` | Silencia y mueve a categoría de cerrados. Se puede reabrir. |
| `/ticket reopen` | Restaura permisos y, si se sabe, la categoría original. |
| `/ticket delete` | El canal desaparece; se olvida el vínculo partido↔canal. Irreversible. |
| `/upload_score` | Además de reportar al bracket, cierra/archiva como parte del cierre **oficial** del partido. |

Regla dura (producto): **un partido, una sala**. Ver [../product/overview.md](../product/overview.md).

## Transcript

El transcript es una **foto HTML** del canal en el momento del archivo. Vive en Discord (canal de transcripts del torneo y/o logs de transcripts del servidor). Si se pierde el mensaje, se perdió el archivo.

Los transcripts **no** son el sistema de auditoría: son el archivo del chat, en otro canal, con otra identidad (ver [../platform/audit.md](../platform/audit.md)).

## Relacionado

- Ciclo: [../product/match-lifecycle.md](../product/match-lifecycle.md)
- Bracket: [bracket-rooms.md](bracket-rooms.md)
- Comandos: [../commands/tickets.md](../commands/tickets.md)
