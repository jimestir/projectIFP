import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PHARMACIES = [
  {
    name: "Farmacia Centro",
    description:
      "Farmacia de referencia en el centro de Madrid. Más de 50 años de servicio al cliente con un equipo de profesionales cualificados. Especializada en dermocosmética y productos de parafarmacia.",
    address: "Calle Mayor 12",
    cp: "28013",
    lat: 40.4168,
    lng: -3.7038,
    phone: "910000001",
    imageUrl: "https://images.unsplash.com/photo-1631549916768-4f8c1461e0ff?w=800&h=500&fit=crop",
  },
  {
    name: "Farmacia del Parque",
    description:
      "Tu farmacia de barrio junto al Retiro. Servicio de guardia 24h y atención personalizada. Amplio stock de medicamentos y productos de higiene personal.",
    address: "Av. de la Constitución 45",
    cp: "28014",
    lat: 40.415,
    lng: -3.7,
    phone: "910000002",
    imageUrl: "https://images.unsplash.com/photo-1585435557343-3b092031a831?w=800&h=500&fit=crop",
  },
  {
    name: "Farmacia Norte",
    description:
      "Farmacia moderna en Chamberí con servicio de farmacia online. Recogida en tienda en 2 horas. Especialistas en nutrición y suplementos deportivos.",
    address: "Calle de Bravo Murillo 120",
    cp: "28020",
    lat: 40.447,
    lng: -3.704,
    phone: "910000003",
    imageUrl: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=800&h=500&fit=crop",
  },
  {
    name: "Farmacia Sur",
    description:
      "Farmacia histórica en Embajadores, fundada en 1965. Servicio de vacunación y análisis clínicos. Atención en español, inglés y francés.",
    address: "Calle de Embajadores 88",
    cp: "28012",
    lat: 40.405,
    lng: -3.702,
    phone: "910000004",
    imageUrl: "https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?w=800&h=500&fit=crop",
  },
  {
    name: "Farmacia Salamanca",
    description:
      "Farmacia premium en el barrio de Salamanca. Dermocosmética de lujo y asesoramiento dermatológico personalizado. Parfumerie niche y productos exclusivos.",
    address: "Calle de Serrano 50",
    cp: "28001",
    lat: 40.43,
    lng: -3.687,
    phone: "910000005",
    imageUrl: "https://images.unsplash.com/photo-1576602976047-176eac5a83d0?w=800&h=500&fit=crop",
  },
] as const;

const CATEGORIES = [
  "Analgésicos",
  "Antihistamínicos",
  "Vitaminas",
  "Cuidado dermatológico",
  "Primeros auxilios",
  "Salud digestiva",
] as const;

const PRODUCTS: { name: string; description: string; category: (typeof CATEGORIES)[number] }[] = [
  { name: "Paracetamol 1g 20 comprimidos", description: "Analgésico y antipirético", category: "Analgésicos" },
  { name: "Ibuprofeno 600mg 20 comprimidos", description: "Antiinflamatorio no esteroideo", category: "Analgésicos" },
  { name: "Aspirina 500mg 20 comprimidos", description: "Ácido acetilsalicílico", category: "Analgésicos" },
  { name: "Nolotil 575mg 20 cápsulas", description: "Metamizol magnésico", category: "Analgésicos" },
  { name: "Loratadina 10mg 20 comprimidos", description: "Antihistamínico no sedante", category: "Antihistamínicos" },
  { name: "Cetirizina 10mg 20 comprimidos", description: "Antihistamínico", category: "Antihistamínicos" },
  { name: "Desloratadina 5mg 20 comprimidos", description: "Antihistamínico de 2ª generación", category: "Antihistamínicos" },
  { name: "Vitamina C 1000mg 30 comprimidos", description: "Ácido ascórbico", category: "Vitaminas" },
  { name: "Vitamina D3 2000 UI 60 cápsulas", description: "Colecalciferol", category: "Vitaminas" },
  { name: "Complejo B 30 comprimidos", description: "Vitaminas del grupo B", category: "Vitaminas" },
  { name: "Magnesio 300mg 60 comprimidos", description: "Suplemento de magnesio", category: "Vitaminas" },
  { name: "Crema hidratante facial 50ml", description: "Piel seca y sensible", category: "Cuidado dermatológico" },
  { name: "Protector solar SPF50 200ml", description: "Protección UVA/UVB", category: "Cuidado dermatológico" },
  { name: "Gel aloe vera 250ml", description: "Calmante cutáneo", category: "Cuidado dermatológico" },
  { name: "Pomada cicatrizante 30g", description: "Cuidado de heridas superficiales", category: "Cuidado dermatológico" },
  { name: "Tiritas surtidas 40 uds", description: "Apósitos adhesivos", category: "Primeros auxilios" },
  { name: "Suero fisiológico 30 monodosis", description: "Lavado nasal y ocular", category: "Primeros auxilios" },
  { name: "Antiséptico cutáneo 125ml", description: "Desinfectante de piel", category: "Primeros auxilios" },
  { name: "Termómetro digital", description: "Medición de temperatura corporal", category: "Primeros auxilios" },
  { name: "Omeprazol 20mg 28 cápsulas", description: "Inhibidor de la bomba de protones", category: "Salud digestiva" },
  { name: "Bicarbonato efervescente 20 sobres", description: "Antiácido", category: "Salud digestiva" },
  { name: "Probióticos 30 cápsulas", description: "Flora intestinal", category: "Salud digestiva" },
  { name: "Suero oral 5 sobres", description: "Rehidratación oral", category: "Salud digestiva" },
  { name: "Carbón activado 30 cápsulas", description: "Adsorbente intestinal", category: "Salud digestiva" },
  { name: "Paracetamol jarabe infantil 120ml", description: "Analgésico pediátrico", category: "Analgésicos" },
];

