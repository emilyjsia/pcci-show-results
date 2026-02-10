import path from "path";
import fs from "fs";
import type { ShowResult } from "./types";
import * as db from "./db";

const DATA_FILE = path.join(process.cwd(), "data", "results.json");

function ensureDataDir() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readResultsSync(): ShowResult[] {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeResultsSync(results: ShowResult[]) {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(results, null, 2), "utf-8");
}

export async function getAllResults(): Promise<ShowResult[]> {
  if (db.isDbConfigured()) return db.dbGetAllResults();
  return readResultsSync();
}

export async function addResult(result: Omit<ShowResult, "id" | "createdAt">): Promise<ShowResult> {
  if (db.isDbConfigured()) return db.dbAddResult(result);
  const results = readResultsSync();
  const newResult: ShowResult = {
    ...result,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  results.push(newResult);
  writeResultsSync(results);
  return newResult;
}

export async function importResults(rows: Omit<ShowResult, "id" | "createdAt">[]): Promise<number> {
  if (db.isDbConfigured()) return db.dbImportResults(rows);
  const existing = readResultsSync();
  const created = new Date().toISOString();
  const newRows: ShowResult[] = rows.map((r) => ({
    ...r,
    id: crypto.randomUUID(),
    createdAt: created,
  }));
  writeResultsSync([...existing, ...newRows]);
  return newRows.length;
}

export async function searchResults(filters: {
  breed?: string;
  showDateFrom?: string;
  showDateTo?: string;
  pcciNo?: string;
}): Promise<ShowResult[]> {
  let list = await getAllResults();
  if (filters.breed?.trim()) {
    const b = filters.breed.trim().toLowerCase();
    list = list.filter((r) => r.breed.toLowerCase().includes(b));
  }
  if (filters.pcciNo?.trim()) {
    const p = filters.pcciNo.trim();
    list = list.filter((r) => r.pcciNo.includes(p));
  }
  if (filters.showDateFrom) {
    list = list.filter((r) => r.showDate >= filters.showDateFrom!);
  }
  if (filters.showDateTo) {
    list = list.filter((r) => r.showDate <= filters.showDateTo!);
  }
  return list.sort((a, b) => b.showDate.localeCompare(a.showDate));
}

export async function getTallyByPcciNo(filters?: {
  breed?: string;
  showDateFrom?: string;
  showDateTo?: string;
  pcciNo?: string;
}): Promise<import("./types").TallyRow[]> {
  const list = filters ? await searchResults(filters) : await getAllResults();
  const byPcci: Record<string, ShowResult[]> = {};
  for (const r of list) {
    if (!byPcci[r.pcciNo]) byPcci[r.pcciNo] = [];
    byPcci[r.pcciNo].push(r);
  }
  return Object.entries(byPcci).map(([pcciNo, results]) => {
    const totalPoints = results.reduce((s, r) => s + r.points, 0);
    return {
      pcciNo,
      dogName: results[0]?.dogName,
      breed: results[0]?.breed,
      totalPoints,
      resultCount: results.length,
      results: results.sort((a, b) => b.showDate.localeCompare(a.showDate)),
    };
  });
}
