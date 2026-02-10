import { NextRequest, NextResponse } from "next/server";
import { importResults } from "@/lib/data";

type Row = { showDate: string; showName: string; breed: string; pcciNo: string; dogName?: string; points: number; placement?: string };

function normalizePcciNo(s: string): string {
  return String(s ?? "").trim().replace(/\s+/g, "");
}

function parseTextLines(text: string, showDate: string, showName: string): Row[] {
  const out: Row[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const parts = line.split(/\t|\s{2,}/).map((p) => p.trim()).filter(Boolean);
    if (parts.length < 2) continue;
    const pcciNo = normalizePcciNo(parts[0]);
    if (!pcciNo || /^(date|show|breed|pcci|dog|place|points?|result|#)/i.test(parts[0])) continue;
    const breed = parts[1] || "";
    const dogName = parts.length > 2 ? parts[2] : undefined;
    const lastNum = parts.findIndex((p) => /^\d+(\.\d+)?$/.test(p));
    const points = lastNum >= 0 ? Number(parts[lastNum]) : 0;
    const placement = parts.length > 3 ? parts[3] : undefined;
    out.push({ showDate, showName, breed, pcciNo, dogName, points, placement });
  }
  return out;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text = (body.text ?? "").trim();
    const showDate = (body.showDate ?? "").trim();
    const showName = (body.showName ?? "").trim();
    if (!text) {
      return NextResponse.json({ ok: false, error: "Missing text" }, { status: 400 });
    }
    const rows = parseTextLines(text, showDate, showName);
    if (rows.length === 0) {
      return NextResponse.json({
        ok: false,
        error: "Could not parse rows from text. Try adding results manually or paste from your sheet.",
      }, { status: 422 });
    }
    const imported = await importResults(rows);
    return NextResponse.json({ ok: true, imported, rows: rows.length });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
