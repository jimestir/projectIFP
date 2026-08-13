# Stock for PYMEs

Plataforma ROPO (*Research Online, Purchase Offline*) para digitalizar stock de farmacias locales, comparar precios y gestionar reservas.

**Equipo 7** — DAW Intermodular  
Stack: **Node.js + Express + Prisma + PostgreSQL** (API) · **React** (FE, Sprint 4+) · **Leaflet/OSM** (Fase 4)

## Estructura

```
.
├── apps/
│   └── api/                 # Backend Express + Prisma
├── packages/
│   └── shared/              # Tipos compartidos
├── docs/
│   └── openapi.yaml         # Contrato API v0
├── docker-compose.yml       # PostgreSQL 16
└── package.json             # npm workspaces
```

## Requisitos

- Node.js ≥ 20
- Docker Desktop
- npm ≥ 10

## Setup rápido (Sprint 0)

```bash
# 1. Variables de entorno
cp .env.example .env

# 2. Dependencias
npm install

# 3. Base de datos
npm run db:up

# 4. Cliente Prisma + migración inicial
cp .env apps/api/.env
npm run prisma:generate
npm run prisma:migrate -w @stock-for-pymes/api -- --name sprint0_health

# 5. API
npm run dev:api
```

Comprobar salud:

```bash
curl http://localhost:3000/api/health
```

Respuesta esperada:

```json
{ "status": "ok", "service": "api", "database": "up", "timestamp": "..." }
```

## Scripts útiles

| Comando | Descripción |
|---------|-------------|
| `npm run db:up` | Levanta PostgreSQL |
| `npm run db:down` | Para contenedores |
| `npm run dev:api` | API en modo watch |
| `npm run prisma:studio` | UI de Prisma |

## Fases (Gantt)

| Fase | Tareas | Estado |
|------|--------|--------|
| 1 | A Análisis + B BD | Sprint 0 ✅ · Sprint 1 (schema dominio) |
| 2 | D Backend API | Pendiente |
| 3 | C/E Frontend React | Tras API |
| 4 | F Geo + reservas UI | Leaflet/OSM |
| 5 | G/H QA + despliegue | Linux + Nginx |

## Documentación

- Especificación: `DAW_GRUPO7.md`
- OpenAPI: `docs/openapi.yaml`
- Gantt: `diagramGantt.gan`
