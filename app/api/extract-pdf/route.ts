import { NextRequest, NextResponse } from "next/server";
import { importResults } from "@/lib/data";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

type Row = { showDate: string; showName: string; breed: string; pcciNo: string; dogName?: string; points: number; placement?: string };

function normalizePcciNo(s: string): string {
  return String(s ?? "").trim().replace(/\s+/g, "");
}

function parseTableRows(rows: unknown[][], showDate: string, showName: string): Row[] {
  const out: Row[] = [];
  if (!Array.isArray(rows) || rows.length === 0) return out;
  const header = rows[0].map((c) => String(c ?? "").toLowerCase());
  const col = (name: string) => {
    const i = header.findIndex((h) => h.includes(name));
    return i >= 0 ? i : -1;
  };
  const idxPcci = header.some((h) => h.includes("pcci") || h.includes("reg") || h.includes("no") || h.includes("number"))
    ? col("pcci") >= 0 ? col("pcci") : col("reg") >= 0 ? col("reg") : header.findIndex((h) => /no|number|reg/.test(h))
    : 0;
  const idxBreed = col("breed") >= 0 ? col("breed") : 1;
  const idxDog = col("dog") >= 0 ? col("dog") : header.findIndex((h) => /dog|name/.test(h));
  const idxPoints = header.findIndex((h) => /point|score/.test(h));
  const idxPlace = header.findIndex((h) => /place|pos|win/.test(h));
  const dataStart = header.some((h) => /point|pcci|breed|dog|place/.test(h)) ? 1 : 0;
  for (let i = dataStart; i < rows.length; i++) {
    const r = rows[i];
    if (!Array.isArray(r)) continue;
    const cells = r.map((c) => String(c ?? "").trim());
    const pcciNo = idxPcci >= 0 && idxPcci < cells.length ? normalizePcciNo(cells[idxPcci]) : cells[0] || "";
    if (!pcciNo) continue;
    const breed = idxBreed >= 0 && idxBreed < cells.length ? cells[idxBreed] : cells[1] || "";
    const dogName = idxDog >= 0 && idxDog < cells.length ? cells[idxDog] : undefined;
    const points = idxPoints >= 0 && idxPoints < cells.length ? Number(cells[idxPoints]) || 0 : Number(cells[cells.length - 2]) || Number(cells[cells.length - 1]) || 0;
    const placement = idxPlace >= 0 && idxPlace < cells.length ? cells[idxPlace] : undefined;
    out.push({ showDate, showName, breed, pcciNo, dogName, points, placement });
  }
  return out;
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
    const url = body.url ?? body.pdfUrl ?? "";
    const showDate = (body.showDate ?? "").trim();
    const showName = (body.showName ?? "").trim();
    if (!url || !url.startsWith("http")) {
      return NextResponse.json({ ok: false, error: "Missing or invalid PDF url." }, { status: 400 });
    }
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ url, verbosity: 0 });
    let rows: Row[] = [];
    try {
      const tableResult = await parser.getTable?.();
      await parser.destroy?.();
      if (tableResult?.pages?.[0]?.tables?.[0]?.length) {
        const rawRows = tableResult.pages[0].tables[0] as unknown[][];
        rows = parseTableRows(rawRows, showDate, showName);
      }
    } catch {
      try {
        parser.destroy?.();
      } catch {}
    }
    if (rows.length === 0) {
      const parser2 = new PDFParse({ url, verbosity: 0 });
      const textResult = await parser2.getText?.();
      await parser2.destroy?.();
      if (textResult?.text) {
        rows = parseTextLines(textResult.text, showDate, showName);
      }
    }
    if (rows.length === 0) {
      return NextResponse.json({
        ok: false,
        error: "Could not extract table or text rows from PDF. Try adding results manually or paste from your sheet.",
      }, { status: 422 });
    }
    const imported = await importResults(rows);
    return NextResponse.json({ ok: true, imported, rows: rows.length });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
