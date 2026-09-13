# Salas y bracket

Reglas: [../domains/bracket-rooms.md](../domains/bracket-rooms.md). Worker: [../platform/workers.md](../platform/workers.md).

## `/auto_room run`

| Campo | Tipo | Obligatorio |
|---|---|---|
| tournament | STRING (Autocomplete) | Sí |

Enciende automatización + abre hasta 25 salas elegibles. Relación: worker 60 s, `/upload_score`. Audita.

## `/auto_room stop`

Apaga el escaneo. No cierra tickets. Audita.

## `/auto_room toggle`

Invierte el estado. Audita.

## `/room create`

| Campo | Tipo | Obligatorio |
|---|---|---|
| tournament | STRING (Autocomplete) | Sí |
| category | CHANNEL (categoría) | Sí |
| limit | INTEGER (1–25) | Sí |
| group | STRING (Autocomplete) | No |

Misma tubería que auto-room (sin duplicar). Audita.

## `/room available`

| Campo | Tipo | Obligatorio |
|---|---|---|
| tournament | STRING (Autocomplete) | Sí |
| group | STRING (Autocomplete) | No |

Solo lectura de la cola.

## `/upload_score`

**Solo dentro del ticket.**

| Campo | Tipo | Obligatorio |
|---|---|---|
| score1 | INTEGER | Sí |
| score2 | INTEGER | Sí |
| note | STRING | No |

Reporta al bracket, completa el match, cierra/archiva, transcript, encadena auto-room. Log: **Score Upload**. Empate prohibido.

## `/correct_bracket`

| Campo | Tipo | Obligatorio |
|---|---|---|
| tournament | STRING (Autocomplete) | Sí |
| match | STRING (Autocomplete) | Sí |
| score1 | INTEGER | Sí |
| score2 | INTEGER | Sí |

Enmienda el cuadro y repara salas aguas abajo. Log: **Score Upload**. Deja corrección histórica.
