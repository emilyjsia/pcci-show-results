import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { ShowResult } from "./types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseKey) return null;
  if (!client) client = createClient(supabaseUrl, supabaseKey);
  return client;
}

const TABLE = "show_results";

export async function dbGetAllResults(): Promise<ShowResult[]> {
  const sb = getClient();
  if (!sb) return [];
  const { data, error } = await sb.from(TABLE).select("*").order("show_date", { ascending: false });
  if (error) return [];
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    showDate: String(r.show_date),
    showName: String(r.show_name),
    breed: String(r.breed),
    pcciNo: String(r.pcci_no),
    dogName: r.dog_name != null ? String(r.dog_name) : undefined,
    points: Number(r.points),
    placement: r.placement != null ? String(r.placement) : undefined,
    createdAt: String(r.created_at),
  }));
}

export async function dbAddResult(result: Omit<ShowResult, "id" | "createdAt">): Promise<ShowResult> {
  const sb = getClient();
  if (!sb) throw new Error("Database not configured");
  const row = {
    show_date: result.showDate,
    show_name: result.showName,
    breed: result.breed,
    pcci_no: result.pcciNo,
    dog_name: result.dogName ?? null,
    points: result.points,
    placement: result.placement ?? null,
  };
  const { data, error } = await sb.from(TABLE).insert(row).select("id, created_at").single();
  if (error) throw error;
  return {
    ...result,
    id: String((data as { id: string }).id),
    createdAt: String((data as { created_at: string }).created_at),
  };
}

export async function dbImportResults(rows: Omit<ShowResult, "id" | "createdAt">[]): Promise<number> {
  const sb = getClient();
  if (!sb || rows.length === 0) return 0;
  const toInsert = rows.map((r) => ({
    show_date: r.showDate,
    show_name: r.showName,
    breed: r.breed,
    pcci_no: r.pcciNo,
    dog_name: r.dogName ?? null,
    points: r.points,
    placement: r.placement ?? null,
  }));
  const { error } = await sb.from(TABLE).insert(toInsert);
  if (error) throw error;
  return rows.length;
}

export function isDbConfigured(): boolean {
  return !!(supabaseUrl && supabaseKey);
}
