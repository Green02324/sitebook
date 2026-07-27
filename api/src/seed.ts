import { prisma } from "./lib/prisma";
import { ensureAdminUser, ensureOwnerUser, ensureBootstrapUser } from "./lib/users";
import type { ProjectStatus } from "@prisma/client";

// Fixed sample account, unrelated to the real OWNER_EMAIL account — kept
// separate so the owner's own data always starts empty.
const DEMO_EMAIL = "demo.contractor@sitebook.local";

const CATEGORY_NAMES = ["Materials", "Labor", "Permits", "Subcontractor", "Miscellaneous"];

function randomDateInRange(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function seedProjectData(
  userId: string,
  name: string,
  description: string,
  status: ProjectStatus,
  createdAt: Date,
) {
  const project = await prisma.project.create({ data: { userId, name, description, status, createdAt } });

  const categories = await Promise.all(
    CATEGORY_NAMES.map((catName) => prisma.category.create({ data: { projectId: project.id, name: catName } })),
  );

  const now = new Date();
  const rangeStart = new Date(Date.UTC(now.getUTCFullYear() - 1, 6, 1));
  const txCount = 10 + Math.floor(Math.random() * 6); // 10-15

  for (let i = 0; i < txCount; i++) {
    const mode = Math.random() < 0.4 ? "ESTIMATE" : "ACTUAL";
    const type = Math.random() < 0.55 ? "DEBIT" : "CREDIT";
    const amountCents = Math.round(100 + Math.random() * 4900) * 100;
    await prisma.transaction.create({
      data: {
        projectId: project.id,
        categoryId: pick(categories).id,
        type,
        mode,
        date: randomDateInRange(rangeStart, now),
        amountCents,
        description: `${type === "CREDIT" ? "Payment" : "Expense"} - ${pick(CATEGORY_NAMES)}`,
      },
    });
  }

  return project;
}

async function ensureDemoContractorWithSampleData() {
  const demo = await ensureBootstrapUser({ email: DEMO_EMAIL, role: "USER", label: "DEMO" });
  const existingProjects = await prisma.project.count({ where: { userId: demo.id } });
  if (existingProjects > 0) return;

  const now = new Date();
  await seedProjectData(
    demo.id,
    "Maple St. Kitchen Remodel",
    "Full kitchen remodel: cabinets, countertops, appliances.",
    "ACTIVE",
    new Date(Date.UTC(now.getUTCFullYear(), 1, 15)),
  );
  await seedProjectData(
    demo.id,
    "Oakwood Deck Build",
    "New 400 sq ft rear deck with railing and stairs.",
    "COMPLETED",
    new Date(Date.UTC(now.getUTCFullYear() - 1, 8, 1)),
  );
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
