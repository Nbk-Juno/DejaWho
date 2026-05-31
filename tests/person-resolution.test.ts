import { describe, it, expect } from "vitest";
import { resolvePerson, type PersonCandidate } from "../server/person-resolution";
import type { Encounter, Person } from "@shared/schema";
import { EMBEDDING_DIMENSIONS } from "@shared/schema";

const USER = "11111111-1111-1111-1111-111111111111";

// A unit-length-ish embedding pointing mostly along one axis, so two candidates can be made
// semantically near or far by choosing the same or a different axis.
function axisEmbedding(axis: number, magnitude = 1): number[] {
  const v = new Array(EMBEDDING_DIMENSIONS).fill(0);
  v[axis % EMBEDDING_DIMENSIONS] = magnitude;
  return v;
}

let personSeq = 0;
function makePerson(overrides: Partial<Person> = {}): Person {
  personSeq += 1;
  return {
    id: `00000000-0000-0000-0000-${String(personSeq).padStart(12, "0")}`,
    userId: USER,
    normalizedName: "john",
    lastName: null,
    locationTag: null,
    encounterCount: 1,
    summary: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

let encSeq = 0;
function makeEncounter(overrides: Partial<Encounter> = {}): Encounter {
  encSeq += 1;
  return {
    id: `10000000-0000-0000-0000-${String(encSeq).padStart(12, "0")}`,
    userId: USER,
    name: "John",
    lastName: null,
    location: "Somewhere",
    datetime: new Date(),
    context: null,
    embedding: axisEmbedding(0),
    personId: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function candidate(person: Partial<Person>, encounters: Partial<Encounter>[]): PersonCandidate {
  const p = makePerson(person);
  return {
    person: p,
    encounters: encounters.map((e) => makeEncounter({ personId: p.id, ...e })),
  };
}

describe("resolvePerson", () => {
  it("returns 'new' with no candidates", () => {
    const result = resolvePerson({
      embedding: axisEmbedding(0),
      location: "Gym",
      datetime: new Date(),
      candidates: [],
    });
    expect(result.band).toBe("new");
  });

  it("a unique exact last-name match is a decisive winner", () => {
    const matching = candidate({ lastName: "Brown" }, [
      { lastName: "Brown", embedding: axisEmbedding(5) }, // semantically far
    ]);
    const other = candidate({ lastName: "Smith" }, [{ lastName: "Smith" }]);

    const result = resolvePerson({
      embedding: axisEmbedding(0),
      lastName: "Brown",
      location: "Anywhere",
      datetime: new Date(),
      candidates: [matching, other],
    });
    expect(result.band).toBe("winner");
    expect(result.winner?.id).toBe(matching.person.id);
  });

  it("returns 'new' when every candidate has a known last name and none match", () => {
    const result = resolvePerson({
      embedding: axisEmbedding(0),
      lastName: "Brown",
      location: "Gym",
      datetime: new Date(),
      candidates: [
        candidate({ lastName: "Smith" }, [{ lastName: "Smith" }]),
        candidate({ lastName: "Jones" }, [{ lastName: "Jones" }]),
      ],
    });
    expect(result.band).toBe("new");
  });

  it("returns 'winner' on a single strong semantic match with no last names", () => {
    const now = new Date();
    const result = resolvePerson({
      embedding: axisEmbedding(0),
      location: "Gym",
      datetime: now,
      candidates: [
        candidate({}, [{ embedding: axisEmbedding(0), location: "Gym", datetime: now }]),
      ],
    });
    expect(result.band).toBe("winner");
  });

  it("returns 'new' when the only candidate scores below the floor", () => {
    const result = resolvePerson({
      embedding: axisEmbedding(0),
      location: "Mars",
      datetime: new Date("2020-01-01T00:00:00Z"),
      candidates: [
        candidate({}, [
          { embedding: axisEmbedding(50), location: "Pluto", datetime: new Date("2019-01-01T00:00:00Z") },
        ]),
      ],
    });
    expect(result.band).toBe("new");
  });

  it("returns 'ambiguous' when two candidates score close together in the middle", () => {
    const now = new Date();
    // Two candidates, both semantically identical to the query and recent → high, tied scores.
    // Tied top scores mean the winner gap is not met, so it stays ambiguous.
    const result = resolvePerson({
      embedding: axisEmbedding(0),
      location: "Cafe",
      datetime: now,
      candidates: [
        candidate({}, [{ embedding: axisEmbedding(0), location: "Library", datetime: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000) }]),
        candidate({}, [{ embedding: axisEmbedding(0), location: "Museum", datetime: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000) }]),
      ],
    });
    expect(result.band).toBe("ambiguous");
  });

  it("penalizes a candidate whose known last name differs from the new one", () => {
    const now = new Date();
    const mismatch = candidate({ lastName: "Smith" }, [
      { lastName: "Smith", embedding: axisEmbedding(0), location: "Gym", datetime: now },
    ]);
    const result = resolvePerson({
      embedding: axisEmbedding(0),
      lastName: "Brown", // differs from the lone candidate's "Smith"
      location: "Gym",
      datetime: now,
      candidates: [mismatch],
    });
    // Single candidate with a known, differing last name → treated as someone new.
    expect(result.band).toBe("new");
  });
});
