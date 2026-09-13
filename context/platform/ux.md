# Idioma, forma y límites

- Las personas ven **embeds en inglés**, con emojis de propósito (éxito, error, alerta), no adorno. Detalle de menciones, markdown, `emojis.ts` y componentes: [discord-ui.md](discord-ui.md).
- Autocomplete de listas vivas: [autocomplete.md](autocomplete.md).
- Respuestas sensibles (tags para pegar en la hoja, Excel de nómina, degradaciones de pago) son **efímeras** o adjuntos, no spam al canal.
- El bot es **multi-servidor**: nada de un gremio se mezcla con otro. Un torneo no “ve” la hoja ni el bracket de otro.
- Solo **sirve** gremios listados en `ALLOWED_GUILDS` (IDs separados por coma). En cualquier otro servidor no procesa comandos y **sale** al entrar o al arrancar.
- El bot **falla en voz alta** hacia la persona (inglés, contexto) y en silencio hacia la operación de log.

## Relacionado

- Auditoría: [audit.md](audit.md)
- Actores: [../product/actors.md](../product/actors.md)
- Stack: [stack.md](stack.md)
