# Guía de Deploy — Stock for PYMEs

## Arquitectura

```
Frontend (Vercel)  →  Backend (Render)  →  PostgreSQL (Render)
     HTTPS              HTTPS                 interno
```

## 1. Backend + PostgreSQL (Render)

### Pasos

1. Ir a [render.com](https://render.com) → Sign up with GitHub
2. **New** → **Blueprint** → Seleccionar repo `jimestir/projectIFP`, rama `feature-first-version`
3. Render detecta `render.yaml` y crea:
   - PostgreSQL (`stock-for-pymes-db`)
   - Web Service (`stock-for-pymes-api`)
4. En el Web Service → **Environment** → Añadir:
   ```
   CORS_ORIGIN = https://<tu-app>.vercel.app
   ```
5. **Manual Deploy** → Deploy latest commit

### Variables de entorno (Render)

| Variable | Valor | Notas |
|----------|-------|-------|
| `DATABASE_URL` | Auto (desde DB) | Render la genera |
| `JWT_SECRET` | Auto | Render genera un secreto |
| `JWT_EXPIRES_IN` | `8h` | |
| `API_PORT` | `3000` | |
| `API_HOST` | `0.0.0.0` | |
| `NODE_ENV` | `production` | |
| `CORS_ORIGIN` | `https://<app>.vercel.app` | URL del frontend |

### Verificar

```bash
curl https://stock-for-pymes-api.onrender.com/api/health
```

Respuesta esperada:
```json
{"status":"ok","service":"api","database":"up","timestamp":"..."}
```

---

## 2. Frontend (Vercel)

### Pasos

1. Ir a [vercel.com](https://vercel.com) → Sign up with GitHub
2. **Add New Project** → Seleccionar repo `jimestir/projectIFP`
3. Configurar:
   - **Framework Preset**: Vite
   - **Root Directory**: `project/apps/web`
   - **Build Command**: `cd ../.. && npm run build:web`
   - **Output Directory**: `dist`
4. **Environment Variables** → Añadir:
   ```
   VITE_API_URL = https://stock-for-pymes-api.onrender.com
   ```
5. **Deploy**

### Variables de entorno (Vercel)

| Variable | Valor |
|----------|-------|
| `VITE_API_URL` | `https://stock-for-pymes-api.onrender.com` |

### Verificar

1. Abrir `https://<tu-app>.vercel.app`
2. Login con `cliente@demo.local` / `Password123!`
3. Buscar productos, comparar, reservar

---

## 3. Seed de datos (primera vez)

Después del deploy del backend, ejecutar el seed:

```bash
# Desde Render Shell o localmente con la DATABASE_URL de producción
npx tsx apps/api/prisma/seed.ts
```

O desde Render:
1. Web Service → **Shell**
2. Ejecutar: `npx tsx prisma/seed.ts`

---

## 4. URLs finales

| Servicio | URL |
|----------|-----|
| Frontend | `https://<tu-app>.vercel.app` |
| Backend | `https://stock-for-pymes-api.onrender.com` |
| Health | `https://stock-for-pymes-api.onrender.com/api/health` |
| Prisma Studio | Solo local (no exponer en producción) |

---

## 5. Problemas comunes

### CORS error
- Verificar que `CORS_ORIGIN` en Render coincide con la URL de Vercel
- Sin `/` al final

### Backend se "duerme" (Render free tier)
- La primera petición tarda ~30s
- Render duerme el servicio tras 15 min sin requests
- Solución: plan de pago o cron job para mantenerlo activo

### Migraciones no aplicadas
- El Dockerfile ejecuta `prisma migrate deploy` al arrancar
- Si falla, revisar logs en Render

### Seed no ejecutado
- Conectar a la DB desde Render Shell
- Ejecutar `npx tsx prisma/seed.ts`

---

## 6. Deploy manual (sin Render/Vercel)

Si prefieres deploy manual con Docker:

```bash
# Build y run API
docker compose -f docker-compose.prod.yml up -d

# Build frontend
npm run build:web

# Servir con nginx
# Copiar apps/web/dist a /var/www/html
```
