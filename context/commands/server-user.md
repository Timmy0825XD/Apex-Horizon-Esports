# Server y usuario

Reglas: [../domains/moderation.md](../domains/moderation.md).

## `/server info`

**Para qué:** Instantánea en vivo del servidor. Components V2 (container + thumbnail del icono). El título es el **nombre del servidor**, no un rótulo genérico.

Muestra: nombre, ID, owner (mención), enlace del icono, miembros (total / humanos / bots), canales (texto / voz / categorías), roles, fecha de creación y antigüedad. No incluye boosts ni emojis del servidor.

**Campos:** ninguno. Público. No audita.

## `/server banlist`

**Para qué:** Exportar los bans actuales de Discord del servidor. Components V2 con thumbnail del icono, el archivo va en un componente File. Por defecto adjunta un `.txt`; con `excel: true`, un `.xlsx`. Columnas: **ID**, **Date**, **Reason**. La fecha sale del ban que el bot tenga rastreado; si no, del audit log reciente; si tampoco, `Unknown`. El ID va en texto plano para no perder el snowflake en Excel.

**Campos:**

| Campo | Tipo | Obligatorio |
|---|---|---|
| excel | BOOLEAN | No | Default false. Si es true, genera `.xlsx` en vez de `.txt`. |

Organiser (`manager_role` o Administrator). Respuesta efímera. No audita (solo lectura). El bot necesita **Ban Members**.

## `/server tree`

**Para qué:** Exportar el árbol de categorías y canales (sin hilos). Components V2 con thumbnail del icono y componente File. Por defecto `.txt` indentado; con `excel: true`, tabla plana (categoría, IDs, tipo, posición). Los nombres van en el archivo, no en el panel.

**Campos:**

| Campo | Tipo | Obligatorio |
|---|---|---|
| excel | BOOLEAN | No | Default false. Si es true, genera `.xlsx` en vez de `.txt`. |

Organiser. Respuesta efímera. No audita.

## `/server invites`

**Para qué:** Exportar invites activos (código, usos, máximo, canal, invitador, caducidad, temporal, creación). Incluye vanity (`discord.gg/code` y usos) si existe. Components V2 con thumbnail y File. Por defecto `.txt`; con `excel: true`, `.xlsx`. IDs en texto plano.

**Campos:**

| Campo | Tipo | Obligatorio |
|---|---|---|
| excel | BOOLEAN | No | Default false. Si es true, genera `.xlsx` en vez de `.txt`. |

Organiser. Respuesta efímera. No audita. El bot necesita **Manage Server** o **View Audit Log**.

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
