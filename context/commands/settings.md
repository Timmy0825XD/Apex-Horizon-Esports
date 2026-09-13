# Settings (capa servidor — logs y admin)

Patrón: **setup** (todo de una vez) → **edit** (solo lo que pases) → **show** (solo lectura).

Reglas de producto: [../product/overview.md](../product/overview.md). Auditoría: [../platform/audit.md](../platform/audit.md).

## `/settings setup`

**Para qué:** Primer arranque del servidor: sin esto no hay canales de auditoría ni thumbnails.

| Campo | Tipo | Obligatorio | Uso |
|---|---|---|---|
| admin_role | ROLE | Sí | Admin del bot (además del permiso Administrator) |
| challonge_logs | CHANNEL | Sí | Logs de bracket y scores |
| transcript_logs | CHANNEL | Sí | Archivo de transcripts |
| bot_logs | CHANNEL | Sí | Logs generales |
| thumbnail_channel | CHANNEL | Sí | Miniaturas de schedule |

**Relación:** Prerrequisito de casi toda mutación auditable. Complementa `/staff config` (no pisa roles de staff). Audita.

## `/settings edit`

**Para qué:** Cambiar un canal o el rol admin sin reescribir el resto.

| Campo | Tipo | Obligatorio |
|---|---|---|
| admin_role | ROLE | No |
| challonge_logs | CHANNEL | No |
| transcript_logs | CHANNEL | No |
| bot_logs | CHANNEL | No |
| thumbnail_channel | CHANNEL | No |

Al menos uno. Requiere setup previo. Audita.

## `/settings show`

**Para qué:** Ver si roles/canales siguen existiendo. No cambia nada. No audita.
