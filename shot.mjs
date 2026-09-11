import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
});
const errors = [];

async function shoot(name, url, viewport, after) {
  const page = await browser.newPage({ viewport });
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(`${name}: ${msg.text()}`); });
  page.on("pageerror", (err) => errors.push(`${name}: ${err}`));
  await page.goto(url, { waitUntil: "networkidle" });
  if (after) await after(page);
  await page.screenshot({ path: name, fullPage: false });
  await page.close();
}

// pick "Tất cả các hộ chiếu" in the Hộ chiếu combobox
async function chooseAllPassport(page) {
  await page.locator(".combo-btn", { hasText: "Vietnam" }).click();
  await page.click('.combo-opt:has-text("Tất cả các hộ chiếu")');
  await page.waitForTimeout(300);
}

await shoot("e1-all-passport-no-dest.png", "http://localhost:3000/", { width: 1440, height: 900 }, async (page) => {
  await chooseAllPassport(page);
});

await shoot("e2-all-passport-with-dest.png", "http://localhost:3000/", { width: 1440, height: 900 }, async (page) => {
  await chooseAllPassport(page);
  await page.locator(".combo-btn", { hasText: "Tất cả các nước" }).click();
  await page.fill(".combo-search", "Japan");
  await page.click('.combo-opt:has-text("Japan")');
  await page.waitForTimeout(300);
});

console.log("CONSOLE_ERRORS:", JSON.stringify(errors));
await browser.close();
