/* ---------------------------------------------------------------------------------------
   Makes the PNG icons of the app from icons/icon.svg (run it again if you change the SVG).

     icons/icon-192.png            Android, browser tab
     icons/icon-512.png            Android splash screen
     icons/icon-maskable-512.png   Android icon in a circle or a squircle (drawing smaller,
                                   so nothing important is cut off)
     icons/apple-touch-icon.png    iPhone home screen (180 x 180)

   Usage (from the folder of the repository):  node scripts/make_icons.cjs
   Needs Node.js and Playwright (npm install playwright, then npx playwright install chromium).
   --------------------------------------------------------------------------------------- */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const svg = fs.readFileSync(path.join(ROOT, "icons", "icon.svg"), "utf8");

// For the maskable icon, the drawing is shrunk to 80 % around the centre.
const maskable = svg.replace(/<rect width="512" height="512" fill="url\(#glow\)"\/>([\s\S]*)<\/svg>/,
  (all, art) => `<rect width="512" height="512" fill="url(#glow)"/><g transform="translate(51.2 51.2) scale(0.8)">${art}</g></svg>`);

const targets = [
  ["icon-192.png", svg, 192],
  ["icon-512.png", svg, 512],
  ["icon-maskable-512.png", maskable, 512],
  ["apple-touch-icon.png", svg, 180],
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const [name, source, size] of targets) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0">${source.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
    await page.screenshot({ path: path.join(ROOT, "icons", name), clip: { x: 0, y: 0, width: size, height: size } });
    console.log("icons/" + name);
  }
  await browser.close();
})();
