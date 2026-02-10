"use client";

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
