# Tickets (ciclo del canal, no del bracket)

Organiser. Solo dentro de un canal que **es** ticket.

Reglas: [../domains/tickets.md](../domains/tickets.md).

## `/ticket close`

Sin campos. Solo dentro de un canal que es ticket. Silencia (los capitanes y los roles del torneo dejan de escribir; siguen pudiendo leer) y mueve a la categoría de cerrados, o a la de desborde si la primera está llena. Se puede reabrir. Persona de log: **Ticket System**.

## `/ticket reopen`

Sin campos. Restaura el chat y devuelve el canal a la categoría abierta en la que nació, o a la siguiente con sitio. **Ticket System**.

## `/ticket delete`

Sin campos. Destruye el canal y olvida el vínculo partido↔canal. Ese partido puede recibir otro ticket después. **Ticket System**.

Relación: distinto de `/upload_score` (ese cierra *y* reporta).
