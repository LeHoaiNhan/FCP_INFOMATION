/**
 * Seed bảng nations + requirements từ data/*.json lên Supabase.
 * CHƯA DÙNG. Khi sẵn sàng:
 *
 *   npm i @supabase/supabase-js
 *   # điền NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY vào .env.local
 *   node --env-file=.env.local scripts/seed-supabase.mjs
 *
 * Chạy lại nhiều lần được (upsert theo khoá chính).
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Thiếu NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const read = (p) => JSON.parse(fs.readFileSync(new URL(`../data/${p}`, import.meta.url)));
const nations = read("nations.json");
const matrix = read("requirements.json");

const DEC = { F: ["free", null], T: ["eta", null], E: ["evisa", null], O: ["voa", null], R: ["visa", null], N: ["noadmission", null], H: ["home", null] };
const decode = (c) => (/^\d+$/.test(c) ? ["free", parseInt(c, 10)] : (DEC[c] ?? ["nodata", null]));

const rows = [];
for (const passport of Object.keys(matrix)) {
  for (const [destination, raw] of Object.entries(matrix[passport])) {
    const [tier, stay] = destination === passport ? ["home", null] : decode(raw);
    rows.push({ passport, destination, tier, stay, fee: null, processing: null });
  }
}

console.log(`nations: ${nations.length} · requirements: ${rows.length}`);

let e1 = (await db.from("nations").upsert(nations, { onConflict: "code" })).error;
if (e1) throw e1;

for (let i = 0; i < rows.length; i += 1000) {
  const chunk = rows.slice(i, i + 1000);
  const { error } = await db
    .from("requirements")
    .upsert(chunk, { onConflict: "passport,destination" });
  if (error) throw error;
  process.stdout.write(`\r  ${Math.min(i + 1000, rows.length)}/${rows.length}`);
}
console.log("\n✓ xong");
