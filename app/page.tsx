"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import Link from "next/link";

type ShowResult = {
  id: string;
  showDate: string;
  showName: string;
  breed: string;
  pcciNo: string;
  dogName?: string;
  judge?: string;
  points: number;
  placement?: string;
};
type TallyRow = {
  pcciNo: string;
  dogName?: string;
  breed?: string;
  totalPoints: number;
  resultCount: number;
  results: ShowResult[];
};

function displayPcciNo(s: string | undefined): string {
  if (!s) return "—";
  return s.replace(/^,?\s*PCCISB\s*/i, "").trim() || s;
}

export default function Home() {
  const [results, setResults] = useState<ShowResult[]>([]);
  const [tally, setTally] = useState<TallyRow[]>([]);
  const [view, setView] = useState<"results" | "tally">("results");
  const [breed, setBreed] = useState("");
  const [breeds, setBreeds] = useState<string[]>([]);
  const [pcciNo, setPcciNo] = useState("");
  const [dogName, setDogName] = useState("");
  const [showDateFrom, setShowDateFrom] = useState("");
  const [showDateTo, setShowDateTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedTallyPcciNo, setExpandedTallyPcciNo] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/breeds")
      .then((r) => r.ok ? r.json() : [])
      .then((b) => setBreeds(Array.isArray(b) ? b : []))
      .catch(() => {});
  }, []);

  const runSearch = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (breed) params.set("breed", breed);
      if (pcciNo) params.set("pcciNo", pcciNo);
      if (dogName) params.set("dogName", dogName);
      if (showDateFrom) params.set("showDateFrom", showDateFrom);
      if (showDateTo) params.set("showDateTo", showDateTo);
      const res = await fetch(`/api/results?${params}`);
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [breed, pcciNo, dogName, showDateFrom, showDateTo]);

  const runTally = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("tally", "1");
      if (breed) params.set("breed", breed);
      if (pcciNo) params.set("pcciNo", pcciNo);
      if (dogName) params.set("dogName", dogName);
      if (showDateFrom) params.set("showDateFrom", showDateFrom);
      if (showDateTo) params.set("showDateTo", showDateTo);
      const res = await fetch(`/api/results?${params}`);
      const data = await res.json();
      setTally(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [breed, pcciNo, dogName, showDateFrom, showDateTo]);

  // Run initial search on load so the user sees results or a clear empty state
  useEffect(() => {
    runSearch();
    runTally();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = () => {
    if (view === "tally") runTally();
    else runSearch();
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <header style={{ marginBottom: 32, borderBottom: "1px solid var(--border)", paddingBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700 }}>
          PCCI Show Results
        </h1>
        <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: "0.95rem" }}>
          Search by breed, dog name, show date, or PCCI No. and tally points. Data from{" "}
          <a href="https://www.pcci.org.ph/shows/show-results/" target="_blank" rel="noopener noreferrer">
            PCCI Show Results
          </a>.
        </p>
        {results.length === 0 && tally.length === 0 && !loading && (
          <p style={{ margin: "12px 0 0", padding: 12, background: "var(--surface)", borderRadius: 8, fontSize: 14 }}>
            No results yet. Use the filters and click Search to load data. To add or import results, go to{" "}
            <Link href="/admin" style={{ color: "var(--accent)" }}>Data Admin</Link>.
          </p>
        )}
      </header>

      <section style={{ background: "var(--surface)", borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <h2 style={{ margin: "0 0 16px", fontSize: "1.1rem" }}>Search &amp; Tally</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Breed</span>
            <input
              type="text"
              list="breed-list"
              placeholder="e.g. Golden Retriever"
              value={breed}
              onChange={(e) => setBreed(e.target.value)}
              autoComplete="off"
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--bg)",
                width: 180,
              }}
            />
            <datalist id="breed-list">
              {breeds.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>PCCI No.</span>
            <input
              type="text"
              placeholder="Registration number"
              value={pcciNo}
              onChange={(e) => setPcciNo(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--bg)",
                width: 140,
              }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Dog name</span>
            <input
              type="text"
              placeholder="e.g. SAN LORENZO JAMBALAYA"
              value={dogName}
              onChange={(e) => setDogName(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--bg)",
                width: 180,
              }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>From date</span>
            <input
              type="date"
              value={showDateFrom}
              onChange={(e) => setShowDateFrom(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--bg)",
              }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>To date</span>
            <input
              type="date"
              value={showDateTo}
              onChange={(e) => setShowDateTo(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--bg)",
              }}
            />
          </label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              onClick={handleSearch}
              disabled={loading}
              style={{
                padding: "8px 20px",
                borderRadius: 8,
                border: "none",
                background: "var(--accent)",
                color: "white",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Loading…" : "Search"}
            </button>
            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input
                type="radio"
                name="view"
                checked={view === "results"}
                onChange={() => setView("results")}
              />
              Results
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input
                type="radio"
                name="view"
                checked={view === "tally"}
                onChange={() => setView("tally")}
              />
              Tally by PCCI No.
            </label>
          </div>
        </div>
      </section>

      {view === "results" && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: "1.1rem" }}>Results</h2>
          <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid var(--border)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface)" }}>
                  <th style={thStyle}>Show date</th>
                  <th style={thStyle}>Show</th>
                  <th style={thStyle}>Breed</th>
                  <th style={thStyle}>PCCI No.</th>
                  <th style={thStyle}>Dog name</th>
                  <th style={thStyle}>Judge</th>
                  <th style={thStyle}>Points</th>
                  <th style={thStyle}>Placement</th>
                </tr>
              </thead>
              <tbody>
                {results.length === 0 && !loading && (
                  <tr>
                    <td colSpan={8} style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>
                      No results. Use filters and click Search, or add data in{" "}
                      <Link href="/admin" style={{ color: "var(--accent)" }}>Data Admin</Link>.
                    </td>
                  </tr>
                )}
                {results.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={tdStyle}>{r.showDate}</td>
                    <td style={tdStyle}>{r.showName}</td>
                    <td style={tdStyle}>{r.breed}</td>
                    <td style={tdStyle}>{displayPcciNo(r.pcciNo)}</td>
                    <td style={tdStyle}>{r.dogName ?? "—"}</td>
                    <td style={tdStyle}>{r.judge ?? "—"}</td>
                    <td style={tdStyle}>{r.points}</td>
                    <td style={tdStyle}>{r.placement ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {view === "tally" && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: "1.1rem" }}>Points tally by PCCI No.</h2>
          <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid var(--border)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface)" }}>
                  <th style={thStyle}>PCCI No.</th>
                  <th style={thStyle}>Dog name</th>
                  <th style={thStyle}>Breed</th>
                  <th style={thStyle}>Total points</th>
                  <th style={thStyle}># results</th>
                </tr>
              </thead>
              <tbody>
                {tally.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>
                      No tally data. Add data in{" "}
                      <Link href="/admin" style={{ color: "var(--accent)" }}>Data Admin</Link>, then search with Tally.
                    </td>
                  </tr>
                )}
                {tally.map((t) => (
                  <Fragment key={t.pcciNo}>
                    <tr style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={tdStyle}>{displayPcciNo(t.pcciNo)}</td>
                      <td style={tdStyle}>{t.dogName ?? "—"}</td>
                      <td style={tdStyle}>{t.breed ?? "—"}</td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{t.totalPoints}</td>
                      <td style={tdStyle}>
                        <button
                          type="button"
                          onClick={() => setExpandedTallyPcciNo((prev) => (prev === t.pcciNo ? null : t.pcciNo))}
                          style={{
                            background: "none",
                            border: "none",
                            padding: 0,
                            font: "inherit",
                            color: "var(--accent)",
                            textDecoration: "underline",
                            cursor: "pointer",
                            fontWeight: 600,
                          }}
                        >
                          {t.resultCount}
                        </button>
                      </td>
                    </tr>
                    {expandedTallyPcciNo === t.pcciNo && t.results?.length > 0 && (
                      <tr style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
                        <td colSpan={5} style={{ ...tdStyle, paddingTop: 0, paddingBottom: 12, verticalAlign: "top" }}>
                          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>Shows that make up the total:</div>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead>
                              <tr>
                                <th style={{ ...thStyle, padding: "6px 8px" }}>Show date</th>
                                <th style={{ ...thStyle, padding: "6px 8px" }}>Show</th>
                                <th style={{ ...thStyle, padding: "6px 8px" }}>Judge</th>
                                <th style={{ ...thStyle, padding: "6px 8px" }}>Points</th>
                                <th style={{ ...thStyle, padding: "6px 8px" }}>Placement</th>
                              </tr>
                            </thead>
                            <tbody>
                              {t.results.map((r) => (
                                <tr key={r.id}>
                                  <td style={{ ...tdStyle, padding: "6px 8px" }}>{r.showDate}</td>
                                  <td style={{ ...tdStyle, padding: "6px 8px" }}>{r.showName}</td>
                                  <td style={{ ...tdStyle, padding: "6px 8px" }}>{r.judge ?? "—"}</td>
                                  <td style={{ ...tdStyle, padding: "6px 8px" }}>{r.points}</td>
                                  <td style={{ ...tdStyle, padding: "6px 8px" }}>{r.placement ?? "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <footer style={{ marginTop: 48, paddingTop: 16, borderTop: "1px solid var(--border)", textAlign: "center" }}>
        <Link href="/admin" style={{ fontSize: 13, color: "var(--muted)" }}>Data Admin</Link>
        {" · "}
        <a href="https://www.pcci.org.ph/shows/show-results/" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "var(--muted)" }}>
          PCCI Show Results
        </a>
      </footer>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "12px 16px",
  textAlign: "left",
  fontWeight: 600,
  fontSize: 12,
  textTransform: "uppercase",
  color: "var(--muted)",
};
const tdStyle: React.CSSProperties = {
  padding: "12px 16px",
  fontSize: 14,
};
const inputStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg)",
};
const btnStyle: React.CSSProperties = {
  padding: "8px 20px",
  borderRadius: 8,
  border: "none",
  background: "var(--accent)",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
};
