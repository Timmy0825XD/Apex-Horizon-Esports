# Qué es el bot

El bot no organiza un torneo “en abstracto”. Opera el **ciclo de vida de un partido competitivo dentro de Discord**, usando tres verdades externas que no crea ni sustituye:

1. **Quién juega** — la hoja de participantes del torneo.
2. **Qué partidos existen y quién avanza** — el bracket externo.
3. **Dónde ocurre el trabajo humano** — canales, roles y mensajes del servidor.

Todo lo demás (tickets, horarios, staff, asistencia, transcripts, sueldos, auditoría) existe para que esas tres verdades se puedan ejecutar sin caos.

## Definición de core

El bot es el **operador de torneo** de un servidor Discord. Un servidor puede tener varios torneos a la vez (máximo **cuatro activos**). Cada torneo es un mundo cerrado: su bracket, su hoja, sus categorías de tickets, su canal de asistencia, su canal de resultados.

**Core:** convertir un partido del bracket en un **ticket** (canal privado), coordinar **quién lo juega, quién lo juzga, quién lo graba y a qué hora**, registrar **qué pasó**, reportar el **marcador al bracket**, archivar la conversación y **abrir el siguiente partido** cuando el bracket lo declare abierto.

## Lo que el bot no es

- No es el dueño del bracket. No crea ni siembra el cuadro. Solo **lee** partidos y **reporta** resultados.
- No es el formulario de inscripción. Los capitanes escriben en la hoja; el bot **lee y valida**. Guarda **copias** de esas hojas para `/tournament find_player`; la Google Sheet sigue siendo la verdad al operar el torneo.
- No es el reglamento. Publica y apunta al canal de reglas; no redacta el ruleset.
- No es un archivo histórico de chats. El transcript es un HTML que se **envía a un canal** y no se guarda como registro interno.
- No es un juez automático. El resultado humano (asistencia, capturas, schedule results) y el resultado del bracket (`/upload_score`) son **dos actos distintos**.

## Unidad operativa: el ticket

Un **ticket** es un canal privado = **un partido**. Nace cuando el partido está `open` en el bracket, ambos lados tienen nombres reales (no placeholders tipo “Winner of…”) y todavía no hay sala. Muere cuando se cierra, se mueve a categoría de cerrados, se borra, o se recrea porque una corrección de bracket cambió quién debía jugar ahí.

Regla dura: **un partido, una sala**. Si ya existe ticket para ese match, no se crea otro.

## Dos capas de configuración

| Capa | Qué define | Quién la configura |
|---|---|---|
| **Servidor** | Admin del bot, verificado, bracket admin, schedules, thumbnails, bans y canales de logs; jerarquía de staff | `/settings` + `/staff config` |
| **Torneo** | Bracket, hoja, roles de organizer/helper de *ese* torneo, categorías de tickets, canales de asistencia / transcripts / reglas / deadlines / resultados / links de grabación, si auto-room está habilitado | `/tournament add` / `edit` |

Sin la capa servidor, no hay auditoría ni schedules publicados. Sin la capa torneo, no hay partidos que operar.

## Relacionado

- Actores: [actors.md](actors.md)
- Ciclo del partido: [match-lifecycle.md](match-lifecycle.md)
- Bracket y salas: [../domains/bracket-rooms.md](../domains/bracket-rooms.md)
- Tickets: [../domains/tickets.md](../domains/tickets.md)
