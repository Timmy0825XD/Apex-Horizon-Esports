# Tickets (ciclo del canal, no del bracket)

Organiser. Solo dentro de un canal que **es** ticket.

Reglas: [../domains/tickets.md](../domains/tickets.md).

## `/ticket close`

Sin campos. Solo dentro de un canal que es ticket. Persona de log: **Ticket System**.

En una **sala de partido**: silencia (los capitanes y los roles del torneo dejan de escribir; siguen pudiendo leer) y mueve a la categoría de cerrados, o a la de desborde si la primera está llena. Se puede reabrir.

En un **ticket de `/tournament validate`** (el topic guarda el canal de transcript elegido al crearlo, no el de las salas): avisa en efímero que el canal se borra en **5** segundos, genera el HTML, lo envía a ese canal y **borra** el canal. No se reabre. `reopen` y `delete` en ese canal no lo archivan; hay que usar `close`.

## `/ticket reopen`

Sin campos. Restaura el chat y devuelve el canal a la categoría abierta en la que nació, o a la siguiente con sitio. **Ticket System**.

## `/ticket delete`

Sin campos. Destruye el canal y olvida el vínculo partido↔canal. Ese partido puede recibir otro ticket después. **Ticket System**.

Relación: distinto de `/bracket upload` (ese cierra *y* reporta).
