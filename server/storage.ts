import { type Encounter, type InsertEncounter, encounters } from "@shared/schema";
import { desc, eq } from "drizzle-orm";
import { db } from "./db";

export type CreateEncounterInput = Omit<InsertEncounter, "context"> & {
  context?: string | null;
  embedding: number[];
  userId?: string | null;
};

export interface IStorage {
  getAllEncounters(): Promise<Encounter[]>;
  getEncounter(id: string): Promise<Encounter | undefined>;
  createEncounter(input: CreateEncounterInput): Promise<Encounter>;
}

export class DbStorage implements IStorage {
  async createEncounter(input: CreateEncounterInput): Promise<Encounter> {
    const [row] = await db
      .insert(encounters)
      .values({
        userId: input.userId ?? null,
        name: input.name,
        location: input.location,
        datetime: input.datetime,
        context: input.context ?? null,
        embedding: input.embedding,
      })
      .returning();
    return row;
  }

  async getEncounter(id: string): Promise<Encounter | undefined> {
    const [row] = await db
      .select()
      .from(encounters)
      .where(eq(encounters.id, id))
      .limit(1);
    return row;
  }

  async getAllEncounters(): Promise<Encounter[]> {
    return db.select().from(encounters).orderBy(desc(encounters.datetime));
  }
}

export const storage: IStorage = new DbStorage();
