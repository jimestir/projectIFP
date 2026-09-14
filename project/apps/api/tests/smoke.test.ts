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

  it("filters by pharmacyId and sorts by price", async () => {
    const list = await request(app).get("/api/pharmacies");
    const pharmacyId = list.body[0]?.id;
    expect(pharmacyId).toBeDefined();

    const asc = await request(app).get(
      `/api/search?pharmacyId=${pharmacyId}&sort=price_asc`,
    );
    expect(asc.status).toBe(200);
    expect(asc.body.length).toBeGreaterThan(0);
    asc.body.forEach((r: { pharmacyId: string }) =>
      expect(r.pharmacyId).toBe(pharmacyId),
    );
    for (let i = 1; i < asc.body.length; i++) {
      expect(asc.body[i].price).toBeGreaterThanOrEqual(asc.body[i - 1].price);
    }

    const desc = await request(app).get(
      `/api/search?pharmacyId=${pharmacyId}&sort=price_desc`,
    );
    expect(desc.status).toBe(200);
    for (let i = 1; i < desc.body.length; i++) {
      expect(desc.body[i].price).toBeLessThanOrEqual(desc.body[i - 1].price);
    }
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

// ── Reservations flow (groups / cart checkout) ────────────

describe("Reservation group flow", () => {
  let clientToken: string;
  let adminToken: string;
  let groupId: string;
  let itemA: string;
  let itemB: string;
  let pharmacyId: string;
  let productA: string;
  let productB: string;
  let stockA: number;
  let stockB: number;

  it("login as CLIENT and ADMIN", async () => {
    const client = await request(app)
      .post("/api/auth/login")
      .send({ email: "cliente@demo.local", password: "Password123!" });
    expect(client.status).toBe(200);
    clientToken = client.body.token;

    const admin = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@stockpymes.local", password: "Password123!" });
    expect(admin.status).toBe(200);
    adminToken = admin.body.token;
  });

  it("find two products with stock in same pharmacy", async () => {
    const res = await request(app).get("/api/search?q=paracetamol");
    const rowA = res.body.find((r: { stock: number }) => r.stock >= 5);
    expect(rowA).toBeDefined();
    pharmacyId = rowA.pharmacyId;
    productA = rowA.productId;
    stockA = rowA.stock;

    const all = await request(app).get("/api/search");
    const rowB = all.body.find(
      (r: { pharmacyId: string; productId: string; stock: number }) =>
        r.pharmacyId === pharmacyId && r.productId !== productA && r.stock >= 3,
    );
    expect(rowB).toBeDefined();
    productB = rowB.productId;
    stockB = rowB.stock;
  });

  it("create group deducts stock for all items", async () => {
    const res = await request(app)
      .post("/api/reservations/groups")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({
        pharmacyId,
        items: [
          { productId: productA, quantity: 2 },
          { productId: productB, quantity: 1 },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("CONFIRMED");
    expect(res.body.items.length).toBe(2);
    expect(res.body.clientName).toBeDefined();
    expect(res.body.clientEmail).toBeDefined();
    groupId = res.body.id;
    itemA = res.body.items.find((i: { productId: string }) => i.productId === productA).id;
    itemB = res.body.items.find((i: { productId: string }) => i.productId === productB).id;

    const after = await request(app).get("/api/search");
    const a = after.body.find(
      (r: { pharmacyId: string; productId: string }) =>
        r.pharmacyId === pharmacyId && r.productId === productA,
    );
    const b = after.body.find(
      (r: { pharmacyId: string; productId: string }) =>
        r.pharmacyId === pharmacyId && r.productId === productB,
    );
    expect(a.stock).toBe(stockA - 2);
    expect(b.stock).toBe(stockB - 1);
  });

  it("list groups includes the new one with client data", async () => {
    const res = await request(app)
      .get("/api/reservations/groups")
      .set("Authorization", `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    const found = res.body.find((g: { id: string }) => g.id === groupId);
    expect(found).toBeDefined();
    expect(found.itemCount).toBe(2);
  });

  it("partial pickup marks selected PICKED_UP and rest NOT_PICKED_UP restoring stock", async () => {
    const res = await request(app)
      .post(`/api/reservations/groups/${groupId}/pickup`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ itemIds: [itemA] });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("PARTIALLY_PICKED_UP");
    const a = res.body.items.find((i: { id: string }) => i.id === itemA);
    const b = res.body.items.find((i: { id: string }) => i.id === itemB);
    expect(a.status).toBe("PICKED_UP");
    expect(b.status).toBe("NOT_PICKED_UP");

    const after = await request(app).get("/api/search");
    const stockBAfter = after.body.find(
      (r: { pharmacyId: string; productId: string }) =>
        r.pharmacyId === pharmacyId && r.productId === productB,
    );
    expect(stockBAfter.stock).toBe(stockB);
  });

  it("overstock group returns 409", async () => {
    const res = await request(app)
      .post("/api/reservations/groups")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({
        pharmacyId,
        items: [{ productId: productA, quantity: 99999 }],
      });
    expect(res.status).toBe(409);
  });
});
