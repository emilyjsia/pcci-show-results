"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { extractTableFromPdf, extractTextFromPdf } from "@/lib/extractPdfClient";
import type { ExtractedRow } from "@/lib/extractPdfClient";

type ShowListing = { date: string; club: string; show: string; resultUrl: string };

function safeString(v: unknown): string {
  if (typeof v === "string") return v;
  if (v == null) return "";
  if (typeof v === "number") return String(v);
  try { return JSON.stringify(v).slice(0, 300); } catch { return "unknown error"; }
}

function apiErrorString(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "error" in data) {
    const e = (data as { error?: unknown }).error;
    return safeString(e) || fallback;
  }
  return fallback;
}

function safeCount(n: unknown): number {
  if (typeof n === "number" && !Number.isNaN(n)) return n;
  if (typeof n === "string") return parseInt(n, 10) || 0;
  return 0;
}

export default function AdminPage() {
  const [shows, setShows] = useState<ShowListing[]>([]);
  const [showYearFilter, setShowYearFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [importCsv, setImportCsv] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const [extractingUrl, setExtractingUrl] = useState<string | null>(null);
  const [extractMsg, setExtractMsg] = useState("");
  const [pdfExtractForm, setPdfExtractForm] = useState({ url: "", showDate: "", showName: "" });
  // Preview state
  const [previewRows, setPreviewRows] = useState<ExtractedRow[]>([]);
  const [previewShowDate, setPreviewShowDate] = useState("");
  const [previewShowName, setPreviewShowName] = useState("");
  const [previewSource, setPreviewSource] = useState<"parser" | "ai" | "">("");
  const [debugLines, setDebugLines] = useState<string[]>([]);

  const [addForm, setAddForm] = useState({
    showDate: "",
    showName: "",
    breed: "",
    pcciNo: "",
    dogName: "",
    judge: "",
    points: "",
    placement: "",
  });
  const [breeds, setBreeds] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/breeds").then((r) => r.ok ? r.json() : []).then((b) => setBreeds(Array.isArray(b) ? b : [])).catch(() => {});
  }, []);

  const fetchShows = useCallback(async () => {
    try {
      const r = await fetch("/api/shows");
      if (r.ok) setShows(await r.json());
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchShows();
  }, [fetchShows]);

  const clearPreview = () => {
    setPreviewRows([]);
    setPreviewShowDate("");
    setPreviewShowName("");
    setPreviewSource("");
    setDebugLines([]);
  };

  const handleAddResult = async (e: React.FormEvent) => {
    e.preventDefault();
    const points = parseInt(addForm.points, 10);
    if (!addForm.showDate || !addForm.showName || !addForm.breed || !addForm.pcciNo || isNaN(points)) return;
    setLoading(true);
    try {
      const res = await fetch("/api/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          showDate: addForm.showDate,
          showName: addForm.showName,
          breed: addForm.breed,
          pcciNo: addForm.pcciNo,
          dogName: addForm.dogName || undefined,
          judge: addForm.judge || undefined,
          points,
          placement: addForm.placement || undefined,
        }),
      });
      const data = await res.json();
      if (data.id) {
        setAddForm({ showDate: "", showName: "", breed: "", pcciNo: "", dogName: "", judge: "", points: "", placement: "" });
        setImportMsg(String("Added 1 result."));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExtractPdf = async (url: string, showDate: string, showName: string) => {
    if (!url?.trim()) return;
    clearPreview();
    setExtractingUrl(url);
    setExtractMsg(String("Extracting..."));
    try {
      const EXTRACT_TIMEOUT_MS = 90000;
      const result = await Promise.race([
        extractTableFromPdf(url.trim()),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Extraction timed out. The PDF may be too large or the link may be invalid.")), EXTRACT_TIMEOUT_MS)
        ),
      ]);

      const { rows, rawRowCount, rawTextSample } = result;

      if (rows && rows.length > 0) {
        // Show preview
        setPreviewRows(rows);
        setPreviewShowDate(showDate);
        setPreviewShowName(showName);
        setPreviewSource("parser");
        setExtractMsg(String(`Layout parser found ${rows.length} results from ${rawRowCount} PDF text rows. Review below, then click Import.`));
        return;
      }

      // Layout parser found no rows — show debug info and try AI
      setDebugLines(rawTextSample);
      setExtractMsg(String(`Layout parser found 0 results (PDF had ${rawRowCount} text rows). Trying AI fallback...`));

      try {
        const rawText = await extractTextFromPdf(url.trim());
        const aiRes = await fetch("/api/extract-pdf-ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: rawText }),
          signal: AbortSignal.timeout(60000),
        });
        const aiText = await aiRes.text();
        let aiData: { ok?: boolean; rows?: ExtractedRow[]; error?: unknown } = {};
        try { aiData = aiText ? JSON.parse(aiText) : {}; } catch { /* ignore */ }

        if (aiData.ok && Array.isArray(aiData.rows) && aiData.rows.length > 0) {
          setPreviewRows(aiData.rows);
          setPreviewShowDate(showDate);
          setPreviewShowName(showName);
          setPreviewSource("ai");
          setExtractMsg(String(`AI found ${aiData.rows.length} results. Review below, then click Import.`));
        } else if (aiData.ok && (!aiData.rows || aiData.rows.length === 0)) {
          setExtractMsg(String("AI found no result rows in this PDF. Try adding results manually or paste from a spreadsheet."));
        } else {
          const errMsg = apiErrorString(aiData, "");
          if (errMsg.includes("OPENAI_API_KEY")) {
            setExtractMsg(String("AI fallback not available. Set OPENAI_API_KEY in Vercel environment variables to enable it."));
          } else {
            setExtractMsg(String(`AI fallback failed: ${errMsg || "Unknown error"}`));
          }
        }
      } catch (aiErr) {
        const msg = aiErr instanceof Error ? aiErr.message : safeString(aiErr);
        if (msg.includes("OPENAI_API_KEY")) {
          setExtractMsg(String("AI fallback not available. Set OPENAI_API_KEY in Vercel environment variables to enable it."));
        } else {
          setExtractMsg(String(`Layout parser found no rows. AI fallback failed: ${msg || "Unknown error"}`));
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : safeString(e);
      setExtractMsg(String(msg || "Extraction failed."));
    } finally {
      setExtractingUrl(null);
    }
  };

  const handleImportPreview = async () => {
    if (previewRows.length === 0) return;
    setLoading(true);
    setExtractMsg(String("Importing..."));
    try {
      const res = await fetch("/api/import-pdf-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: previewRows,
          showDate: previewShowDate.trim(),
          showName: previewShowName.trim(),
        }),
      });
      const text = await res.text();
      let data: { ok?: boolean; imported?: unknown; error?: unknown } = {};
      try { data = text ? JSON.parse(text) : {}; } catch { /* ignore */ }
      if (data.ok) {
        const n = safeCount(data.imported) || previewRows.length;
        setExtractMsg(String(`Imported ${n} results from PDF${previewSource === "ai" ? " (AI)" : ""}.`));
        clearPreview();
      } else {
        setExtractMsg(String(apiErrorString(data, "Import failed.")));
      }
    } catch (e) {
      setExtractMsg(String(e instanceof Error ? e.message : "Import failed."));
    } finally {
      setLoading(false);
    }
  };

  const handleImportCsv = async () => {
    if (!importCsv.trim()) return;
    setLoading(true);
    setImportMsg("");
    try {
      const res = await fetch("/api/import-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: importCsv }),
      });
      const data = await res.json();
      if (data.ok) {
        setImportMsg(String(`Imported ${safeCount(data.imported)} rows.`));
        setImportCsv("");
      } else {
        setImportMsg(String(apiErrorString(data, "Import failed.")));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClearAll = async () => {
    if (!confirm("Delete all saved results? This cannot be undone.")) return;
    setLoading(true);
    setImportMsg("");
    try {
      const res = await fetch("/api/results", { method: "DELETE" });
      const text = await res.text();
      let data: { ok?: boolean; error?: unknown } = {};
      try { data = text ? JSON.parse(text) : {}; } catch { /* ignore */ }
      if (data.ok) {
        setImportMsg(String("All data cleared."));
      } else {
        setImportMsg(String(apiErrorString(data, "Failed to clear.")));
      }
    } catch (e) {
      setImportMsg(String(e instanceof Error ? e.message : "Request failed."));
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      const res = await fetch("/api/results");
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      const header = "showDate,showName,breed,pcciNo,dogName,points,placement,judge";
      const escape = (v: string | number | undefined) =>
        v == null ? "" : String(v).includes(",") ? `"${String(v).replace(/"/g, '""')}"` : String(v);
      const rows = list.map((r: { showDate: string; showName: string; breed: string; pcciNo: string; dogName?: string; points: number; placement?: string; judge?: string }) =>
        [r.showDate, r.showName, r.breed, r.pcciNo, r.dogName ?? "", r.points, r.placement ?? "", r.judge ?? ""].map(escape).join(",")
      );
      const csv = [header, ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pcci-results-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (_) {}
  };

  const styles = {
    input: { padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)" } as React.CSSProperties,
    btn: { padding: "8px 20px", borderRadius: 8, border: "none", background: "var(--accent)", color: "white", fontWeight: 600, cursor: "pointer" } as React.CSSProperties,
    th: { padding: "12px 16px", textAlign: "left" as const, fontWeight: 600, fontSize: 12, textTransform: "uppercase" as const, color: "var(--muted)" } as React.CSSProperties,
    td: { padding: "12px 16px", fontSize: 14 } as React.CSSProperties,
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <header style={{ marginBottom: 32, borderBottom: "1px solid var(--border)", paddingBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <Link href="/" style={{ color: "var(--muted)", fontSize: 14 }}>Back to Search</Link>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}>Data Admin</h1>
        </div>
        <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: "0.9rem" }}>
          Upload, scrape, and transform show results. This area is for data management only.
        </p>
      </header>

      <section style={{ background: "var(--surface)", borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <h2 style={{ margin: "0 0 16px", fontSize: "1.1rem" }}>Add single result</h2>
        <form onSubmit={handleAddResult} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
          <input type="text" placeholder="Show date" value={addForm.showDate} onChange={(e) => setAddForm((f) => ({ ...f, showDate: e.target.value }))} style={styles.input} />
          <input type="text" placeholder="Show name" value={addForm.showName} onChange={(e) => setAddForm((f) => ({ ...f, showName: e.target.value }))} style={styles.input} />
          <input type="text" list="admin-breed-list" placeholder="Breed" value={addForm.breed} onChange={(e) => setAddForm((f) => ({ ...f, breed: e.target.value }))} autoComplete="off" style={styles.input} />
          <input type="text" placeholder="PCCI No." value={addForm.pcciNo} onChange={(e) => setAddForm((f) => ({ ...f, pcciNo: e.target.value }))} style={styles.input} />
          <input type="text" placeholder="Dog name" value={addForm.dogName} onChange={(e) => setAddForm((f) => ({ ...f, dogName: e.target.value }))} style={styles.input} />
          <input type="text" placeholder="Judge" value={addForm.judge} onChange={(e) => setAddForm((f) => ({ ...f, judge: e.target.value }))} style={styles.input} />
          <input type="number" placeholder="Points" value={addForm.points} onChange={(e) => setAddForm((f) => ({ ...f, points: e.target.value }))} style={styles.input} />
          <input type="text" placeholder="Placement" value={addForm.placement} onChange={(e) => setAddForm((f) => ({ ...f, placement: e.target.value }))} style={styles.input} />
          <button type="submit" disabled={loading} style={styles.btn}>Add</button>
        </form>
        <datalist id="admin-breed-list">{breeds.map((b) => <option key={b} value={b} />)}</datalist>
      </section>

      <section style={{ background: "var(--surface)", borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <h2 style={{ margin: "0 0 16px", fontSize: "1.1rem" }}>Import from spreadsheet</h2>
        <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--muted)" }}>
          Paste from Google Sheets or CSV. Columns: showDate, showName, breed, pcciNo, dogName, points, placement, judge.
        </p>
        <textarea
          placeholder="Paste here..."
          value={importCsv}
          onChange={(e) => setImportCsv(e.target.value)}
          rows={4}
          style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", resize: "vertical", fontFamily: "monospace", fontSize: 13 }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={handleImportCsv} disabled={loading || !importCsv.trim()} style={styles.btn}>Import</button>
          <button type="button" onClick={handleExportCsv} style={{ ...styles.btn, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}>Export all to CSV</button>
          {importMsg && <span style={{ color: "var(--muted)", fontSize: 14 }}>{importMsg}</span>}
        </div>
      </section>

      <section style={{ background: "var(--surface)", borderRadius: 12, padding: 20, marginBottom: 24, border: "1px solid var(--border)" }}>
        <h2 style={{ margin: "0 0 16px", fontSize: "1.1rem", color: "var(--muted)" }}>Clear all data</h2>
        <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--muted)" }}>
          Remove every saved result (file or Supabase). Use this if data was imported incorrectly and you want to start over.
        </p>
        <button
          type="button"
          onClick={handleClearAll}
          disabled={loading}
          style={{ ...styles.btn, background: "#c53030", color: "white" }}
        >
          Clear all saved data
        </button>
      </section>

      <section style={{ background: "var(--surface)", borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <h2 style={{ margin: "0 0 16px", fontSize: "1.1rem" }}>Extract from PCCI PDF</h2>
        <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--muted)" }}>
          Paste a PCCI result PDF URL. The app extracts breed, PCCI No., points, etc.
          If the layout parser finds no rows, an AI fallback runs when <code style={{ fontSize: 12 }}>OPENAI_API_KEY</code> is set.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 280px" }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>PDF URL</span>
            <input type="url" placeholder="https://www.pcci.org.ph/assets/Uploads/..." value={pdfExtractForm.url} onChange={(e) => setPdfExtractForm((f) => ({ ...f, url: e.target.value }))} style={styles.input} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Show date</span>
            <input type="text" placeholder="e.g. JANUARY 22, 2026" value={pdfExtractForm.showDate} onChange={(e) => setPdfExtractForm((f) => ({ ...f, showDate: e.target.value }))} style={{ ...styles.input, width: 160 }} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 200px" }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Show name</span>
            <input type="text" placeholder="e.g. 39TH SEA CHAMPIONSHIP" value={pdfExtractForm.showName} onChange={(e) => setPdfExtractForm((f) => ({ ...f, showName: e.target.value }))} style={styles.input} />
          </label>
          <button type="button" onClick={() => handleExtractPdf(pdfExtractForm.url, pdfExtractForm.showDate, pdfExtractForm.showName)} disabled={loading || !pdfExtractForm.url.trim() || extractingUrl !== null} style={styles.btn}>
            {extractingUrl ? "Extracting..." : "Extract"}
          </button>
        </div>
        {extractMsg && <p style={{ margin: "12px 0 0", fontSize: 14, color: "var(--muted)" }}>{extractMsg}</p>}
      </section>

      {/* Preview table */}
      {previewRows.length > 0 && (
        <section style={{ background: "var(--surface)", borderRadius: 12, padding: 20, marginBottom: 24, border: "2px solid var(--accent)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: "1.1rem" }}>
              Preview: {previewRows.length} rows {previewSource === "ai" ? "(from AI)" : "(from layout parser)"}
            </h2>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={handleImportPreview} disabled={loading} style={{ ...styles.btn, background: "#38a169" }}>
                {loading ? "Importing..." : `Import ${previewRows.length} rows`}
              </button>
              <button type="button" onClick={clearPreview} style={{ ...styles.btn, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}>
                Cancel
              </button>
            </div>
          </div>
          <div style={{ overflowX: "auto", maxHeight: 400, overflowY: "auto", borderRadius: 8, border: "1px solid var(--border)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--bg)", position: "sticky", top: 0 }}>
                  <th style={{ ...styles.th, fontSize: 11 }}>#</th>
                  <th style={{ ...styles.th, fontSize: 11 }}>Breed</th>
                  <th style={{ ...styles.th, fontSize: 11 }}>PCCI No.</th>
                  <th style={{ ...styles.th, fontSize: 11 }}>Dog name</th>
                  <th style={{ ...styles.th, fontSize: 11 }}>Judge</th>
                  <th style={{ ...styles.th, fontSize: 11 }}>Points</th>
                  <th style={{ ...styles.th, fontSize: 11 }}>Placement</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r, i) => (
                  <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ ...styles.td, fontSize: 12, color: "var(--muted)" }}>{i + 1}</td>
                    <td style={{ ...styles.td, fontSize: 12 }}>{r.breed}</td>
                    <td style={{ ...styles.td, fontSize: 12 }}>{r.pcciNo}</td>
                    <td style={{ ...styles.td, fontSize: 12 }}>{r.dogName ?? ""}</td>
                    <td style={{ ...styles.td, fontSize: 12 }}>{r.judge ?? ""}</td>
                    <td style={{ ...styles.td, fontSize: 12 }}>{r.points}</td>
                    <td style={{ ...styles.td, fontSize: 12 }}>{r.placement ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Debug: raw text lines when extraction fails */}
      {debugLines.length > 0 && previewRows.length === 0 && (
        <section style={{ background: "var(--surface)", borderRadius: 12, padding: 20, marginBottom: 24, border: "1px solid var(--border)" }}>
          <h2 style={{ margin: "0 0 12px", fontSize: "1.1rem", color: "var(--muted)" }}>Debug: raw PDF text (first 30 rows)</h2>
          <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--muted)" }}>
            This is what PDF.js extracted. Each row is pipe-separated cells. If this is empty or garbled, the PDF may be scanned (image-only).
          </p>
          <pre style={{ background: "var(--bg)", padding: 12, borderRadius: 8, fontSize: 12, overflow: "auto", maxHeight: 300, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
            {debugLines.map((line, i) => `${String(i + 1).padStart(3, " ")}  ${line}`).join("\n")}
          </pre>
          <button type="button" onClick={() => setDebugLines([])} style={{ ...styles.btn, marginTop: 8, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 13 }}>
            Hide debug
          </button>
        </section>
      )}

      {shows.length > 0 && (() => {
        const yearFromDate = (d: string) => {
          const match = d.match(/\b(19|20)\d{2}\b/);
          return match ? match[0] : "";
        };
        const allYears = Array.from(new Set(shows.map((s) => yearFromDate(s.date)).filter(Boolean))).sort((a, b) => Number(b) - Number(a));
        const filteredShows = showYearFilter && showYearFilter !== "all" ? shows.filter((s) => yearFromDate(s.date) === showYearFilter) : shows;
        return (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: "1.1rem" }}>Shows from PCCI (scrape & extract)</h2>
          <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--muted)" }}>
            Shows from 2018-2028. Filter by year, then click Extract on any show with a PDF link.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, color: "var(--muted)" }}>Year:</span>
              <select
                value={showYearFilter}
                onChange={(e) => setShowYearFilter(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 14 }}
              >
                <option value="all">All years</option>
                {allYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </label>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>
              {filteredShows.length} show{filteredShows.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid var(--border)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface)" }}>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Club</th>
                  <th style={styles.th}>Show</th>
                  <th style={styles.th}>Results</th>
                  <th style={styles.th}>Extract</th>
                </tr>
              </thead>
              <tbody>
                {filteredShows.map((s, i) => (
                  <tr key={`${s.date}-${s.show}-${i}`} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={styles.td}>{s.date}</td>
                    <td style={styles.td}>{s.club}</td>
                    <td style={styles.td}>{s.show}</td>
                    <td style={styles.td}>{s.resultUrl ? <a href={s.resultUrl} target="_blank" rel="noopener noreferrer">PDF</a> : ""}</td>
                    <td style={styles.td}>
                      {s.resultUrl && (
                        <button type="button" onClick={() => handleExtractPdf(s.resultUrl, s.date, s.show)} disabled={extractingUrl !== null} style={{ ...styles.btn, padding: "6px 12px", fontSize: 13 }}>
                          {extractingUrl === s.resultUrl ? "..." : "Extract"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        );
      })()}
    </div>
  );
}
