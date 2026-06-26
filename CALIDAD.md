# CALIDAD.md — Estrategia de Calidad

## Estrategia general

Nuestra estrategia de calidad se basa en tres capas que se complementan entre sí:

1. **Análisis estático** (ESLint): detecta errores antes de que el código se ejecute, sin obligar al desarrollador a corregirlos en el acto.
2. **Tests automáticos** (Vitest + Playwright): verifican que la lógica de la aplicación funcione correctamente, tanto a nivel de funciones individuales como del flujo completo del usuario.
3. **Pipeline de CI/CD** (GitHub Actions): garantiza que ningún código llegue a producción sin haber pasado por los dos puntos anteriores.

El principio que guía cada decisión es: **detectar los problemas lo antes posible, al menor costo posible**. Un error de ESLint detectado antes de commitear es infinitamente más barato que un bug en producción.

---

## Herramientas seleccionadas

### ESLint

ESLint es un analizador estático de código: lee el código fuente sin ejecutarlo y detecta errores de sintaxis, variables no usadas, imports incorrectos y malas prácticas.

**Por qué ESLint y no Husky:**
Husky es un sistema de git hooks que bloquea el commit si el lint no pasa, obligando al desarrollador a corregir antes de poder continuar. Decidimos no usarlo porque queremos que los desarrolladores tengan autonomía para decidir si un "error" de estilo es realmente un problema en su contexto. ESLint avisa y sugiere; el desarrollador decide. Husky obliga. En equipos pequeños como el nuestro, preferimos la comunicación directa a las barreras automáticas.

ESLint ya estaba configurado en el proyecto con reglas de React Hooks y React Refresh. Lo que agregamos fue incorporarlo como primer paso del pipeline de CI, para que un error de lint bloquee el deploy automáticamente.

### Vitest

Vitest es el framework de tests unitarios que elegimos para verificar la lógica de las funciones utilitarias.

**Por qué Vitest y no Jest:**
Nuestro proyecto usa Vite como herramienta de construcción, que trabaja con el sistema de módulos moderno de JavaScript (ESM — `import/export`). Jest fue creado cuando JavaScript usaba otro sistema (`require/module.exports`) y para funcionar con proyectos Vite necesita un transformador adicional llamado Babel. Eso agrega complejidad de configuración y hace los tests más lentos. Vitest fue diseñado específicamente para Vite: usa el mismo sistema de módulos, no necesita configuración extra, y los tests corren significativamente más rápido. Elegimos la herramienta que mejor se integra con el stack que ya teníamos.

### Playwright

Playwright es el framework de tests E2E (End to End) que simula a un usuario real usando la aplicación en un navegador.

**Por qué Playwright y no Cypress:**
Cypress tiene una interfaz visual muy cómoda para debuggear tests de forma interactiva, pero su arquitectura está pensada para desarrollo local. En un pipeline de CI que corre en servidores sin interfaz gráfica, Playwright tiene ventajas concretas: es más rápido en modo headless, soporta interceptar y mockear llamadas de red con `page.route()` (fundamental para nuestros mocks de Firebase), y no requiere un servidor separado para correr. Cypress fue descartado porque es más pesado en entornos de CI automatizado.

---

## Tests desarrollados

### Tests unitarios (`src/utils/gameUtils.test.js`)

Todos los tests unitarios prueban funciones puras en `src/utils/gameUtils.js` — funciones que reciben datos y devuelven un resultado sin efectos secundarios ni dependencias externas.

| Test | Función | Qué valida |
|------|---------|-----------|
| `sanitizeNickname` — elimina @ y espacios | `sanitizeNickname` | Que `"  @meli  "` se transforma en `"meli"` |
| `sanitizeNickname` — sin @ ni espacios | `sanitizeNickname` | Que `"maia"` se mantiene igual |
| `validateGameForm` — nombre vacío | `validateGameForm` | Que devuelve `valid: false` con un mensaje de error |
| `validateGameForm` — descripción vacía | `validateGameForm` | Que devuelve `valid: false` con un mensaje de error |
| `validateGameForm` — datos válidos | `validateGameForm` | Que devuelve `valid: true` y `error: null` |
| `buildInitialPlayers` — cantidad correcta | `buildInitialPlayers` | Que crea exactamente N jugadores |
| `buildInitialPlayers` — primer jugador con @ | `buildInitialPlayers` | Que el jugador 0 tiene el nickname del usuario actual |
| `buildInitialPlayers` — resto vacíos | `buildInitialPlayers` | Que los jugadores siguientes tienen nombre vacío y 0 puntos |
| `extractSharedUids` — incluye al dueño | `extractSharedUids` | Que el UID del creador siempre está en la lista |
| `extractSharedUids` — resuelve @menciones | `extractSharedUids` | Que `@maia` se convierte en el UID de maia |
| `extractSharedUids` — ignora desconocidos | `extractSharedUids` | Que una @mención sin amigo coincidente no agrega nada |
| `buildFriendList` — usuario remitente | `buildFriendList` | Que se incluyen amigos donde el usuario envió la solicitud |
| `buildFriendList` — usuario receptor | `buildFriendList` | Que se incluyen amigos donde el usuario recibió la solicitud |
| `formatElapsedTime` — 0 segundos | `formatElapsedTime` | Que devuelve `"00:00"` |
| `formatElapsedTime` — 65 segundos | `formatElapsedTime` | Que devuelve `"01:05"` |
| `formatElapsedTime` — 3600 segundos | `formatElapsedTime` | Que devuelve `"60:00"` |
| `formatMatchDate` — sin timestamp | `formatMatchDate` | Que devuelve `{ date: null, time: null }` |
| `formatMatchDate` — con timestamp válido | `formatMatchDate` | Que devuelve strings no vacíos de fecha y hora |
| `getElapsedSeconds` — sin timestamp | `getElapsedSeconds` | Que devuelve 0 |
| `getElapsedSeconds` — timestamp reciente | `getElapsedSeconds` | Que devuelve segundos positivos coherentes con el tiempo pasado |

