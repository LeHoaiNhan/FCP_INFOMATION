/**
 * Tải cờ SVG (4:3) cho 199 nước vào public/flags/<a2>.svg.
 * Nguồn: lipis/flag-icons (giấy phép MIT). Chạy lại là ghi đè.
 *
 *   node scripts/fetch-flags.mjs
 */
import fs from "node:fs";

const VER = "7.5.0";
const url = (a2) => `https://cdn.jsdelivr.net/gh/lipis/flag-icons@${VER}/flags/4x3/${a2}.svg`;

const nations = JSON.parse(
  fs.readFileSync(new URL("../data/nations.json", import.meta.url)),
);
const dir = new URL("../public/flags/", import.meta.url);
fs.mkdirSync(dir, { recursive: true });

let ok = 0;
const missing = [];
for (const n of nations) {
  if (!n.a2) { missing.push(n.code); continue; }
  const res = await fetch(url(n.a2));
  if (!res.ok) { missing.push(`${n.code}/${n.a2}`); continue; }
  const svg = await res.text();
  fs.writeFileSync(new URL(`${n.a2}.svg`, dir), svg);
  ok++;
  process.stdout.write(`\r  ${ok}/${nations.length}`);
}
console.log(`\n✓ ${ok} cờ` + (missing.length ? ` · thiếu: ${missing.join(", ")}` : ""));
