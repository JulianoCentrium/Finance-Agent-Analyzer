import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, personsTable } from "@workspace/db";
import {
  ListPersonsQueryParams,
  ListPersonsResponse,
  CreatePersonBody,
  GetPersonParams,
  GetPersonResponse,
  UpdatePersonParams,
  UpdatePersonBody,
  UpdatePersonResponse,
  DeletePersonParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/authMiddleware";
import { assertProfileOwnership, type AuthRequest } from "../lib/auth";

const router: IRouter = Router();

function onlyDigits(v: string): string {
  return v.replace(/\D/g, "");
}

function validateCPF(cpf: string): boolean {
  const d = onlyDigits(cpf);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i]) * (10 - i);
  let r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(d[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(d[i]) * (11 - i);
  r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === parseInt(d[10]);
}

function validateCNPJ(cnpj: string): boolean {
  const d = onlyDigits(cnpj);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calcDigit = (slice: string, weights: number[]) => {
    const sum = slice.split("").reduce((acc, ch, i) => acc + parseInt(ch) * weights[i], 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  if (calcDigit(d.slice(0, 12), w1) !== parseInt(d[12])) return false;
  return calcDigit(d.slice(0, 13), w2) === parseInt(d[13]);
}

function validateDocument(doc: string | null | undefined, type: string): string | null {
  if (!doc || onlyDigits(doc).length === 0) return null;
  if (type === "person") {
    if (!validateCPF(onlyDigits(doc))) return "CPF inválido";
  } else if (type === "company") {
    if (!validateCNPJ(onlyDigits(doc))) return "CNPJ inválido";
  }
  return null;
}

router.get("/persons", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const parsed = ListPersonsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, parsed.data.profileId))) return;

  const conditions = [eq(personsTable.profileId, parsed.data.profileId)];
  if (parsed.data.search) {
    const searchPct = `%${parsed.data.search}%`;
    conditions.push(sql`(${personsTable.name} ILIKE ${searchPct} OR ${personsTable.document} ILIKE ${searchPct})`);
  }
  const persons = await db
    .select()
    .from(personsTable)
    .where(and(...conditions))
    .orderBy(personsTable.name);
  res.json(ListPersonsResponse.parse(persons));
});

router.post("/persons", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const parsed = CreatePersonBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, parsed.data.profileId))) return;

  const docError = validateDocument(parsed.data.document, parsed.data.type);
  if (docError) {
    res.status(422).json({ error: docError });
    return;
  }

  const [person] = await db.insert(personsTable).values(parsed.data).returning();
  res.status(201).json(GetPersonResponse.parse(person));
});

router.get("/persons/:id", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const params = GetPersonParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [person] = await db.select().from(personsTable).where(eq(personsTable.id, params.data.id));
  if (!person) {
    res.status(404).json({ error: "Person not found" });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, person.profileId))) return;
  res.json(GetPersonResponse.parse(person));
});

router.patch("/persons/:id", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const params = UpdatePersonParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdatePersonBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const existing = await db.select().from(personsTable).where(eq(personsTable.id, params.data.id));
  if (!existing[0]) {
    res.status(404).json({ error: "Person not found" });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, existing[0].profileId))) return;

  const effectiveType = parsed.data.type ?? existing[0].type;
  const effectiveDoc = parsed.data.document ?? existing[0].document;
  const docError = validateDocument(effectiveDoc, effectiveType);
  if (docError) {
    res.status(422).json({ error: docError });
    return;
  }

  const [person] = await db
    .update(personsTable)
    .set(parsed.data)
    .where(eq(personsTable.id, params.data.id))
    .returning();
  res.json(UpdatePersonResponse.parse(person!));
});

router.delete("/persons/:id", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const params = DeletePersonParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const existing = await db.select().from(personsTable).where(eq(personsTable.id, params.data.id));
  if (!existing[0]) {
    res.status(404).json({ error: "Person not found" });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, existing[0].profileId))) return;

  await db.delete(personsTable).where(eq(personsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
