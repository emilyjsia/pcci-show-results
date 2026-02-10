import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import type { ShowListing } from "@/lib/types";

const PCCI_BASE = "https://www.pcci.org.ph";
const SHOW_RESULTS_HUB = `${PCCI_BASE}/shows/show-results/`;
const FALLBACK_URLS = [
  `${PCCI_BASE}/shows/show-results/show-results-2025/`,
  `${PCCI_BASE}/shows/show-results/show-results-2026/`,
];

async function fetchYearPages(): Promise<string[]> {
  try {
    const res = await fetch(SHOW_RESULTS_HUB, {
      headers: { "User-Agent": "PCCI-ShowResults-App/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);
    const urls: string[] = [];
    $('a[href*="show-results"]').each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      const full = href.startsWith("http") ? href : new URL(href, PCCI_BASE).href;
      if (/show-results-\d{4}\/?$/.test(full) && !urls.includes(full)) {
        urls.push(full.endsWith("/") ? full : full + "/");
      }
    });
    return urls.length > 0 ? urls : FALLBACK_URLS;
  } catch {
    return FALLBACK_URLS;
  }
}

export async function GET() {
  const urls = await fetchYearPages();
  const listings: ShowListing[] = [];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "PCCI-ShowResults-App/1.0" },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) continue;
      const html = await res.text();
      const $ = cheerio.load(html);
      $("table tbody tr").each((_, row) => {
        const cells = $(row).find("td");
        if (cells.length < 5) return;
        const dateText = $(cells[0]).text().trim();
        const club = $(cells[1]).text().trim();
        const show = $(cells[2]).text().trim();
        const link = $(cells[4]).find('a[href*=".pdf"]').attr("href");
        if (!dateText || !show) return;
        const resultUrl = link?.startsWith("http") ? link : link ? new URL(link, PCCI_BASE).href : "";
        listings.push({
          date: dateText,
          club,
          show,
          resultUrl: resultUrl || "",
        });
      });
      $("table tr").each((_, row) => {
        const cells = $(row).find("td");
        if (cells.length < 5) return;
        const dateText = $(cells[0]).text().trim();
        const club = $(cells[1]).text().trim();
        const show = $(cells[2]).text().trim();
        const linkEl = $(cells[4]).find('a[href*=".pdf"]').first();
        const href = linkEl.attr("href");
        if (!dateText || !show) return;
        const resultUrl = href?.startsWith("http") ? href : href ? new URL(href, PCCI_BASE).href : "";
        if (!listings.some((l) => l.date === dateText && l.show === show)) {
          listings.push({ date: dateText, club, show, resultUrl: resultUrl || "" });
        }
      });
    } catch (_) {
      // use sample data if fetch fails (e.g. timeout, CORS)
    }
  }
  if (listings.length === 0) {
    listings.push(
      {
        date: "JANUARY 22, 2026",
        club: "PCCI",
        show: "39TH SOUTH EAST ASIA ALL BREED CHAMPIONSHIP DOG SHOW",
        resultUrl: `${PCCI_BASE}/assets/Uploads/rptSHOWRESULTS-SEA-JAN-222026.pdf`,
      },
      {
        date: "JANUARY 22, 2026",
        club: "PCCI",
        show: "283RD FCI ALL BREED CHAMPIONSHIP DOG SHOW",
        resultUrl: `${PCCI_BASE}/assets/Uploads/rptSHOWRESULTS-FCI-JAN-222026.pdf`,
      }
    );
  }
  return NextResponse.json(listings);
}
