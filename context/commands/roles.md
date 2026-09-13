# Roles (Discord, no torneo)

Organiser. No persisten nada propio. Auditan excepto `list`.

Reglas: [../domains/moderation.md](../domains/moderation.md), [../product/actors.md](../product/actors.md).

## `/role user`

| Campo | Tipo | Obligatorio |
|---|---|---|
| target | USER | Sí |
| role | ROLE | Sí |

Toggle: si lo tiene, se lo quita; si no, se lo pone.

## `/role add all` / `/role remove all`

| Campo | Tipo | Obligatorio |
|---|---|---|
| role | ROLE | Sí |

Masivo. Omite quien ya está en el estado deseado.

## `/role list`

| Campo | Tipo | Obligatorio |
|---|---|---|
| role | ROLE | Sí |

Conteo humanos/bots; CSV si no cabe. No audita.
