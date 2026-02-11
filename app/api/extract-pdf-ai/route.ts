import { NextRequest, NextResponse } from "next/server";

type ExtractedRow = { breed: string; pcciNo: string; dogName?: string; judge?: string; points: number; placement?: string };

const EXTRACT_SYSTEM = `You are a parser for PCCI (Philippine Canine Club) dog show result PDFs. Given raw text extracted from such a PDF, output a JSON object with exactly one key "rows" whose value is an array of result objects. Each object must have: breed (string), pcciNo (string, registration number only, e.g. "10211A6" — not "PCCISB 10211A6"), dogName (string or omit), judge (string or omit), points (number), placement (string or omit, e.g. "BOS,WD,BD(CACIB-E)"). If the text has no table data, use "rows": []. Output only the JSON object, no markdown or explanation.`;

export async function POST(request: NextRequest) {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) {
    return NextResponse.json(
      { ok: false, error: "AI fallback not configured. Set OPENAI_API_KEY in environment." },
      { status: 501 }
    );
  }
  try {
    const body = await request.json();
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) {
      return NextResponse.json({ ok: false, error: "Missing text" }, { status: 400 });
    }
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: EXTRACT_SYSTEM },
          { role: "user", content: `Extract all dog show result rows from this text as a JSON array:\n\n${text.slice(0, 120000)}` },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { ok: false, error: `OpenAI API error: ${res.status} ${err.slice(0, 200)}` },
        { status: 502 }
      );
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    let parsed: { rows?: ExtractedRow[] } = {};
    try {
      parsed = JSON.parse(raw) as { rows?: ExtractedRow[] };
    } catch {
      return NextResponse.json({ ok: false, error: "AI returned invalid JSON" }, { status: 502 });
    }
    const rows: ExtractedRow[] = Array.isArray(parsed.rows) ? parsed.rows : [];
    const normalized = rows
      .filter((r) => r && typeof r.breed === "string" && typeof r.pcciNo === "string")
      .map((r) => ({
        breed: String(r.breed).trim(),
        pcciNo: String(r.pcciNo).trim().replace(/\s+/g, "").replace(/^,?\s*PCCISB\s*/i, ""),
        dogName: r.dogName != null ? String(r.dogName).trim() : undefined,
        judge: r.judge != null ? String(r.judge).trim() : undefined,
        points: Number(r.points) || 0,
        placement: r.placement != null ? String(r.placement).trim() : undefined,
      }))
      .filter((r) => r.pcciNo.length > 0);
    return NextResponse.json({ ok: true, rows: normalized });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "AI extraction failed" },
      { status: 500 }
    );
  }
}
