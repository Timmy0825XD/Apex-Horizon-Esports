# Context — fuente de verdad

Esta carpeta es la **única fuente de verdad** del producto: qué es el bot, reglas de negocio, actores, flujos y catálogo de comandos.

El bot habla con las personas en **inglés**. Estos documentos están en **español**.

El desarrollo de código y comandos sigue **el orden y las indicaciones del usuario**. Este context no autoriza a implementar nada por adelantado.

---

## Mapa

| Carpeta | Para qué |
|---|---|
| [product/](product/) | Qué es el bot, actores, ciclo de un partido |
| [domains/](domains/) | Reglas de cada dominio operativo |
| [platform/](platform/) | Stack, estructura, UI, autocomplete, workers, auditoría |
| [commands/](commands/) | Catálogo de slash commands e interacciones |

### Producto

| Archivo | Contenido |
|---|---|
| [product/overview.md](product/overview.md) | Definición de core, lo que no es, ticket, dos capas de config |
| [product/actors.md](product/actors.md) | Actores, alcance, recruit/fire |
| [product/match-lifecycle.md](product/match-lifecycle.md) | Ciclo del partido, tres actos de resultado, encadenado de sistemas |

### Dominios

| Archivo | Contenido |
|---|---|
| [domains/sheet.md](domains/sheet.md) | Google Sheet como verdad de participantes |
| [domains/bracket-rooms.md](domains/bracket-rooms.md) | Challonge, estados, auto-room, salas |
| [domains/schedules.md](domains/schedules.md) | Horarios, staff, T-10/T-0, results |
| [domains/attendance-payroll.md](domains/attendance-payroll.md) | Asistencia, links, cubetas, gold |
| [domains/tickets.md](domains/tickets.md) | Close/reopen/delete, transcript |
| [domains/moderation.md](domains/moderation.md) | Bans, roles masivos, utilidades de gobierno |

### Plataforma

| Archivo | Contenido |
|---|---|
| [platform/stack.md](platform/stack.md) | Node, TypeScript, npm, MongoDB, HiddenCloud |
| [platform/structure.md](platform/structure.md) | Agrupar por contexto de comando; SOLID/GRASP |
| [platform/discord-ui.md](platform/discord-ui.md) | Emojis, componentes, menciones, markdown |
| [platform/autocomplete.md](platform/autocomplete.md) | Campos vivos = autocomplete por nombre |
| [platform/workers.md](platform/workers.md) | Bucles de fondo |
| [platform/gateway.md](platform/gateway.md) | WebSocket, latencia, `/ping` |
| [platform/audit.md](platform/audit.md) | Webhooks, identidades, mapa de eventos |
| [platform/ux.md](platform/ux.md) | Idioma, forma, multi-servidor, fallos |

### Comandos

Índice: [commands/_index.md](commands/_index.md)

---

## Contrato de mantenimiento

Cuando se cree un comando nuevo, se cambie uno existente, o se toque el **core / reglas de negocio**, hay que actualizar **en el mismo cambio**:

1. El archivo de dominio o producto afectado.
2. El archivo de `commands/` de esa familia (si aplica).
3. [commands/_index.md](commands/_index.md) si nació, se renombró o se eliminó un comando.
4. [product/match-lifecycle.md](product/match-lifecycle.md) si cambia el encadenado entre sistemas.
5. [platform/audit.md](platform/audit.md) si nace un tipo de log o cambia qué se audita (mutación vs lectura).
6. [platform/structure.md](platform/structure.md) / [platform/discord-ui.md](platform/discord-ui.md) / [platform/autocomplete.md](platform/autocomplete.md) si cambia cómo se organiza el código o la UI.

No dejar reglas solo en el código. Si código y context discrepan, **actualizar context** para describir lo que el bot hace al ejecutarse.

`LOGIC.md` en la raíz es un puntero histórico. No se edita como fuente de verdad.
