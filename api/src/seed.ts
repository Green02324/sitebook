import { prisma } from "./lib/prisma";
import { ensureAdminUser, ensureOwnerUser, ensureBootstrapUser } from "./lib/users";
import type { ProjectStatus } from "@prisma/client";

// Fixed sample account, unrelated to the real OWNER_EMAIL account — kept
// separate so the owner's own data always starts empty.
const DEMO_EMAIL = "demo.contractor@sitebook.local";

const CATEGORY_NAMES = ["Materials", "Labor", "Permits", "Subcontractor", "Miscellaneous"];

const CATEGORY_DESCRIPTIONS: Record<string, string[]> = {
  Materials: [
    "Lumber delivery",
    "Cabinet order",
    "Fixture purchase",
    "Flooring materials",
    "Hardware & fasteners",
    "Countertop slab",
    "Insulation",
    "Drywall order",
    "Roofing shingles",
    "Siding panels",
    "Window units",
    "Door & trim package",
  ],
  Labor: ["Framing crew", "Finish carpentry", "Demo crew", "Install crew - week 1", "Install crew - week 2", "Trim work", "Painting crew", "Cleanup crew"],
  Permits: ["Building permit fee", "Electrical permit", "Plumbing permit", "Inspection fee", "Zoning application"],
  Subcontractor: ["Electrical rough-in", "Plumbing rough-in", "HVAC subcontractor", "Tile subcontractor", "Roofing subcontractor", "Excavation subcontractor", "Painting subcontractor"],
  Miscellaneous: ["Dump run / debris removal", "Equipment rental", "Site cleanup", "Portable toilet rental", "Fuel & mileage", "Dumpster rental"],
};

const CREDIT_DESCRIPTIONS = ["Deposit", "Progress payment", "Milestone payment", "Final payment", "Change order payment"];

interface ProjectTemplate {
  name: string;
  description: string;
  status: ProjectStatus;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  address: string;
  startMonthsAgo: number;
  durationMonths: number;
  contractAmountCents: number;
  costScale: number;
}

const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    name: "Thompson Kitchen Remodel",
    description: "Full kitchen remodel: custom cabinets, quartz countertops, new appliances.",
    status: "ACTIVE",
    clientName: "Sarah Thompson",
    clientPhone: "207-555-0142",
    clientEmail: "sarah.thompson@example.com",
    address: "12 Maple St, Portland, ME",
    startMonthsAgo: 3,
    durationMonths: 3,
    contractAmountCents: 4850000,
    costScale: 1.6,
  },
  {
    name: "Whitfield Bathroom Remodel",
    description: "Primary bathroom gut renovation: tile shower, double vanity, heated floor.",
    status: "COMPLETED",
    clientName: "Mark Whitfield",
    clientPhone: "603-555-0198",
    clientEmail: "mwhitfield@example.com",
    address: "48 Elm St, Portsmouth, NH",
    startMonthsAgo: 10,
    durationMonths: 2,
    contractAmountCents: 2650000,
    costScale: 1.1,
  },
  {
    name: "Ocean Ave Rear Deck",
    description: "New 420 sq ft composite deck with cable railing and stairs.",
    status: "COMPLETED",
    clientName: "Denise Carrow",
    clientPhone: "207-555-0177",
    clientEmail: "d.carrow@example.com",
    address: "9 Ocean Ave, Cape Elizabeth, ME",
    startMonthsAgo: 8,
    durationMonths: 1,
    contractAmountCents: 1875000,
    costScale: 0.9,
  },
  {
    name: "Birch Rd Siding Replacement",
    description: "Full vinyl siding tear-off and replacement, including trim and soffit.",
    status: "COMPLETED",
    clientName: "Paul & Linda Mercier",
    clientPhone: "603-555-0134",
    clientEmail: "mercier.family@example.com",
    address: "221 Birch Rd, Manchester, NH",
    startMonthsAgo: 7,
    durationMonths: 1,
    contractAmountCents: 2210000,
    costScale: 1.0,
  },
  {
    name: "Pine St Window Replacement",
    description: "Whole-house window replacement, 18 units, energy-efficient double-pane.",
    status: "ACTIVE",
    clientName: "Rachel Ng",
    clientPhone: "802-555-0161",
    clientEmail: "rachel.ng@example.com",
    address: "77 Pine St, Burlington, VT",
    startMonthsAgo: 2,
    durationMonths: 1,
    contractAmountCents: 1980000,
    costScale: 0.95,
  },
  {
    name: "Lake Rd Entry & Door Package",
    description: "Front entry door replacement plus three interior doors and trim.",
    status: "PLANNING",
    clientName: "Tom Bouchard",
    clientPhone: "603-555-0119",
    clientEmail: "tbouchard@example.com",
    address: "5 Lake Rd, Nashua, NH",
    startMonthsAgo: -1,
    durationMonths: 1,
    contractAmountCents: 740000,
    costScale: 0.5,
  },
  {
    name: "Highland Ave Roof Replacement",
    description: "Full roof tear-off and replacement, architectural shingles, new flashing.",
    status: "COMPLETED",
    clientName: "James & Carol DiPietro",
    clientPhone: "508-555-0155",
    clientEmail: "dipietro.home@example.com",
    address: "34 Highland Ave, Worcester, MA",
    startMonthsAgo: 11,
    durationMonths: 1,
    contractAmountCents: 2450000,
    costScale: 1.1,
  },
  {
    name: "River Rd Basement Finish",
    description: "Finish 900 sq ft basement: framing, electrical, drywall, flooring, half bath.",
    status: "ACTIVE",
    clientName: "Amanda Keough",
    clientPhone: "603-555-0187",
    clientEmail: "akeough@example.com",
    address: "63 River Rd, Concord, NH",
    startMonthsAgo: 4,
    durationMonths: 3,
    contractAmountCents: 5650000,
    costScale: 1.7,
  },
  {
    name: "Meadow Ln Two-Story Addition",
    description: "600 sq ft two-story addition: family room and primary suite above.",
    status: "PLANNING",
    clientName: "Chris & Beth Alvarado",
    clientPhone: "860-555-0173",
    clientEmail: "alvarado.build@example.com",
    address: "142 Meadow Ln, Hartford, CT",
    startMonthsAgo: -2,
    durationMonths: 5,
    contractAmountCents: 12800000,
    costScale: 2.8,
  },
  {
    name: "Orchard Dr Detached Garage",
    description: "New 24x24 detached two-car garage with electrical and loft storage.",
    status: "ACTIVE",
    clientName: "Nate Ferreira",
    clientPhone: "401-555-0128",
    clientEmail: "nate.ferreira@example.com",
    address: "18 Orchard Dr, Providence, RI",
    startMonthsAgo: 2,
    durationMonths: 2,
    contractAmountCents: 6450000,
    costScale: 1.9,
  },
];

