"use client";

const Y_TOLERANCE = 8;
const X_TOLERANCE = 20;

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

/** Match PCCISB or PCCI followed by a registration number */
const PCCISB_NO_PATTERN = /,?\s*PCCISB?\s+([A-Z0-9][\w\-]*)/i;

function isBreedSectionHeader(row: string[]): boolean {
  if (row.length < 1 || row.length > 4) return false;
  const first = row[0].trim();
  if (!first || first.length < 2) return false;
  // Reject known table/data patterns
  if (/ENTRY|PCCISB?|NAME\s+OF\s+DOG|AWARDS|POINTS|^\d+$/i.test(first)) return false;
  if (/^[\d,\.]+$/.test(first)) return false;
  if (/^[A-Z]{2,3},|^BOS,|^WD,|^BOB,|^BD\(|^WB\b|^RWB\b|^BB\b|^RBB\b/i.test(first)) return false;
  // Must look like a breed name: mostly uppercase letters, spaces, hyphens, parens
  if (/^[A-Z][A-Z\s\-\(\)\.]+$/i.test(first) && first.length >= 3) return true;
  return false;
}

function getBreedFromSectionHeader(row: string[]): string {
  const first = row[0].trim();
  return first;
}

function getJudgeFromSectionHeader(row: string[]): string | undefined {
  // Judge can be in the second cell or further cells of the header row
  for (let i = 1; i < row.length; i++) {
    const cell = row[i]?.trim();
    if (!cell) continue;
    // Matches patterns like "ANNIKA ULLTVEIT-MOE (SWEDEN)" or "MR. JOHN DOE (USA)"
    if (/\([A-Z]{2,}\)/i.test(cell)) return cell;
    if (/JUDGE|SWEDEN|USA|JPN|JAPAN|PHILIPPINES|PHL|KOREA|KOR|INDONESIA|IDN|THAILAND|THA|AUSTRALIA|AUS|TAIWAN|TWN|SINGAPORE|SGP|MALAYSIA|MYS/i.test(cell)) return cell;
  }
  return undefined;
}

function isTableHeaderRow(row: string[]): boolean {
  const joined = row.join(" ").toLowerCase();
  // Relaxed: match if we see at least 2 of: entry, name/pccisb, awards, points
  let score = 0;
  if (/entry\s*#?/i.test(joined)) score++;
  if (/name\s+of\s+dog|pccisb?/i.test(joined)) score++;
  if (/awards?/i.test(joined)) score++;
  if (/points?/i.test(joined)) score++;
  return score >= 2;
}

function inferPcciTableColumns(headerRow: string[]): { namePcci: number; awards: number; points: number } {
  const lower = headerRow.map((c) => c.toLowerCase());
  let namePcci = -1,
    awards = -1,
    points = -1;
  for (let i = 0; i < lower.length; i++) {
    const c = lower[i];
    if (/entry\s*#?/.test(c)) continue;
    if (/name\s+of\s+dog|pccisb?/i.test(c) && namePcci < 0) namePcci = i;
    if (/awards?/i.test(c) && awards < 0) awards = i;
    if (/points?/i.test(c) && points < 0) points = i;
  }
  if (namePcci < 0) namePcci = lower.findIndex((c) => c.includes("pccisb") || c.includes("pcci") || c.includes("name"));
  if (namePcci < 0 && lower.length >= 2) namePcci = 1;
  if (awards < 0) awards = Math.max(0, lower.length - 2);
  if (points < 0) points = Math.max(0, lower.length - 1);
  return { namePcci, awards, points };
}

function parseNameAndPcci(cell: string): { dogName: string; pcciNo: string } {
  const match = cell.match(PCCISB_NO_PATTERN);
  const pcciNo = match ? match[1].trim() : "";
  const dogName = match ? cell.replace(/,?\s*PCCISB?\s+.*/i, "").trim() : cell.trim();
  return { dogName, pcciNo };
}

export type ExtractedRow = { breed: string; pcciNo: string; dogName?: string; judge?: string; points: number; placement?: string };

/** Result of the extraction step before import */
export type ExtractionResult = {
  rows: ExtractedRow[];
  rawRowCount: number;
  rawTextSample: string[];
};

async function loadPdf(pdfUrl: string) {
  const proxyUrl = `/api/proxy-pdf?url=${encodeURIComponent(pdfUrl)}`;
  const res = await fetch(proxyUrl);
  if (!res.ok) throw new Error(`Failed to fetch PDF (${res.status})`);
  const blob = await res.blob();
  const arrayBuffer = await blob.arrayBuffer();

  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (typeof (pdfjsLib as any).GlobalWorkerOptions !== "undefined") {
    (pdfjsLib as any).GlobalWorkerOptions.workerSrc = "https://unpkg.com/pdfjs-dist@5.4.296/legacy/build/pdf.worker.min.mjs";
  }
  return (pdfjsLib as any).getDocument({ data: arrayBuffer }).promise;
}

export async function extractTableFromPdf(pdfUrl: string): Promise<ExtractionResult> {
  const pdf = await loadPdf(pdfUrl);
  const numPages = pdf.numPages;
  const allRows: string[][] = [];
  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items = (content as { items: TextItem[] }).items.filter((it: TextItem) => it.str?.trim());
    const pageRows = buildRows(items);
    for (const row of pageRows) allRows.push(row);
  }

  // Collect raw text sample for debug (first 30 lines)
  const rawTextSample = allRows.slice(0, 30).map((cells) => cells.join(" | "));

  if (allRows.length === 0) return { rows: [], rawRowCount: 0, rawTextSample: [] };

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

    // Try to find PCCISB in any cell of the row (not just the expected column)
    let matchedCell = "";
    let matchedColIdx = namePcciCol;
    if (namePcciCol >= 0 && namePcciCol < row.length) {
      const candidate = row[namePcciCol].trim();
      if (PCCISB_NO_PATTERN.test(candidate)) matchedCell = candidate;
    }
    // Fallback: scan all cells
    if (!matchedCell) {
      for (let c = 0; c < row.length; c++) {
        if (PCCISB_NO_PATTERN.test(row[c])) {
          matchedCell = row[c].trim();
          matchedColIdx = c;
          break;
        }
      }
    }

    if (!matchedCell || !currentBreed) continue;

    const { dogName, pcciNo } = parseNameAndPcci(matchedCell);
    if (!pcciNo) continue;

    // Awards: look in the expected column, or the cell after the matched one
    let awards: string | undefined;
    if (awardsCol >= 0 && awardsCol < row.length) {
      awards = row[awardsCol].trim();
    } else if (matchedColIdx + 1 < row.length) {
      awards = row[matchedColIdx + 1].trim();
    }

    // Points: look in expected column, or last cell that looks like a number
    let points = 0;
    if (pointsCol >= 0 && pointsCol < row.length) {
      const v = row[pointsCol].replace(/[^\d\.]/g, "");
      points = parseFloat(v) || 0;
    }
    if (points === 0) {
      // Try last cell as points
      const lastCell = row[row.length - 1]?.replace(/[^\d\.]/g, "");
      if (lastCell) points = parseFloat(lastCell) || 0;
    }

    // Check next row for continuation (awards/points on next line)
    if (points === 0 && r + 1 < allRows.length) {
      const nextRow = allRows[r + 1];
      const hasPcciOnNext = nextRow.some((c) => PCCISB_NO_PATTERN.test(c));
      if (!hasPcciOnNext && nextRow.length >= 1) {
        // Look for a number in the next row
        for (const c of nextRow) {
          const v = c.replace(/[^\d\.]/g, "");
          if (v && parseFloat(v)) { points = parseFloat(v); break; }
        }
        // Look for awards text
        const firstNonNum = nextRow.find((c) => !/^\d+\.?\d*$/.test(c.replace(/\s/g, "")));
        if (firstNonNum && /[A-Z]{2,}|,|\(|\)/.test(firstNonNum)) {
          awards = firstNonNum.trim();
        }
      }
    }

    out.push({
      breed: currentBreed,
      pcciNo,
      dogName: dogName || undefined,
      judge: currentJudge,
      points,
      placement: awards || undefined,
    });
  }
  return { rows: out, rawRowCount: allRows.length, rawTextSample };
}

export async function extractTextFromPdf(pdfUrl: string): Promise<string> {
  const pdf = await loadPdf(pdfUrl);
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
