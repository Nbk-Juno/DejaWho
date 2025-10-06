import { type Encounter, type InsertEncounter } from "@shared/schema";
import { randomUUID } from "crypto";
import { generateEmbedding } from "./openai";

export interface IStorage {
  getAllEncounters(): Promise<Encounter[]>;
  getEncounter(id: string): Promise<Encounter | undefined>;
  createEncounter(encounter: InsertEncounter): Promise<Encounter>;
  searchEncounters(query: string, limit?: number): Promise<Encounter[]>;
}

export class MemStorage implements IStorage {
  private encounters: Map<string, Encounter>;

  constructor() {
    this.encounters = new Map();
    this.initializeSampleData();
  }

  private async initializeSampleData() {
    const sampleEncounters: Array<Omit<InsertEncounter, "datetime"> & { datetime: string }> = [
      {
        name: "John Doe",
        location: "Skydeck San Diego",
        datetime: "2025-01-15T13:30:00Z",
        context: "Met after lunch with my wife. We discussed his sailing hobby and his tech startup in the AI space. Very friendly guy, seemed interested in collaboration.",
      },
      {
        name: "Sarah Chen",
        location: "Starbucks on Market Street",
        datetime: "2025-01-22T09:15:00Z",
        context: "Coffee meeting about the marketing campaign. She's a freelance designer with impressive portfolio. Showed me some brand concepts.",
      },
      {
        name: "Michael Rodriguez",
        location: "Tech Conference 2025 - San Francisco",
        datetime: "2025-01-28T14:00:00Z",
        context: "Keynote speaker at the conference. Expert in machine learning. We chatted about AI ethics and the future of automation. Exchanged LinkedIn contacts.",
      },
      {
        name: "Emma Watson",
        location: "Yoga Studio Downtown",
        datetime: "2025-02-03T07:00:00Z",
        context: "Met at morning yoga class. She's a product manager at a fintech company. Invited me to their networking event next month.",
      },
      {
        name: "David Kim",
        location: "Coffee Bean & Tea Leaf",
        datetime: "2025-02-08T16:30:00Z",
        context: "Random encounter while working on laptop. He's a software engineer working remotely. We bonded over our love of TypeScript and React.",
      },
      {
        name: "Lisa Anderson",
        location: "Farmers Market",
        datetime: "2025-02-12T10:00:00Z",
        context: "Runs a local organic farm. Very passionate about sustainable agriculture. Gave me tips on growing tomatoes and herbs.",
      },
      {
        name: "James Wilson",
        location: "University Library",
        datetime: "2025-02-15T15:45:00Z",
        context: "Graduate student researching renewable energy. We discussed his thesis on solar panel efficiency. Seemed very knowledgeable.",
      },
      {
        name: "Rachel Green",
        location: "Downtown Bistro",
        datetime: "2025-02-18T19:00:00Z",
        context: "Dinner party hosted by mutual friend. She works in fashion industry as a buyer for major retail chain. Fun conversation about trends.",
      },
    ];

    for (const sample of sampleEncounters) {
      const embeddingText = `${sample.name} ${sample.location} ${sample.context || ""}`;
      const embedding = await generateEmbedding(embeddingText);

      const encounter: Encounter = {
        id: randomUUID(),
        name: sample.name,
        location: sample.location,
        datetime: new Date(sample.datetime),
        context: sample.context || null,
        embedding: JSON.stringify(embedding),
        createdAt: new Date(sample.datetime),
      };

      this.encounters.set(encounter.id, encounter);
    }

    console.log(`Initialized ${sampleEncounters.length} sample encounters`);
  }

  async getAllEncounters(): Promise<Encounter[]> {
    return Array.from(this.encounters.values()).sort(
      (a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime()
    );
  }

  async getEncounter(id: string): Promise<Encounter | undefined> {
    return this.encounters.get(id);
  }

  async createEncounter(insertEncounter: InsertEncounter): Promise<Encounter> {
    const id = randomUUID();
    const embeddingText = `${insertEncounter.name} ${insertEncounter.location} ${insertEncounter.context || ""}`;
    const embedding = await generateEmbedding(embeddingText);

    const encounter: Encounter = {
      id,
      ...insertEncounter,
      context: insertEncounter.context || null,
      embedding: JSON.stringify(embedding),
      createdAt: new Date(),
    };

    this.encounters.set(id, encounter);
    return encounter;
  }

  async searchEncounters(query: string, limit: number = 10): Promise<Encounter[]> {
    const allEncounters = await this.getAllEncounters();
    return allEncounters.slice(0, limit);
  }
}

export const storage = new MemStorage();
