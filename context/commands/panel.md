# Panel

Paneles informativos para el staff. Slash: comando `panel`. Solo **Admin** ([access.md](access.md)).

## `/panel tutorial`

**Para qué:** Enseñar al staff cómo funciona cada comando. El admin elige uno a uno los comandos y el bot publica una guía Components V2 por comando, en lenguaje sencillo y no técnico.

**Campos:** ninguno. No audita: las guías son material informativo, no cambian el servidor.

### Panel de selección

Respuesta **efímera** en Components V2 (acento de la familia Panel):

- `## Staff Guides` y una frase de qué hace.
- Menú **familia**: las secciones de `/bot help` (`bot/catalog.ts`), con su emoji y cuántos comandos tiene.
- Menú **comandos** de esa familia, multi-selección. Lo marcado se suma a la **cola**; cambiar de familia no la borra. Desmarcar un comando lo saca de la cola.
- `### Queue · N of 15`: los comandos en orden de selección, como menciones clicables con su familia. Ese es el orden de publicación.
- Máximo **15** guías por envío. Si se pasa, se quedan fuera las últimas y el panel lo avisa con `alert`.
- Botones **Send N guides** (verde, apagado sin cola), **Clear queue** y **Cancel** (rojo).
- La sesión vive en memoria y caduca a los **10 minutos** sin uso. Pulsar después muestra *Panel Expired*.

Al pulsar **Send**, el panel se borra y las guías se publican **una a una** en el canal donde se ejecutó el comando. Si alguna no se puede enviar, quien lo lanzó recibe un V2 efímero rojo con las que faltan. **Cancel** borra el panel sin publicar nada.

### Guía de un comando

Todas siguen el mismo molde. Si un bloque no aplica (comando sin opciones, sin relacionados), se omite; nunca cambia de sitio.

| Bloque | Formato | Contenido |
|---|---|---|
| Eyebrow | `-#` | `Staff Guide · Familia` |
| Título | `##` | Emoji de la familia + mención clicable del comando |
| Resumen | texto | El resumen de `/bot help` |
| Who can use it | `###` | El acceso de `/bot help` en negrita y, en `-#`, dónde se usa o qué necesita antes |
| How it works | `###` + lista numerada | 2–4 pasos: qué haces y qué hace el bot |
| Options | `###` + viñetas | Nombre en `code`, explicación y *Optional.* si no es obligatoria. Opciones relacionadas van juntas en una línea (`judge` · `recorder`); `image1` … `image10` se resumen |
| Keep in mind | `###` + viñetas | 2–4 avisos |
| Related | `###` | Comandos vecinos como menciones |
| Footer | `-#` | `Staff guide N of M` (posición en el envío) |

Cada familia tiene su propio color de acento y emoji (de `emojis.ts`): Bot rojo, Settings gris, Staff morado, Tournament dorado, Sheet verde, Room naranja, Schedule azul, Attendance turquesa, Ticket amarillo, Role rosa, Server blurple, Utility gris claro, Panel magenta.

### De dónde sale el texto

- Resumen y acceso: `bot/catalog.ts` (la misma fuente que `/bot help`).
- Nombres de opciones y si son obligatorias: el builder registrado del slash.
- Pasos, explicación de opciones, avisos y relacionados: `commands/panel/guides/<familia>.ts`.

Un comando nuevo en el catálogo necesita su guía en el mismo cambio; el test `panel-guides` falla si falta, si explica una opción que no existe o si menciona un comando desconocido.
