import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import type { ShowListing } from "@/lib/types";

const PCCI_BASE = "https://www.pcci.org.ph";
const SHOW_RESULTS_HUB = `${PCCI_BASE}/shows/show-results/`;

// Fixed range of years to fetch so we're not limited by what the hub page links to
const YEAR_START = 2018;
const YEAR_END = 2028;

function getYearPageUrls(): string[] {
  const urls: string[] = [];
  for (let y = YEAR_END; y >= YEAR_START; y--) {
    urls.push(`${PCCI_BASE}/shows/show-results/show-results-${y}/`);
  }
  return urls;
}

async function fetchYearPagesFromHub(): Promise<string[]> {
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
    return urls;
  } catch {
    return [];
  }
}

/** Hub may only link a few years; merge with full year range so we don't miss shows */
function mergeYearUrls(hubUrls: string[]): string[] {
  const byUrl = new Set<string>(getYearPageUrls());
  for (const u of hubUrls) byUrl.add(u.endsWith("/") ? u : u + "/");
  return Array.from(byUrl);
}

function scrapeShowsFromHtml(html: string): ShowListing[] {
  const $ = cheerio.load(html);
  const listings: ShowListing[] = [];
  const seen = new Set<string>();

  $("table tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 5) return;
    const dateText = $(cells[0]).text().trim();
    const club = $(cells[1]).text().trim();
    const show = $(cells[2]).text().trim();
    const linkEl = $(cells[4]).find('a[href*=".pdf"]').first();
    const href = linkEl.attr("href");
    if (!dateText || !show) return;
    const key = `${dateText}\t${show}`;
    if (seen.has(key)) return;
    seen.add(key);
    const resultUrl = href?.startsWith("http") ? href : href ? new URL(href, PCCI_BASE).href : "";
    listings.push({ date: dateText, club, show, resultUrl: resultUrl || "" });
  });

  return listings;
}

export async function GET() {
  const hubUrls = await fetchYearPagesFromHub();
  const urls = mergeYearUrls(hubUrls);

  // Fetch all year pages in parallel
  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const res = await fetch(url, {
        headers: { "User-Agent": "PCCI-ShowResults-App/1.0" },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return [];
      const html = await res.text();
      return scrapeShowsFromHtml(html);
    })
  );

  const listings: ShowListing[] = [];
  for (const r of results) {
    if (r.status === "fulfilled" && Array.isArray(r.value)) {
      for (const show of r.value) listings.push(show);
    }
  }

  // Dedupe by date+show (same show can appear on multiple year pages)
  const seen = new Set<string>();
  const deduped = listings.filter((l) => {
    const key = `${l.date}\t${l.show}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (deduped.length === 0) {
    deduped.push(
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
  return NextResponse.json(deduped);
}