function randomDateInRange(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

async function seedFullProject(userId: string, template: ProjectTemplate) {
  const now = new Date();
  const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - template.startMonthsAgo, 1));
  const targetCompletionDate = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + template.durationMonths, startDate.getUTCDate()));

  const project = await prisma.project.create({
    data: {
      userId,
      name: template.name,
      description: template.description,
      status: template.status,
      clientName: template.clientName,
      clientPhone: template.clientPhone,
      clientEmail: template.clientEmail,
      address: template.address,
      startDate,
      targetCompletionDate,
      contractAmountCents: template.contractAmountCents,
      createdAt: startDate,
    },
  });

  const categories = await Promise.all(CATEGORY_NAMES.map((name) => prisma.category.create({ data: { projectId: project.id, name } })));
  const categoryByName = new Map(categories.map((c) => [c.name, c]));

  const rangeStart = new Date(Date.UTC(now.getUTCFullYear() - 1, 6, 1));

  async function createDebits(mode: "ESTIMATE" | "ACTUAL", count: number) {
    for (let i = 0; i < count; i++) {
      const categoryName = pick(CATEGORY_NAMES);
      const category = categoryByName.get(categoryName)!;
      const amountCents = Math.round(randomInt(80, 1800) * template.costScale) * 100;
      await prisma.transaction.create({
        data: {
          projectId: project.id,
          categoryId: category.id,
          type: "DEBIT",
          mode,
          date: randomDateInRange(rangeStart, now),
          amountCents,
          description: pick(CATEGORY_DESCRIPTIONS[categoryName]),
        },
      });
    }
  }

  async function createCredits(mode: "ESTIMATE" | "ACTUAL", count: number) {
    for (let i = 0; i < count; i++) {
      const amountCents = Math.round(randomInt(1500, 6500) * template.costScale) * 100;
      await prisma.transaction.create({
        data: {
          projectId: project.id,
          categoryId: pick(categories).id,
          type: "CREDIT",
          mode,
          date: randomDateInRange(rangeStart, now),
          amountCents,
          description: mode === "ESTIMATE" ? "Estimated payment" : pick(CREDIT_DESCRIPTIONS),
        },
      });
    }
  }

  await createDebits("ACTUAL", randomInt(22, 28));
  await createCredits("ACTUAL", randomInt(5, 8));
  await createDebits("ESTIMATE", randomInt(20, 26));
  await createCredits("ESTIMATE", randomInt(4, 7));

  return project;
}

async function ensureDemoContractorWithSampleData() {
  const demo = await ensureBootstrapUser({ email: DEMO_EMAIL, role: "USER", label: "DEMO" });
  const existingProjects = await prisma.project.count({ where: { userId: demo.id } });
  if (existingProjects > 0) return;

  for (const template of PROJECT_TEMPLATES) {
    await seedFullProject(demo.id, template);
  }
}

export async function seedDefaults() {
  await ensureAdminUser();
  await ensureOwnerUser();
  await ensureDemoContractorWithSampleData();
}

if (require.main === module) {
  seedDefaults()
    .then(() => console.log("Seed complete."))
    .catch((err) => {
      console.error("Seed failed:", err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
