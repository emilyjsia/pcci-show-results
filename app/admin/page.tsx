"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type ShowListing = { date: string; club: string; show: string; resultUrl: string };

export default function AdminPage() {
  const [shows, setShows] = useState<ShowListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [importCsv, setImportCsv] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const [extractingUrl, setExtractingUrl] = useState<string | null>(null);
  const [extractMsg, setExtractMsg] = useState("");
  const [pdfExtractForm, setPdfExtractForm] = useState({ url: "", showDate: "", showName: "" });
  const [addForm, setAddForm] = useState({
    showDate: "",
    showName: "",
    breed: "",
    pcciNo: "",
    dogName: "",
    points: "",
    placement: "",
  });

  const fetchShows = useCallback(async () => {
    try {
      const r = await fetch("/api/shows");
      if (r.ok) setShows(await r.json());
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchShows();
  }, [fetchShows]);

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
          points,
          placement: addForm.placement || undefined,
        }),
      });
      const data = await res.json();
      if (data.id) {
        setAddForm({ showDate: "", showName: "", breed: "", pcciNo: "", dogName: "", points: "", placement: "" });
        setImportMsg("Added 1 result.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExtractPdf = async (url: string, showDate: string, showName: string) => {
    if (!url?.trim()) return;
    setExtractingUrl(url);
    setExtractMsg("");
    try {
      const res = await fetch("/api/extract-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), showDate: showDate.trim(), showName: showName.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setExtractMsg(`Imported ${data.imported} results from PDF.`);
      } else {
        setExtractMsg(data.error || "Extraction failed.");
      }
    } catch (_) {
      setExtractMsg("Request failed.");
    } finally {
      setExtractingUrl(null);
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
        setImportMsg(`Imported ${data.imported} rows.`);
        setImportCsv("");
      } else {
        setImportMsg(data.error || "Import failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      const res = await fetch("/api/results");
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      const header = "showDate,showName,breed,pcciNo,dogName,points,placement";
      const escape = (v: string | number | undefined) =>
        v == null ? "" : String(v).includes(",") ? `"${String(v).replace(/"/g, '""')}"` : String(v);
      const rows = list.map((r: { showDate: string; showName: string; breed: string; pcciNo: string; dogName?: string; points: number; placement?: string }) =>
        [r.showDate, r.showName, r.breed, r.pcciNo, r.dogName ?? "", r.points, r.placement ?? ""].map(escape).join(",")
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
          <Link href="/" style={{ color: "var(--muted)", fontSize: 14 }}>← Back to Search</Link>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}>Data Admin</h1>
        </div>
        <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: "0.9rem" }}>
          Upload, scrape, and transform show results. This area is for data management only—keep the URL private.
        </p>
      </header>

      <section style={{ background: "var(--surface)", borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <h2 style={{ margin: "0 0 16px", fontSize: "1.1rem" }}>Add single result</h2>
        <form onSubmit={handleAddResult} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
          <input type="text" placeholder="Show date" value={addForm.showDate} onChange={(e) => setAddForm((f) => ({ ...f, showDate: e.target.value }))} style={styles.input} />
          <input type="text" placeholder="Show name" value={addForm.showName} onChange={(e) => setAddForm((f) => ({ ...f, showName: e.target.value }))} style={styles.input} />
          <input type="text" placeholder="Breed" value={addForm.breed} onChange={(e) => setAddForm((f) => ({ ...f, breed: e.target.value }))} style={styles.input} />
          <input type="text" placeholder="PCCI No." value={addForm.pcciNo} onChange={(e) => setAddForm((f) => ({ ...f, pcciNo: e.target.value }))} style={styles.input} />
          <input type="text" placeholder="Dog name" value={addForm.dogName} onChange={(e) => setAddForm((f) => ({ ...f, dogName: e.target.value }))} style={styles.input} />
          <input type="number" placeholder="Points" value={addForm.points} onChange={(e) => setAddForm((f) => ({ ...f, points: e.target.value }))} style={styles.input} />
          <input type="text" placeholder="Placement" value={addForm.placement} onChange={(e) => setAddForm((f) => ({ ...f, placement: e.target.value }))} style={styles.input} />
          <button type="submit" disabled={loading} style={styles.btn}>Add</button>
        </form>
      </section>

      <section style={{ background: "var(--surface)", borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <h2 style={{ margin: "0 0 16px", fontSize: "1.1rem" }}>Import from spreadsheet</h2>
        <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--muted)" }}>
          Paste from Google Sheets or CSV. Columns: showDate, showName, breed, pcciNo, dogName, points, placement.
        </p>
        <textarea
          placeholder="Paste here…"
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

      <section style={{ background: "var(--surface)", borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <h2 style={{ margin: "0 0 16px", fontSize: "1.1rem" }}>Extract from PCCI PDF</h2>
        <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--muted)" }}>
          Paste a PCCI result PDF URL. The app will try to extract breed, PCCI No., points, etc.
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
            {extractingUrl ? "Extracting…" : "Extract"}
          </button>
        </div>
        {extractMsg && <p style={{ margin: "12px 0 0", fontSize: 14, color: "var(--muted)" }}>{extractMsg}</p>}
      </section>

      {shows.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: "1.1rem" }}>Shows from PCCI (scrape & extract)</h2>
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
                {shows.map((s, i) => (
                  <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={styles.td}>{s.date}</td>
                    <td style={styles.td}>{s.club}</td>
                    <td style={styles.td}>{s.show}</td>
                    <td style={styles.td}>{s.resultUrl ? <a href={s.resultUrl} target="_blank" rel="noopener noreferrer">PDF</a> : "—"}</td>
                    <td style={styles.td}>
                      {s.resultUrl && (
                        <button type="button" onClick={() => handleExtractPdf(s.resultUrl, s.date, s.show)} disabled={extractingUrl !== null} style={{ ...styles.btn, padding: "6px 12px", fontSize: 13 }}>
                          {extractingUrl === s.resultUrl ? "…" : "Extract"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
