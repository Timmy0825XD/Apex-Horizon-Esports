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

**Para qué:** Banear por Discord ID (aunque la persona no esté en el servidor). Components V2. Guarda el ban en el almacén (`duration`, `expiresAt`) para que el worker de caducidad lo levante si no es permanente.

| Campo | Tipo | Obligatorio |
|---|---|---|
| discord_id | STRING | Sí | ID numérico (`17`–`20` dígitos), no un picker de usuario. |
| time | STRING (Choice) | Sí | `7 days` · `1 month` · `2 months` · `6 months` · `Permanent` |
| reason | STRING | No | Máx. 512. |

Organiser (`manager_role` o Administrator). No se banea a uno mismo, al owner, al bot ni a otros bots. Si el objetivo está en el servidor, la jerarquía Discord gana. El bot necesita **Ban Members**. Si ya está baneado, no reescribe la duración. Audita en **Bot Logs**.

## `/user unban`

**Para qué:** Quitar el ban de Discord y borrar el registro rastreado (cancela la caducidad pendiente). Si Discord ya no lo tenía baneado pero el bot sí lo recordaba, solo cancela el vencimiento.

| Campo | Tipo | Obligatorio |
|---|---|---|
| discord_id | STRING | Sí |

Organiser. El bot necesita **Ban Members**. Audita.
