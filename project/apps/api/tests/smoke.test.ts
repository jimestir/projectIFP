import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

const app = createApp();

// ── Health ────────────────────────────────────────────────

describe("GET /api/health", () => {
  it("returns status ok with database up", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.database).toBe("up");
    expect(res.body.service).toBe("api");
    expect(res.body.timestamp).toBeDefined();
  });
});

// ── Auth ──────────────────────────────────────────────────

describe("POST /api/auth", () => {
  const email = `smoke_${Date.now()}@test.local`;
  const password = "SmokeTest123!";
  let token: string;

  it("register creates a new client user", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email, password, name: "Smoke Tester", role: "CLIENT" });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.role).toBe("CLIENT");
    token = res.body.token;
  });

  it("register rejects duplicate email", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email, password, name: "Dup", role: "CLIENT" });
    expect(res.status).toBe(409);
  });

  it("login with correct credentials returns token", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(email);
  });

  it("login with wrong password returns 401", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "WrongPass123!" });
    expect(res.status).toBe(401);
  });

  it("login with invalid body returns 400", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "bad" });
    expect(res.status).toBe(400);
  });
});

// ── Pharmacies ────────────────────────────────────────────

describe("GET /api/pharmacies", () => {
  it("returns list of pharmacies", async () => {
    const res = await request(app).get("/api/pharmacies");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty("id");
    expect(res.body[0]).toHaveProperty("name");
    expect(res.body[0]).toHaveProperty("address");
  });

  it("filters by cp", async () => {
    const res = await request(app).get("/api/pharmacies?cp=28013");
    expect(res.status).toBe(200);
    res.body.forEach((p: { cp: string }) => expect(p.cp).toBe("28013"));
  });

  it("returns pharmacy by id", async () => {
    const list = await request(app).get("/api/pharmacies");
    const id = list.body[0].id;
    const res = await request(app).get(`/api/pharmacies/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
  });

  it("returns 404 for non-existent id", async () => {
    const res = await request(app).get(
      "/api/pharmacies/00000000-0000-0000-0000-000000000000",
    );
    expect(res.status).toBe(404);
  });
});

// ── Products ──────────────────────────────────────────────

describe("GET /api/products", () => {
  it("returns list of products", async () => {
    const res = await request(app).get("/api/products");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty("id");
    expect(res.body[0]).toHaveProperty("name");
  });

  it("filters by q", async () => {
    const res = await request(app).get("/api/products?q=paracetamol");
    expect(res.status).toBe(200);
    res.body.forEach((p: { name: string }) =>
      expect(p.name.toLowerCase()).toContain("paracetamol"),
    );
  });
});

// ── Search ────────────────────────────────────────────────

describe("GET /api/search", () => {
  it("returns search results with product and pharmacy data", async () => {
    const res = await request(app).get("/api/search");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    const row = res.body[0];
    expect(row).toHaveProperty("productId");
    expect(row).toHaveProperty("productName");
    expect(row).toHaveProperty("pharmacyId");
    expect(row).toHaveProperty("pharmacyName");
    expect(row).toHaveProperty("stock");
    expect(row).toHaveProperty("price");
  });

  it("filters by q and cp", async () => {
    const res = await request(app).get("/api/search?q=vitamina&cp=28013");
    expect(res.status).toBe(200);
    res.body.forEach((r: { cp: string }) => expect(r.cp).toBe("28013"));
  });
});

// ── Protected routes ──────────────────────────────────────

describe("Protected routes", () => {
  it("POST /api/pharmacies without token returns 401", async () => {
    const res = await request(app)
      .post("/api/pharmacies")
      .send({ name: "X", address: "Y", cp: "28000" });
    expect(res.status).toBe(401);
  });

  it("GET /api/inventory without token returns 401", async () => {
    const res = await request(app).get("/api/inventory");
    expect(res.status).toBe(401);
  });

  it("POST /api/reservations without token returns 401", async () => {
    const res = await request(app)
      .post("/api/reservations")
      .send({ pharmacyId: "x", productId: "y", quantity: 1 });
    expect(res.status).toBe(401);
  });

  it("GET /api/events/pharmacy without token returns 401", async () => {
    const res = await request(app).get("/api/events/pharmacy");
    expect(res.status).toBe(401);
  });
});

// ── Roles ─────────────────────────────────────────────────

describe("Role enforcement", () => {
  let clientToken: string;
  let adminToken: string;

  it("login as CLIENT", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "cliente@demo.local", password: "Password123!" });
    expect(res.status).toBe(200);
    clientToken = res.body.token;
  });

  it("login as ADMIN", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@stockpymes.local", password: "Password123!" });
    expect(res.status).toBe(200);
    adminToken = res.body.token;
  });

  it("CLIENT cannot create pharmacy", async () => {
    const res = await request(app)
      .post("/api/pharmacies")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({ name: "X", address: "Y", cp: "28000" });
    expect(res.status).toBe(403);
  });

  it("CLIENT cannot access inventory", async () => {
    const res = await request(app)
      .get("/api/inventory")
      .set("Authorization", `Bearer ${clientToken}`);
    expect(res.status).toBe(403);
  });

  it("ADMIN can create pharmacy", async () => {
    const res = await request(app)
      .post("/api/pharmacies")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Smoke Farmacia",
        address: "Calle Smoke 1",
        cp: "28999",
      });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Smoke Farmacia");
  });

  it("ADMIN can delete pharmacy", async () => {
    const list = await request(app).get("/api/pharmacies?cp=28999");
    const id = list.body[0]?.id;
    expect(id).toBeDefined();
    const res = await request(app)
      .delete(`/api/pharmacies/${id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
  });
});

// ── Reservations flow ─────────────────────────────────────

describe("Reservation flow", () => {
  let clientToken: string;
  let reservationId: string;
  let pharmacyId: string;
  let productId: string;
  let stockBefore: number;

  it("login as CLIENT", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "cliente@demo.local", password: "Password123!" });
    expect(res.status).toBe(200);
    clientToken = res.body.token;
  });

  it("find inventory with stock", async () => {
    const res = await request(app).get("/api/search?q=paracetamol");
    const row = res.body.find((r: { stock: number }) => r.stock >= 5);
    expect(row).toBeDefined();
    pharmacyId = row.pharmacyId;
    productId = row.productId;
    stockBefore = row.stock;
  });

  it("create reservation deducts stock", async () => {
    const res = await request(app)
      .post("/api/reservations")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({ pharmacyId, productId, quantity: 2 });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("CONFIRMED");
    expect(res.body.quantity).toBe(2);
    reservationId = res.body.id;

    const after = await request(app).get(`/api/search?q=paracetamol`);
    const updated = after.body.find(
      (r: { pharmacyId: string; productId: string }) =>
        r.pharmacyId === pharmacyId && r.productId === productId,
    );
    expect(updated.stock).toBe(stockBefore - 2);
  });

  it("list reservations includes the new one", async () => {
    const res = await request(app)
      .get("/api/reservations")
      .set("Authorization", `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    const found = res.body.find(
      (r: { id: string }) => r.id === reservationId,
    );
    expect(found).toBeDefined();
    expect(found.status).toBe("CONFIRMED");
  });

  it("cancel reservation restores stock", async () => {
    const res = await request(app)
      .patch(`/api/reservations/${reservationId}`)
      .set("Authorization", `Bearer ${clientToken}`)
      .send({ status: "CANCELLED" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("CANCELLED");

    const after = await request(app).get("/api/search?q=paracetamol");
    const updated = after.body.find(
      (r: { pharmacyId: string; productId: string }) =>
        r.pharmacyId === pharmacyId && r.productId === productId,
    );
    expect(updated.stock).toBe(stockBefore);
  });

  it("overstock reservation returns 409", async () => {
    const res = await request(app)
      .post("/api/reservations")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({ pharmacyId, productId, quantity: 99999 });
    expect(res.status).toBe(409);
  });
});
