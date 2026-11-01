# Git Flow

No trabajes directo en `main` ni `develop` (salvo el commit inicial del repo).

## Antes de tocar archivos

1. Clasifica el trabajo (tabla de ramas).
2. Ejecuta `git branch --show-current` y `git status`.
3. Si no hay repo: no edites código de producto; solo indica el bootstrap.
4. Si la rama no coincide: créala o cámbiate. Origen:
   - `hotfix/*` sale de `main`
   - `release/*` sale de `develop`
   - el resto sale de `develop`
5. Si sigues en `main`, `develop` o una rama de otro tema: **detente**. Cero edits.

Nombre: `tipo/nombre-descriptivo` en kebab-case, corto, en español o inglés consistente.

## Ramas

| Rama | Sale de | Vuelve a | Uso |
|---|---|---|---|
| `main` | — | — | Producción. Nunca trabajo directo. |
| `develop` | — | — | Integración. Nunca trabajo directo. |
| `feature/*` | develop | develop | Funcionalidad nueva |
| `bugfix/*` | develop | develop | Error antes de producción |
| `docs/*` | develop | develop | Solo documentación |
| `refactor/*` | develop | develop | Reestructurar sin cambiar comportamiento |
| `test/*` | develop | develop | Tests sin cambio funcional |
| `perf/*` | develop | develop | Rendimiento |
| `style/*` | develop | develop | Formato, sin lógica |
| `chore/*` | develop | develop | Mantenimiento (no código de producción) |
| `ci/*` | develop | develop | Integración continua |
| `build/*` | develop | develop | Build o dependencias |
| `release/*` | develop | main **y** develop | Preparar versión |
| `hotfix/*` | main | main **y** develop | Error urgente en producción |

Flujo normal: rama de soporte → merge a `develop` → `release/*` cuando toque → merge a `main` (tag) y a `develop`. Hotfix: desde `main`, merge a `main` y a `develop`.

## Trigger `_GIT`

Por defecto: **no** ejecutes ni muestres add, commit, push, PR ni el bloque de limpieza. El trabajo termina en la rama de soporte. No pegues comandos de git al final de cada respuesta.

Solo cuando el usuario escriba `_GIT` (token exacto, en cualquier mensaje) o pida explícitamente encargarse de git / hacer el PR:

1. Ejecuta tú, en este orden: `git add` → `git commit` → `git push -u origin HEAD` → `gh pr create`.
2. Responde con el enlace del PR y los commits creados. No pegues el bloque de limpieza: la limpieza la haces tú (ver abajo).

## Limpieza tras el merge (la hace Claude)

Cada vez que vayas a cambiar de rama, o el usuario diga que el PR está listo, comprueba con `gh pr view <rama> --json state` si el PR de la rama actual ya está **MERGED**. Si lo está, y `git status` está limpio, ejecuta tú:

```
git checkout develop
git pull origin develop
git branch -d <rama>
git push origin --delete <rama>
git fetch --prune
```

- Usa `git branch -d` (nunca `-D`). Si falla porque la rama no está mergeada, detente y avisa.
- Si la rama remota ya no existe (GitHub la borró al mergear), no es error: sigue.
- Si el PR no está mergeado o hay cambios sin commit, no borres nada; avisa.
- `hotfix/*` o `release/*`: haz `checkout`/`pull` de `main` y de `develop` antes de borrar.
- Después crea la rama nueva desde `develop` (o `main` para `hotfix/*`).

## Reglas del commit y del PR

- Sustituye `<rama>` por el nombre real (`feature/auth-api`, etc.).
- Base del PR: `develop`. `hotfix/*` y merge de `release/*` a producción: `--base main` (y luego también merge a `develop`).
- Primera línea del commit 50–72 caracteres, imperativo, sin punto.
- Cuerpo solo si hace falta el **por qué** (1 línea).
- Relación rama ↔ commit: `feature`→`feat`, `bugfix`/`hotfix`→`fix`, y el resto el mismo tipo que el prefijo.
- Tag al mergear `release`→`main`: `fix` patch, `feat` minor, `BREAKING CHANGE` major.
- Sin cambios: no crees commit vacío ni PR.

## Commits

`tipo(alcance opcional): descripcion` — cuerpo y footer opcionales.

Tipos: `feat` `fix` `docs` `style` `refactor` `perf` `test` `chore` `ci` `build`.

Breaking: `tipo!:` o `tipo(alcance)!:` y footer `BREAKING CHANGE`.
