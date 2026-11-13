# Auditoría de acciones del bot

Estos logs son **acciones que el bot ejecuta en runtime** (comandos, botones, workers). **No** son logs de git, PRs ni de lo que cambiamos en el repositorio.

Detalle de canales, identidades y eventos: [context/platform/audit.md](context/platform/audit.md).

## Qué se loguea

| Acción | ¿Audita? |
|---|---|
| Crear / registrar | Sí |
| Modificar | Sí |
| Borrar | Sí |
| Leer / listar / visualizar / extraer | No |
| Intento bloqueado por parecer trampa (`Early claim blocked`, `Fast claim blocked`) | Sí, en morado |

Se publica **después de que la mutación tenga éxito**. Fallar el log no deshace la acción.

## Cómo

Publicar por **webhook de Discord** en el canal de logs configurado, como **Components V2** (`publishAudit` en `src/lib/audit.ts`). El **nombre visible del webhook es el módulo** que genera el log (el tipo de log), no un rótulo genérico. El **título de la tarjeta es la acción** y no repite ese nombre. El color dice si se creó, modificó o borró algo.

Módulos: `Server Config`, `Staff`, `Moderation`, `Tournaments`, `Rooms`, `Schedules`, `Attendance`, `Utility`, `Ticket System`, `Challonge Logs`, `Score Upload`.

Si nace un tipo de log nuevo, actualiza `context/platform/audit.md` en el mismo cambio.

## Al implementar

```text
❌ /settings setup sin webhook de auditoría
❌ /bot ping o /tournament list escribiendo en bot_logs
❌ mandar un log de commit/PR al canal de Discord
✅ /ticket delete → webhook título "Ticket System"
✅ /upload_score → webhook título "Score Upload"
✅ /staff config view → sin log
```
