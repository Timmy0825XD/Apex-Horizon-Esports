# Salas y bracket

Reglas: [../domains/bracket-rooms.md](../domains/bracket-rooms.md). Worker: [../platform/workers.md](../platform/workers.md).

## `/auto_room`

Un solo comando. Organiser.

| Campo | Tipo | Obligatorio |
|---|---|---|
| tournament | STRING (Autocomplete) | Sí |
| status | BOOLEAN | Sí |

`status` true enciende la automatización. Si venía de off, abre en ese momento los partidos `open` sin sala y publica en el canal el mismo reporte que `/room create`. Los que se abran después esperan a **00:00 UTC** o **12:00 UTC**. `status` false apaga el escaneo y no cierra tickets. Ya encendido, apagado, y el error si el bracket no se puede leer, siguen efímeros. Si el bracket no se puede leer al encender, auto-room **sigue off**. Audita en **Bot Logs**.

## `/room create`

| Campo | Tipo | Obligatorio |
|---|---|---|
| tournament | STRING (Autocomplete) | Sí |
| group | STRING (Autocomplete) | No |
| round | STRING (Autocomplete) | No |

Abre la cola pendiente de ese torneo ahora. Sin `group` ni `round`, abre toda. Con uno o ambos, solo los partidos de ese grupo y/o esa ronda. Las opciones salen del bracket de **ese** torneo. No exige que auto-room esté encendido y **no cambia** el flag: si estaba off, sigue off. Misma tubería que el encendido y que el worker. Audita en **Bot Logs**.

La respuesta se publica en el canal (no efímera). V2 con **Created**, **Succeeded** y **Errors**, el cupo de las categorías abiertas (slots libres antes y después; si la cola no cabe, cuántos partidos siguen esperando) y, al final, **Issues**: capitán que no está en el servidor como `- @capitán (**tag** / **equipo**)`, o tag y equipo cuando el Discord ID es inválido o falta. No lista los canales creados.

## `/room available`

| Campo | Tipo | Obligatorio |
|---|---|---|
| tournament | STRING (Autocomplete) | Sí |

Solo lectura. Se publica en el canal (no efímero). V2 con barra verde: título *Available Rooms for* el torneo, `Showing 1 - 20 of N`, y cada partido en dos líneas: emoji `vs` **Match N** - Round N - Group N (el grupo solo si el torneo tiene grupos) y `nombre vs nombre`, con `_` escapado para que Discord no lo pinte en cursiva. A partir de **20** partidos hay Previous / Next. No audita.

## `/upload_score`

**Solo dentro del ticket.** Aún no implementado en esta fase.

| Campo | Tipo | Obligatorio |
|---|---|---|
| score1 | INTEGER | Sí |
| score2 | INTEGER | Sí |
| note | STRING | No |

Reporta al bracket, completa el match, cierra/archiva, transcript. Al publicar el transcript debe llamar `attachResultsTranscript` con la URL de ese mensaje para enlazar el título de los embeds de `/schedule results`. El siguiente ticket espera al reloj si auto-room está on. Log: **Score Upload**. Empate prohibido.

## `/correct_bracket`

Aún no implementado en esta fase.

| Campo | Tipo | Obligatorio |
|---|---|---|
| tournament | STRING (Autocomplete) | Sí |
| match | STRING (Autocomplete) | Sí |
| score1 | INTEGER | Sí |
| score2 | INTEGER | Sí |

Enmienda el cuadro y repara salas aguas abajo. Log: **Score Upload**. Deja corrección histórica.
