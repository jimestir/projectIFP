# Modelo ER — Stock for PYMEs (Sprint 1)

Evolución del diagrama `image-12.png` con refuerzos de integridad y concurrencia.

## Entidades

| Tabla | Descripción |
|-------|-------------|
| `users` | Clientes, gestores de farmacia y admin. JWT por `role`. |
| `pharmacies` | Farmacias locales (dirección, CP, lat/lng para Fase 4). |
| `categories` | Categorías farmacéuticas del catálogo. |
| `products` | Catálogo global de productos. |
| `inventory` | Stock y precio por farmacia+producto (fuente de verdad). |
| `reservations` | Reservas ROPO con TTL y estados. |

## Relaciones

```
User N ──1 Pharmacy (opcional; solo role=PHARMACY)
Pharmacy 1 ──N Inventory N ──1 Product
Product N ──1 Category (opcional)
User 1 ──N Reservation
Pharmacy 1 ──N Reservation
Product 1 ──N Reservation
```

## Constraints críticos

| Constraint | Motivo |
|------------|--------|
| `inventory (pharmacy_id, product_id) UNIQUE` | Una fila de stock por par farmacia-producto |
| `CHECK (stock >= 0)` | Impide stock negativo a nivel BD |
| `CHECK (price >= 0)` | Precios no negativos |
| `CHECK (quantity > 0)` | Reservas con cantidad válida |
| `users.email UNIQUE` | Login inequívoco |
| FKs con `ON DELETE CASCADE/SET NULL` | Integridad referencial |

## Índices

- `pharmacies.cp` — filtro geográfico/CP del comparador
- `products.name` — búsqueda por nombre
- `reservations (status, expires_at)` — job TTL de expiración
- `reservations (pharmacy_id, status)` — panel PYME

## Concurrencia (Sprint 3)

Al crear reserva:

1. `BEGIN`
2. `SELECT … FROM inventory WHERE … FOR UPDATE`
3. Si `stock < quantity` → `ROLLBACK` / 409
4. `UPDATE inventory SET stock = stock - qty, version = version + 1`
5. `INSERT reservation` (`CONFIRMED`, `expires_at = now() + interval`)
6. `COMMIT`

Campo `version` habilita optimistic locking en actualizaciones de panel.

## Roles

| Role | Alcance |
|------|---------|
| `CLIENT` | Buscar, comparar, crear/cancelar sus reservas |
| `PHARMACY` | Mutar inventario de `pharmacyId` propio; ver reservas de su farmacia |
| `ADMIN` | Altas de farmacias y moderación |

## Diferencias vs diagrama UML original

- `Usuario` unificado con enum `UserRole` (no tablas separadas cliente/farmacia).
- `Inventory.version` y `Reservation.quantity/status/expiresAt` añadidos.
- Coordenadas `lat`/`lng` en farmacia (mapas Leaflet en Fase 4).
- Tabla `HealthCheck` de Sprint 0 eliminada.
