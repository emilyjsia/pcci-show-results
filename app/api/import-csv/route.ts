import { NextRequest, NextResponse } from "next/server";
import { importResults } from "@/lib/data";

// Columns: showDate, showName, breed, pcciNo, dogName, points, placement, judge (judge optional)
// Accepts CSV or TSV (e.g. paste from Google Sheets — copy range, paste here)
function parseSpreadsheet(text: string): { showDate: string; showName: string; breed: string; pcciNo: string; dogName?: string; points: number; placement?: string; judge?: string }[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 1) return [];
  const firstLine = lines[0];
  const isTsv = firstLine.includes("\t");
  const split = (line: string) =>
    isTsv
      ? line.split("\t").map((p) => p.trim())
      : line.split(",").map((p) => p.replace(/^"|"$/g, "").trim());
  const header = firstLine.toLowerCase();
  const hasHeader = /showdate|show_name|breed|pcci|dogname|points|placement|judge|date|club|show/.test(header);
  const start = hasHeader ? 1 : 0;
  const rows: { showDate: string; showName: string; breed: string; pcciNo: string; dogName?: string; points: number; placement?: string; judge?: string }[] = [];
  for (let i = start; i < lines.length; i++) {
    const parts = split(lines[i]);
    if (parts.length < 4) continue;
    const showDate = parts[0] || "";
    const showName = (parts[1] ?? "").trim();
    const breed = (parts[2] ?? "").trim();
    const pcciNo = (parts[3] ?? "").toString().trim();
    const dogName = parts[4]?.trim() || undefined;
    const points = Number(parts[5]) || 0;
    const placement = parts[6]?.trim() || undefined;
    const judge = parts[7]?.trim() || undefined;
    if (!showDate || !pcciNo) continue;
    rows.push({ showDate, showName, breed, pcciNo, dogName, points, placement, judge });
  }
  return rows;
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let text: string;
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      if (!file) return NextResponse.json({ ok: false, error: "No file" }, { status: 400 });
      text = await file.text();
    } else {
      const body = await request.json();
      text = body.csv ?? body.data ?? body.text ?? "";
    }
    const rows = parseSpreadsheet(text);
    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: "No valid rows. Use columns: showDate, showName, breed, pcciNo, dogName, points, placement, judge (or paste from Google Sheets with same order)." }, { status: 400 });
    }
    const count = await importResults(rows);
    return NextResponse.json({ ok: true, imported: count });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
