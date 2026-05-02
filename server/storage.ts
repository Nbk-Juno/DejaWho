import {
  type Encounter,
  type InsertEncounter,
  encounters,
  whitelistedEmails,
} from "@shared/schema";
import { and, desc, eq } from "drizzle-orm";
import { db } from "./db";

export type CreateEncounterInput = Omit<InsertEncounter, "context"> & {
  context?: string | null;
  embedding: number[];
  userId: string;
};

export interface IStorage {
  getAllEncountersForUser(userId: string): Promise<Encounter[]>;
  getEncounterForUser(id: string, userId: string): Promise<Encounter | undefined>;
  createEncounter(input: CreateEncounterInput): Promise<Encounter>;
  isEmailAllowed(email: string): Promise<boolean>;
  addAllowedEmail(email: string, invitedBy?: string | null): Promise<void>;
}

export class DbStorage implements IStorage {
  async createEncounter(input: CreateEncounterInput): Promise<Encounter> {
    const [row] = await db
      .insert(encounters)
      .values({
        userId: input.userId,
        name: input.name,
        location: input.location,
        datetime: input.datetime,
        context: input.context ?? null,
        embedding: input.embedding,
      })
      .returning();
    return row;
  }

  async getEncounterForUser(id: string, userId: string): Promise<Encounter | undefined> {
    const [row] = await db
      .select()
      .from(encounters)
      .where(and(eq(encounters.id, id), eq(encounters.userId, userId)))
      .limit(1);
    return row;
  }

  async getAllEncountersForUser(userId: string): Promise<Encounter[]> {
    return db
      .select()
      .from(encounters)
      .where(eq(encounters.userId, userId))
      .orderBy(desc(encounters.datetime));
  }

  async isEmailAllowed(email: string): Promise<boolean> {
    const normalized = email.trim().toLowerCase();
    const [row] = await db
      .select({ email: whitelistedEmails.email })
      .from(whitelistedEmails)
      .where(eq(whitelistedEmails.email, normalized))
      .limit(1);
    return Boolean(row);
  }

  async addAllowedEmail(email: string, invitedBy: string | null = null): Promise<void> {
    const normalized = email.trim().toLowerCase();
    await db
      .insert(whitelistedEmails)
      .values({ email: normalized, invitedBy })
      .onConflictDoNothing();
  }
}

export const storage: IStorage = new DbStorage();
