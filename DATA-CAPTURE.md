# Capturing Data from PCCI

PCCI publishes show results as **PDF files** on their [Show Results](https://www.pcci.org.ph/shows/show-results/) page. The app extracts data from PDFs **in your browser** (so it works on Vercel and other hosted environments).

## How to populate your database

### 1. Go to Data Admin

Open **`/admin`** on your deployed app (e.g. `https://your-app.vercel.app/admin`).

---

### 2. Extract from PCCI PDFs (recommended)

The admin page lists shows from the PCCI website with **Extract** buttons.

**Steps:**

1. Scroll to **"Shows from PCCI (scrape & extract)"**.
2. Find the show you want and click **Extract** on that row.  
   The app fetches the PDF and tries to parse breed, PCCI No., points, etc.
3. If extraction works: you’ll see something like **"Imported X results from PDF."**
4. If it fails: use **Add single result** or **Import from spreadsheet** (below).

**Alternative:** Use the **Extract from PCCI PDF** section above the table:
- Paste a PDF URL (e.g. from a PCCI result PDF link).
- Fill in **Show date** and **Show name**.
- Click **Extract**.

---

### 3. Import from your spreadsheet

If you already track results in Google Sheets:

1. In Sheets, select and copy the rows (with headers).
2. In Admin, go to **Import from spreadsheet**.
3. Paste into the text area. Column order:  
   `showDate`, `showName`, `breed`, `pcciNo`, `dogName`, `points`, `placement`
4. Click **Import**.

---

### 4. Add single results

For manual entry:
- Use the **Add single result** form.
- Breed autocomplete shows existing breeds as you type.
- Click **Add** for each result.

---

## After data is loaded

1. Open the **public search page** (`/`).
2. Use **Search** with filters (breed, PCCI No., date range).
3. Switch to **Tally by PCCI No.** to see total points per dog.
4. The **Breed** field has autocomplete based on breeds already in your data.

---

## Notes

- **Extract from PDF** only works if the PDF layout is readable. If a PDF fails, add results manually or via import.
- Breed autocomplete appears after there are results in your database.
- New data is stored in Supabase and persists across deploys.
