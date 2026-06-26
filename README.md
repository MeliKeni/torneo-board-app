# Torneo Board App

Aplicación web para registrar partidas de juegos de mesa, gestionar torneos y trackear puntajes entre amigos.

## URL de producción

>(https://torneo-board-app.vercel.app/)

---

## Tecnologías

- React 19 + Vite
- Firebase (Authentication + Firestore)
- Vitest (tests unitarios)
- Playwright (tests E2E)
- GitHub Actions (CI/CD)

---

## Cómo correr el proyecto localmente

### 1. Clonar el repositorio

```bash
git clone https://github.com/MeliKeni/torneo-board-app.git
cd torneo-board-app
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Copiá el archivo de ejemplo y completá con tus credenciales de Firebase:

```bash
cp .env.example .env.local
```

Editá `.env.local` con los valores reales de tu proyecto Firebase.

### 4. Correr en desarrollo

```bash
npm run dev
```

---

## Scripts disponibles

| Comando | Descripción |
|---------|------------|
| `npm run dev` | Servidor de desarrollo local |
| `npm run build` | Compilar para producción |
| `npm run preview` | Vista previa del build |
| `npm run lint` | Analizar código con ESLint |
| `npm test` | Correr tests unitarios |
| `npm run test:coverage` | Tests con reporte de cobertura |
| `npm run e2e` | Correr tests E2E con Playwright |

---

## Convención de branches

| Prefijo | Uso | Ejemplo |
|---------|-----|---------|
| `feature/` | Nueva funcionalidad | `feature/sistema-amigos` |
| `fix/` | Corrección de bug | `fix/login-error` |
| `develop` | Rama de integración | — |
| `main` | Producción | — |

**Regla:** ningún cambio se mergea directo a `main` ni a `develop`. Todo pasa por un Pull Request con revisión del otro integrante.

---

## Pipeline CI/CD

Cada push o PR a `main` dispara automáticamente:

```
lint → tests → build → deploy (solo en push a main)
```

El deploy a Vercel solo ocurre si los tres pasos anteriores pasan. Ver `.github/workflows/ci-cd.yml` para el detalle.

Para que el pipeline funcione, el repositorio necesita los siguientes **GitHub Secrets** configurados:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
