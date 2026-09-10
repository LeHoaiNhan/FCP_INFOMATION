/**
 * Dựng lại data/requirements.json + data/nations.json từ nguồn gốc.
 * Chạy khi passport-index-dataset ra bản cập nhật:
 *
 *   node scripts/build-data.mjs
 *
 * data/geo.json (hình học bản đồ) KHÔNG đụng tới — nó ổn định, đã có sẵn iso3.
 */
import fs from "node:fs";

const SRC = {
  tidyIso: "https://raw.githubusercontent.com/ilyankou/passport-index-dataset/master/passport-index-tidy-iso3.csv",
  tidyName: "https://raw.githubusercontent.com/ilyankou/passport-index-dataset/master/passport-index-tidy.csv",
  iso: "https://raw.githubusercontent.com/lukes/ISO-3166-Countries-with-Regional-Codes/master/all/all.csv",
};

function parseCSV(text) {
  const rows = [];
  let cur = "", row = [], q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else if (c !== "\r") cur += c;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

const get = (u) => fetch(u).then((r) => {
  if (!r.ok) throw new Error(`${r.status} ${u}`);
  return r.text();
});

const [tidyIso, tidyName, isoCsv] = await Promise.all([
  get(SRC.tidyIso), get(SRC.tidyName), get(SRC.iso),
]);

// ISO alpha-3 -> official English name (fallback tên hiển thị)
const iso = parseCSV(isoCsv);
const iA3 = iso[0].indexOf("alpha-3"), iNm = iso[0].indexOf("name");
const isoName = {};
for (let i = 1; i < iso.length; i++) if (iso[i][iA3]) isoName[iso[i][iA3]] = iso[i][iNm];

const enc = {
  "visa required": "R", "visa on arrival": "O", "e-visa": "E",
  eta: "T", "visa free": "F", "no admission": "N", "-1": "H",
};

const rowsIso = parseCSV(tidyIso).slice(1).filter((r) => r.length >= 3);
const rowsNm = parseCSV(tidyName).slice(1).filter((r) => r.length >= 3);

const matrix = {};
const dispName = {};
for (let i = 0; i < rowsIso.length; i++) {
  const [p, d, r] = rowsIso[i];
  (matrix[p] ||= {})[d] = enc[r] ?? r; // số ngày giữ nguyên
  dispName[p] = rowsNm[i][0];
}

const nations = Object.keys(matrix)
  .sort()
  .map((code) => ({ code, name: dispName[code] || isoName[code] || code }))
  .sort((a, b) => a.name.localeCompare(b.name));

const out = new URL("../data/", import.meta.url);
fs.writeFileSync(new URL("requirements.json", out), JSON.stringify(matrix));
fs.writeFileSync(new URL("nations.json", out), JSON.stringify(nations, null, 1));

console.log(`✓ ${nations.length} nations · ${rowsIso.length} cặp (passport×destination)`);
