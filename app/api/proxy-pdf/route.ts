import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url || !url.startsWith("http")) {
    return NextResponse.json({ error: "Missing or invalid url" }, { status: 400 });
  }
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "PCCI-ShowResults-App/1.0" },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return NextResponse.json({ error: "Failed to fetch PDF" }, { status: 502 });
    const buf = await res.arrayBuffer();
    return new NextResponse(buf, {
      headers: {
        "Content-Type": res.headers.get("Content-Type") || "application/pdf",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