**Total: 20 tests unitarios.**

### Test E2E (`e2e/main-flow.spec.js`)

| Test | Qué valida |
|------|-----------|
| Formulario de login visible al abrir la app | Que los inputs de email y contraseña están presentes al cargar la app |
| Error con campos vacíos | Que el sistema no procede si no se completaron los campos |
| Login exitoso redirige al panel | Que tras un login válido (mockeado) el formulario de login desaparece |

Las llamadas a Firebase Auth y Firestore son interceptadas con `page.route()` para que los tests no dependan de conexión a internet ni de credenciales reales.

---

## Casos de uso críticos priorizados

Priorizamos los flujos que, si fallan, hacen que la aplicación sea completamente inutilizable:

1. **Autenticación** — si el login o registro fallan, ningún usuario puede acceder a nada. Es el cuello de botella de toda la app.
2. **Creación y validación de partidas** — la razón de existir de la app es registrar partidas. Si los formularios aceptan datos inválidos o los rechazan incorrectamente, la funcionalidad central está rota.
3. **Cronómetro y conteo de tiempo** — función nueva que requiere lógica de transformación de datos que es fácilmente testeable y crítica para la experiencia de usuario durante una partida.
4. **Resolución de @menciones** — si las @menciones de amigos no se resuelven correctamente a UIDs, las partidas compartidas no funcionan.

Los flujos de menor prioridad para tests (como editar el perfil o ver el historial) no se cubrieron en esta iteración porque dependen de estado de Firebase que es complejo de mockear y su impacto en caso de falla es menor.

---

## Pipeline de CI/CD

El pipeline se define en `.github/workflows/ci-cd.yml` y se dispara en cada push o Pull Request hacia `main`.

### Pasos y decisiones de diseño

```
lint → test:coverage → build → deploy
```

**1. Lint (`npm run lint`)**
ESLint analiza todo el código. Si hay errores, el pipeline falla aquí y no continúa. Decidimos ponerlo primero porque es el paso más rápido (~5 segundos) y un error de sintaxis hace que los tests fallen de formas confusas.

**2. Tests con cobertura (`npm run test:coverage`)**
Vitest corre los 20 tests unitarios y genera un reporte de cobertura. El threshold mínimo es 60% en funciones, branches y líneas del directorio `src/utils/`. Si la cobertura cae por debajo, el paso falla. Solo corre si el lint pasó.

**3. Build (`npm run build`)**
Vite compila la aplicación en archivos estáticos listos para producción. Verifica que no haya errores de imports, módulos faltantes o configuraciones inválidas. Los archivos generados se guardan como artefacto del pipeline. Solo corre si los tests pasaron.

**4. Deploy a Vercel (`npx vercel --prod`)**
Solo se ejecuta en push directo a `main` (no en Pull Requests). Esto significa que un PR que falla los tests nunca llega a producción, pero tampoco se hace un deploy por cada PR que se revisa. Las credenciales de Firebase y Vercel se leen desde GitHub Secrets, nunca del código fuente.

**¿Qué pasa si falla el lint?**
Los pasos de test, build y deploy no corren. GitHub marca el PR como fallido y no se puede mergear (si se configura branch protection en `main`).

---

## Limitaciones y deuda técnica

- **Los tests E2E mockean Firebase** en lugar de usar un proyecto de Firebase de prueba separado. Esto significa que testean el comportamiento de la UI pero no la integración real con la base de datos. Con más tiempo, crearíamos un proyecto Firebase de testing dedicado con datos de prueba.

- **No hay tests de integración** para las funciones de `firestoreService.js` y `authService.js`. Esas funciones llaman directamente a Firebase y son difíciles de testear sin mockear el SDK completo. Es deuda técnica consciente.

- **La cobertura se mide solo en `src/utils/`**. El resto del código (`App.jsx`, servicios de Firebase) queda fuera del threshold porque requeriría tests de componentes React con mocks de Firebase, lo cual excedía el alcance de este TP.

- **El deploy a Vercel requiere configuración manual** de secrets en GitHub. Si se agregan nuevas variables de entorno de Firebase, hay que agregarlas tanto al `.env.local` local como a los secrets del repo.
