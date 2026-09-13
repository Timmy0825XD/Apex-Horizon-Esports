# Server y usuario

Reglas: [../domains/moderation.md](../domains/moderation.md).

## `/server info`

Sin campos. Público. Estadísticas en vivo. No audita.

## `/server banlist`

| Campo | Tipo | Obligatorio |
|---|---|---|
| excel | BOOLEAN | No | Default false |

Organiser. Lista o `.xlsx`. No audita (solo lectura).

## `/user ban`

| Campo | Tipo | Obligatorio |
|---|---|---|
| discord_id | STRING | Sí |
| time | STRING (Choice) | Sí | 7 days · 1 month · 2 months · 6 months · Permanent |
| reason | STRING | No |

Organiser. No se banea a uno mismo, al owner, al bot ni a otros bots. Temporales los levanta el worker. Audita.

## `/user unban`

| Campo | Tipo | Obligatorio |
|---|---|---|
| discord_id | STRING | Sí |

Audita. Cancela la caducidad pendiente.
