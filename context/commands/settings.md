# Settings (capa servidor — roles, logs y canales operativos)

Patrón: **set** (todo de una vez) → **edit** (solo lo que pases) → **show** (solo lectura).

Las respuestas de set / edit / show son **Components V2** (`Container`, `Text Display`), no un embed clásico.

Reglas de producto: [../product/overview.md](../product/overview.md). Auditoría: [../platform/audit.md](../platform/audit.md).

## `/settings set`

**Para qué:** Primer arranque del servidor. Sin esto no hay admin del bot, canal de schedules, thumbnails, bans ni auditoría.

Solo **Administrator** de Discord (aún no existe `admin_role`). Si el servidor ya tiene settings, hay que usar `edit`.

| Campo | Tipo | Obligatorio | Uso |
|---|---|---|---|
| admin_role | ROLE | Sí | Admin del bot (además del permiso Administrator) |
| verified_role | ROLE | Sí | Miembros verificados |
| bracket_admin | ROLE | Sí | Operación de bracket a nivel servidor |
| schedules_channel | CHANNEL | Sí | Publicación de horarios y urgencias T-0 |
| thumbnail_channel | CHANNEL | Sí | Miniaturas de schedule |
| bans_channel | CHANNEL | Sí | Avisos de bans |
| challonge_logs | CHANNEL | Sí | Logs de bracket y scores |
| bot_logs | CHANNEL | Sí | Logs generales |

Canales: texto o announcement. **Relación:** prerrequisito de casi toda mutación auditable. Complementa `/staff config` (no pisa roles de staff). Audita en **Bot Logs**.

## `/settings edit`

**Para qué:** Cambiar un rol o canal sin reescribir el resto.

Mismos campos que `set`, todos opcionales. Al menos uno, y tiene que cambiar el valor guardado. Requiere set previo. Admin (Administrator de Discord **o** `admin_role`). Audita.

## `/settings show`

**Para qué:** Ver la config actual y si roles/canales siguen existiendo. No cambia nada. No audita. Admin.
