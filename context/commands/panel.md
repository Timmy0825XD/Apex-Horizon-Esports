# Panel

Paneles informativos. Slash: comando `panel`. `/panel tutorial` es solo **Admin**; `/panel tournament …` es **Admin u Organiser** ([access.md](access.md)). Ninguno audita: publican información, no cambian datos del bot.

## `/panel tournament rules` · `bracket` · `deadline`

**Para qué:** Publicar en el canal donde se ejecuta un panel informativo de un torneo. Es la respuesta pública al comando, en Components V2 con el acento dorado de la familia Tournament. Arriba va el nombre del torneo en `-#`; abajo, `-# Posted by` con mención (sin ping) y hora.

`tournament` es obligatorio en los tres: autocomplete con los torneos del servidor.

| Subcomando | Campos | Panel |
|---|---|---|
| `rules` | `spanish`, `english`: enlaces `https://` obligatorios | `## Tournament Rules` (emoji `rules`, icono del servidor de thumbnail si tiene). Texto en inglés con la traducción al español en `-#`. Botones de enlace **Reglas en español** y **English rules** con su bandera |
| `bracket` | `shuffle`: enlace de YouTube (`youtube.com` o `youtu.be`) obligatorio | `## Bracket` (emoji `torneo`, emoji `challonge` de thumbnail). Sección **Challonge bracket** con el botón **Open bracket** y sección **Team shuffle evidence** con **Watch on YouTube**. El enlace del bracket no se escribe: el bot lo pide a Challonge (`full_challonge_url`) con el ID y la API key guardados del torneo. Si Challonge no responde, no publica y lo dice en efímero |
| `deadline` | `role`: rol de participantes | Abre un formulario **Rounds** (una ronda por línea, `10/10 - 14/10`). Publica la mención del rol, que **sí hace ping**, y debajo `## Round Deadlines` (emoji `calendar`), una frase para que estén atentos a las fechas y `**Round N** · dd/mm → dd/mm` por línea |

### Fechas de `deadline`

- Acepta `dd/mm - dd/mm`, con `-`, `–`, `—`, `→` o `to`, y un `Round N:` delante opcional. Se puede escribir el año (`dd/mm/yyyy`).
- Sin año, la primera fecha toma el año actual. Si una fecha retrocede meses respecto a la anterior (diciembre → enero), pasa al año siguiente.
- Las rondas van en orden y no se solapan: cada una empieza después de que termina la anterior, y termina el mismo día o después de empezar. Fechas que no existen, formatos que no se entienden o más de **25** rondas se rechazan en efímero y no se publica nada.
- Si el rol no es mencionable y el bot no tiene **Mention All Roles** en el canal, el panel sale igual y quien lo lanzó recibe un aviso efímero de que no hubo notificación.

Los paneles no se guardan: para cambiar uno, se vuelve a lanzar el comando y se borra el anterior.

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
