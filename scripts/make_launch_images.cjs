/* ---------------------------------------------------------------------------------------
   Makes the iPhone launch images (apple-touch-startup-image): what an iPhone shows for a
   moment while the installed app opens. It is the Bienvenue screen without its button,
   so the opening looks seamless.

     icons/launch/launch-<width>x<height>.png   one per iPhone screen size (in pixels)
     index.html                                  the <link> lines between the markers
                                                 « launch-images:start » and « :end »

   Usage (from the folder of the repository):  node scripts/make_launch_images.cjs
   Needs Node.js and Playwright (npm install playwright, then npx playwright install chromium).
   Run it again when the Bienvenue screen or the illustration (img/baie-aube.svg) changes,
   or to add a new iPhone size to the list below.
   Android doesn't need it: its launch screen uses the manifest's background colour.
   --------------------------------------------------------------------------------------- */
const fs = require("fs");
const path = require("path");
const http = require("http");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "icons", "launch");

// iPhone screens in points (CSS pixels), their pixel ratio, and the height of their
// status bar (since Phase 4 the app draws under it: the sky goes to the very top, and the
// title sits below the bar, as on the real Bienvenue screen).
const DEVICES = [
  { w: 440, h: 956, r: 3, bar: 62, name: "iPhone 16 Pro Max, 17 Pro Max" },
  { w: 430, h: 932, r: 3, bar: 54, name: "iPhone 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus" },
  { w: 428, h: 926, r: 3, bar: 47, name: "iPhone 12 Pro Max, 13 Pro Max, 14 Plus" },
  { w: 420, h: 912, r: 3, bar: 62, name: "iPhone Air" },
  { w: 414, h: 896, r: 3, bar: 44, name: "iPhone XS Max, 11 Pro Max" },
  { w: 414, h: 896, r: 2, bar: 48, name: "iPhone XR, 11" },
  { w: 402, h: 874, r: 3, bar: 62, name: "iPhone 16 Pro, 17, 17 Pro" },
  { w: 393, h: 852, r: 3, bar: 54, name: "iPhone 14 Pro, 15, 15 Pro, 16" },
  { w: 390, h: 844, r: 3, bar: 47, name: "iPhone 12, 13, 14, 16e" },
  { w: 375, h: 812, r: 3, bar: 44, name: "iPhone X, XS, 11 Pro, 12 mini, 13 mini" },
  { w: 375, h: 667, r: 2, bar: 20, name: "iPhone SE, 8" },
];

/** A tiny web server for the repository (the app needs one to load its files). */
function serve() {
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml",
    ".json": "application/json", ".woff2": "font/woff2", ".png": "image/png", ".webmanifest": "application/manifest+json" };
  const server = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(req.url.split("?")[0].split("#")[0]).replace(/^\/$/, "/index.html"));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const links = [];
  for (const d of DEVICES) {
    const page = await browser.newPage({
      viewport: { width: d.w, height: d.h }, deviceScaleFactor: d.r, colorScheme: "light", reducedMotion: "reduce",
      serviceWorkers: "block", locale: "fr-FR",
    });
    await page.goto(base + "#accueil");                       // a new phone: the welcome shows
    await page.waitForSelector(".wl-scene.is-ready");
    await page.addStyleTag({ content: `
      html, body { background: #F3F7FA !important; }
      .app { visibility: hidden !important; }
      :root { --safe-top: ${d.bar}px !important; }
      .wl-cta .btn { visibility: hidden !important; }` });
    await page.waitForTimeout(400);
    const file = `launch-${d.w * d.r}x${d.h * d.r}.png`;
    await page.screenshot({ path: path.join(OUT, file), type: "png" });
    await page.close();
    links.push(`  <link rel="apple-touch-startup-image" href="icons/launch/${file}" media="(device-width: ${d.w}px) and (device-height: ${d.h}px) and (-webkit-device-pixel-ratio: ${d.r}) and (orientation: portrait)">`);
    console.log("icons/launch/" + file, " ", d.name);
  }
  await browser.close();
  server.close();

  // Write the <link> lines in index.html, between the two markers.
  const indexFile = path.join(ROOT, "index.html");
  const html = fs.readFileSync(indexFile, "utf8");
  const updated = html.replace(/(<!-- launch-images:start -->)[\s\S]*?(\s*<!-- launch-images:end -->)/, `$1\n${links.join("\n")}$2`);
  fs.writeFileSync(indexFile, updated);
  console.log("index.html: " + links.length + " launch images");
})();
