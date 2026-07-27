import { Router } from "express";
import { prisma } from "../lib/prisma";
import { ah } from "../lib/asyncHandler";

const router = Router({ mergeParams: true });

router.get(
  "/",
  ah(async (req, res) => {
    const categories = await prisma.category.findMany({
      where: { projectId: req.project!.id },
      orderBy: { name: "asc" },
    });
    res.json(categories);
  }),
);

router.post(
  "/",
  ah(async (req, res) => {
    const { name } = req.body as { name?: string };
    if (!name) {
      res.status(400).json({ error: "Name is required" });
      return;
    }
    try {
      const category = await prisma.category.create({ data: { name, projectId: req.project!.id } });
      res.status(201).json(category);
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        res.status(409).json({ error: "Category already exists" });
        return;
      }
      throw err;
    }
  }),
);

router.put(
  "/:catId",
  ah(async (req, res) => {
    const existing = await prisma.category.findFirst({ where: { id: req.params.catId, projectId: req.project!.id } });
    if (!existing) {
      res.status(404).json({ error: "Category not found" });
      return;
    }
    const { name } = req.body as { name?: string };
    if (!name) {
      res.status(400).json({ error: "Name is required" });
      return;
    }
    try {
      const category = await prisma.category.update({ where: { id: existing.id }, data: { name } });
      res.json(category);
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        res.status(409).json({ error: "Category already exists" });
        return;
      }
      throw err;
    }
  }),
);

router.delete(
  "/:catId",
  ah(async (req, res) => {
    const existing = await prisma.category.findFirst({ where: { id: req.params.catId, projectId: req.project!.id } });
    if (!existing) {
      res.status(404).json({ error: "Category not found" });
      return;
    }
    const inUse = await prisma.transaction.count({ where: { categoryId: existing.id } });
    if (inUse > 0) {
      res.status(409).json({ error: "Cannot delete a category that has transactions" });
      return;
    }
    await prisma.category.delete({ where: { id: existing.id } });
    res.status(204).end();
  }),
);

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002";
}

export default router;
