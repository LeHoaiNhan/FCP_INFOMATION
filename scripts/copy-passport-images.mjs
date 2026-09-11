// Sao chép ảnh bìa hộ chiếu (images_watermark/) vào public/, đổi tên theo mã
// ISO3 để khớp data/nations.json, và ghi data/passport-covers.json = danh
// sách mã hộ chiếu đang có ảnh. Chạy lại khi thêm/bớt ảnh trong images_watermark/.
//
//   node scripts/copy-passport-images.mjs

import { readdirSync, readFileSync, mkdirSync, copyFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC_FULL = join(ROOT, "images_watermark");
const SRC_THUMB = join(ROOT, "images_watermark", "small_watermark");
const OUT_FULL = join(ROOT, "public", "passports", "full");
const OUT_THUMB = join(ROOT, "public", "passports", "thumb");

// Vài tên file lệch với data/nations.json (dataset dùng tên khác).
const NAME_ALIASES = { Turkiye: "Turkey" };

const nations = JSON.parse(readFileSync(join(ROOT, "data", "nations.json"), "utf8"));
const codeByName = new Map(nations.map((n) => [n.name, n.code]));

mkdirSync(OUT_FULL, { recursive: true });
mkdirSync(OUT_THUMB, { recursive: true });

const covers = [];
for (const file of readdirSync(SRC_FULL)) {
  if (!file.endsWith(".png") || !file.startsWith("vuvgo_")) continue;
  const rawName = file.slice("vuvgo_".length, -".png".length);
  const name = NAME_ALIASES[rawName.replace(/_/g, " ")] ?? rawName.replace(/_/g, " ");
  const code = codeByName.get(name);
  if (!code) {
    console.warn(`Bỏ qua "${file}" — không khớp nước nào trong data/nations.json`);
    continue;
  }
  copyFileSync(join(SRC_FULL, file), join(OUT_FULL, `${code}.png`));
  copyFileSync(
    join(SRC_THUMB, `vuvgo_thumbnail_${rawName}.png`),
    join(OUT_THUMB, `${code}.png`),
  );
  covers.push(code);
}

covers.sort();
writeFileSync(
  join(ROOT, "data", "passport-covers.json"),
  JSON.stringify(covers, null, 1) + "\n",
);

console.log(`Đã chép ${covers.length} ảnh bìa hộ chiếu vào public/passports/.`);
