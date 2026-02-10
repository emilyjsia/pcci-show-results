import { NextRequest, NextResponse } from "next/server";
import { searchResults, addResult, importResults, getTallyByPcciNo } from "@/lib/data";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const breed = searchParams.get("breed") ?? undefined;
  const pcciNo = searchParams.get("pcciNo") ?? undefined;
  const showDateFrom = searchParams.get("showDateFrom") ?? undefined;
  const showDateTo = searchParams.get("showDateTo") ?? undefined;
  const tally = searchParams.get("tally") === "1";
  if (tally) {
    const rows = await getTallyByPcciNo({
      breed,
      pcciNo,
      showDateFrom,
      showDateTo,
    });
    return NextResponse.json(rows);
  }
  const list = await searchResults({ breed, pcciNo, showDateFrom, showDateTo });
  return NextResponse.json(list);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (Array.isArray(body)) {
      const count = await importResults(body);
      return NextResponse.json({ ok: true, imported: count });
    }
    const { showDate, showName, breed, pcciNo, dogName, points, placement } = body;
    if (!showDate || !showName || !breed || !pcciNo || typeof points !== "number") {
      return NextResponse.json(
        { ok: false, error: "Missing required: showDate, showName, breed, pcciNo, points" },
        { status: 400 }
      );
    }
    const result = await addResult({
      showDate,
      showName,
      breed,
      pcciNo: String(pcciNo),
      dogName,
      points: Number(points),
      placement,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
