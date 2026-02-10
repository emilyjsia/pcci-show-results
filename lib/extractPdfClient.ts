"use client";

const Y_TOLERANCE = 4;
const X_TOLERANCE = 3;

type TextItem = { str: string; transform?: number[] };

function getX(item: TextItem): number {
  const t = item.transform;
  return t && t.length >= 5 ? t[4] : 0;
}
function getY(item: TextItem): number {
  const t = item.transform;
  return t && t.length >= 6 ? t[5] : 0;
}

function buildRows(items: TextItem[]): string[][] {
  if (items.length === 0) return [];
  const byY = new Map<number, TextItem[]>();
  for (const item of items) {
    const y = getY(item);
    let found = false;
    for (const key of Array.from(byY.keys())) {
      if (Math.abs(key - y) <= Y_TOLERANCE) {
        byY.get(key)!.push(item);
        found = true;
        break;
      }
    }
    if (!found) byY.set(y, [item]);
  }
  const sortedY = Array.from(byY.keys()).sort((a, b) => b - a);
  const rows: string[][] = [];
  for (const y of sortedY) {
    const rowItems = byY.get(y)!;
    rowItems.sort((a, b) => getX(a) - getX(b));
    const cells: string[] = [];
    let lastX = -999;
    for (const item of rowItems) {
      const x = getX(item);
      const str = (item as { str?: string }).str ?? "";
      if (cells.length === 0 || x - lastX > X_TOLERANCE) {
        cells.push(str.trim());
      } else {
        cells[cells.length - 1] = (cells[cells.length - 1] + " " + str).trim();
      }
      lastX = x;
    }
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}

/** PCCI layout: Breed = section header; table columns = ENTRY # (skip), NAME OF DOG PCCISB No., AWARDS, POINTS */
const PCCISB_NO_PATTERN = /,?\s*PCCISB\s*([A-Z0-9\-]+)/i;

function isBreedSectionHeader(row: string[]): boolean {
  if (row.length < 1 || row.length > 3) return false;
  const first = row[0].trim();
  if (!first || first.length < 2) return false;
  if (/ENTRY|PCCISB|NAME\s+OF\s+DOG|AWARDS|POINTS|^\d+$/i.test(first)) return false;
  if (/^[\d,\.]+$/.test(first)) return false;
  if (/^[A-Z]{2,3},|^BOS,|^WD,|^BOB,|^BD\(/i.test(first)) return false;
  return true;
}

function getBreedFromSectionHeader(row: string[]): string {
  const first = row[0].trim();
  const second = row[1]?.trim();
  if (second && /\([A-Z]{2,}\)|JUDGE|SWEDEN|USA|JPN/i.test(second)) return first;
  return first;
}

function getJudgeFromSectionHeader(row: string[]): string | undefined {
  const second = row[1]?.trim();
  if (!second) return undefined;
  if (/\([A-Z]{2,}\)|JUDGE|SWEDEN|USA|JPN|PHILIPPINES/i.test(second)) return second;
  return undefined;
}

function isTableHeaderRow(row: string[]): boolean {
  const joined = row.join(" ").toLowerCase();
  return (
    /entry\s*#?/.test(joined) &&
    /name\s+of\s+dog|pccisb/.test(joined) &&
    /awards/.test(joined) &&
    /points/.test(joined)
  );
}

function inferPcciTableColumns(headerRow: string[]): { namePcci: number; awards: number; points: number } {
  const lower = headerRow.map((c) => c.toLowerCase());
  let namePcci = -1,
    awards = -1,
    points = -1;
  for (let i = 0; i < lower.length; i++) {
    const c = lower[i];
    if (/entry\s*#?/.test(c)) continue;
    if (/name\s+of\s+dog|pccisb/.test(c) && namePcci < 0) namePcci = i;
    if (/^awards?$/i.test(c)) awards = i;
    if (/^points?$/i.test(c)) points = i;
  }
  if (namePcci < 0) namePcci = lower.findIndex((c) => c.includes("pccisb") || c.includes("name"));
  if (namePcci < 0 && lower.length >= 2) namePcci = 1;
  if (awards < 0) awards = Math.max(0, lower.length - 2);
  if (points < 0) points = Math.max(0, lower.length - 1);
  return { namePcci, awards, points };
}

function parseNameAndPcci(cell: string): { dogName: string; pcciNo: string } {
  const match = cell.match(PCCISB_NO_PATTERN);
  const pcciNo = match ? match[1].trim() : "";
  const dogName = match ? cell.replace(/,?\s*PCCISB\s*.*/i, "").trim() : cell.trim();
  return { dogName, pcciNo };
}

export type ExtractedRow = { breed: string; pcciNo: string; dogName?: string; judge?: string; points: number; placement?: string };

export async function extractTableFromPdf(pdfUrl: string): Promise<ExtractedRow[]> {
  const proxyUrl = `/api/proxy-pdf?url=${encodeURIComponent(pdfUrl)}`;
  const res = await fetch(proxyUrl);
  if (!res.ok) throw new Error("Failed to fetch PDF");
  const blob = await res.blob();
  const arrayBuffer = await blob.arrayBuffer();

  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (typeof (pdfjsLib as any).GlobalWorkerOptions !== "undefined") {
    (pdfjsLib as any).GlobalWorkerOptions.workerSrc = "https://unpkg.com/pdfjs-dist@5.4.296/legacy/build/pdf.worker.min.mjs";
  }

  const pdf = await (pdfjsLib as any).getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  const allRows: string[][] = [];
  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items = (content as { items: TextItem[] }).items.filter((it: TextItem) => it.str?.trim());
    const pageRows = buildRows(items);
    for (const row of pageRows) allRows.push(row);
  }
  if (allRows.length === 0) return [];

  let currentBreed = "";
  let currentJudge: string | undefined;
  let namePcciCol = -1,
    awardsCol = -1,
    pointsCol = -1;
  const out: ExtractedRow[] = [];

  for (let r = 0; r < allRows.length; r++) {
    const row = allRows[r];
    if (row.length === 0) continue;

    if (isBreedSectionHeader(row)) {
      currentBreed = getBreedFromSectionHeader(row);
      currentJudge = getJudgeFromSectionHeader(row);
      continue;
    }
    if (isTableHeaderRow(row)) {
      const cols = inferPcciTableColumns(row);
      namePcciCol = cols.namePcci;
      awardsCol = cols.awards;
      pointsCol = cols.points;
      continue;
    }

    if (namePcciCol < 0 || !currentBreed) continue;
    const namePcciCell = namePcciCol < row.length ? row[namePcciCol].trim() : "";
    if (!namePcciCell || !PCCISB_NO_PATTERN.test(namePcciCell)) continue;

    const { dogName, pcciNo } = parseNameAndPcci(namePcciCell);
    if (!pcciNo) continue;

    let awards = awardsCol >= 0 && awardsCol < row.length ? row[awardsCol].trim() : undefined;
    let points = 0;
    if (pointsCol >= 0 && pointsCol < row.length) {
      const v = row[pointsCol].replace(/[^\d\.]/g, "");
      points = parseFloat(v) || 0;
    }
    if (points === 0 && r + 1 < allRows.length) {
      const nextRow = allRows[r + 1];
      const hasPcciOnNext = nextRow.some((c) => PCCISB_NO_PATTERN.test(c));
      if (!hasPcciOnNext && nextRow.length >= 1) {
        const lastNum = nextRow.map((c) => c.replace(/[^\d\.]/g, "")).find((s) => s.length > 0);
        if (lastNum) points = parseFloat(lastNum) || 0;
        const firstNonNum = nextRow.find((c) => !/^\d+\.?\d*$/.test(c.replace(/\s/g, "")));
        if (firstNonNum && /[A-Z]{2,}|,|\(|\)/.test(firstNonNum)) awards = firstNonNum.trim();
      }
    }

    out.push({
      breed: currentBreed,
      pcciNo,
      dogName: dogName || undefined,
      judge: currentJudge,
      points,
      placement: awards,
    });
  }
  return out;
}

export async function extractTextFromPdf(pdfUrl: string): Promise<string> {
  const proxyUrl = `/api/proxy-pdf?url=${encodeURIComponent(pdfUrl)}`;
  const res = await fetch(proxyUrl);
  if (!res.ok) throw new Error("Failed to fetch PDF");
  const blob = await res.blob();
  const arrayBuffer = await blob.arrayBuffer();

  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (typeof (pdfjsLib as any).GlobalWorkerOptions !== "undefined") {
    (pdfjsLib as any).GlobalWorkerOptions.workerSrc = "https://unpkg.com/pdfjs-dist@5.4.296/legacy/build/pdf.worker.min.mjs";
  }

  const pdf = await (pdfjsLib as any).getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  let text = "";
  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += (content as { items: { str?: string }[] }).items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      + "\n";
  }
  return text;
}