function priceFor(productIndex: number, pharmacyIndex: number): number {
  const base = 3.5 + (productIndex % 12) * 1.25 + (pharmacyIndex % 3) * 0.4;
  return Math.round(base * 100) / 100;
}

function stockFor(productIndex: number, pharmacyIndex: number): number {
  // Variedad: algunas filas sin stock para probar comparador
  if ((productIndex + pharmacyIndex) % 11 === 0) return 0;
  return 5 + ((productIndex * 3 + pharmacyIndex * 7) % 40);
}

async function main() {
  console.log("Cleaning existing data...");
  await prisma.reservation.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
  await prisma.pharmacy.deleteMany();

  console.log("Seeding pharmacies...");
  const pharmacies = [];
  for (const p of PHARMACIES) {
    pharmacies.push(
      await prisma.pharmacy.create({
        data: { ...p },
      }),
    );
  }

  console.log("Seeding categories...");
  const categoryByName = new Map<string, string>();
  for (const name of CATEGORIES) {
    const cat = await prisma.category.create({ data: { name } });
    categoryByName.set(name, cat.id);
  }

  console.log("Seeding products...");
  const products = [];
  for (const p of PRODUCTS) {
    products.push(
      await prisma.product.create({
        data: {
          name: p.name,
          description: p.description,
          categoryId: categoryByName.get(p.category),
        },
      }),
    );
  }

  console.log("Seeding inventory...");
  const inventoryRows = [];
  for (let pi = 0; pi < pharmacies.length; pi++) {
    for (let pr = 0; pr < products.length; pr++) {
      // No todas las farmacias tienen todos los productos
      if ((pr + pi) % 7 === 0) continue;
      inventoryRows.push({
        pharmacyId: pharmacies[pi].id,
        productId: products[pr].id,
        stock: stockFor(pr, pi),
        price: priceFor(pr, pi),
        version: 1,
      });
    }
  }
  await prisma.inventory.createMany({ data: inventoryRows });

  const passwordHash = await bcrypt.hash("Password123!", 10);

  console.log("Seeding users...");
  await prisma.user.create({
    data: {
      email: "admin@stockpymes.local",
      passwordHash,
      name: "Admin Sistema",
        role: "ADMIN",
    },
  });

  await prisma.user.create({
    data: {
      email: "cliente@demo.local",
      passwordHash,
      name: "Cliente Demo",
      phone: "600111222",
        role: "CLIENT",
    },
  });

  for (let i = 0; i < pharmacies.length; i++) {
    await prisma.user.create({
      data: {
        email: `farmacia${i + 1}@demo.local`,
        passwordHash,
        name: `Gestor ${pharmacies[i].name}`,
        phone: pharmacies[i].phone,
        role: "PHARMACY",
        pharmacyId: pharmacies[i].id,
      },
    });
  }

  const counts = {
    pharmacies: await prisma.pharmacy.count(),
    categories: await prisma.category.count(),
    products: await prisma.product.count(),
    inventory: await prisma.inventory.count(),
    users: await prisma.user.count(),
  };

  console.log("Seed OK:", counts);
  console.log("Demo password for all users: Password123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
