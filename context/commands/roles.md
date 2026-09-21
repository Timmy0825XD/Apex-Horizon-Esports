# Roles (Discord, no torneo)

Organiser (`manager_role` o Administrator). No persisten nada propio. Respuestas en **Components V2**. Auditan excepto `list`.

Jerarquía Discord siempre gana: no se toca `@everyone`, un rol de integración, ni un rol igual o por encima del actor o del bot. En `/role user` tampoco se gestiona a alguien con rol igual o superior al propio. Ver [../domains/moderation.md](../domains/moderation.md), [../product/actors.md](../product/actors.md).

## `/role user`

**Para qué:** Toggle de un rol en un miembro. Si lo tiene, se lo quita; si no, se lo pone.

| Campo | Tipo | Obligatorio |
|---|---|---|
| target | USER | Sí |
| role | ROLE | Sí |

El objetivo tiene que estar en el servidor. El bot necesita **Manage Roles**. Audita.

## `/role add all` / `/role remove all`

**Para qué:** Asignar o quitar un rol en masa. Omite quien ya está en el estado deseado. Si Discord rechaza a alguien, ese fallo va en un bloque aparte (copy distinto del de éxito y del de “ya estaba”).

| Campo | Tipo | Obligatorio |
|---|---|---|
| role | ROLE | Sí |

Organiser. El bot necesita **Manage Roles**. Audita solo si al menos un miembro cambió.

## `/role list`

**Para qué:** Conteo de humanos y bots que tienen el rol. Si las menciones caben en el panel, se listan; si no, adjunta un CSV (`ID`, `Kind`) con File V2. Respuesta efímera. No lista `@everyone`.

| Campo | Tipo | Obligatorio |
|---|---|---|
| role | ROLE | Sí |

No audita.
