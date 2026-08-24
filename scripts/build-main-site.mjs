import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outDir = path.join(repoRoot, "website-main-dist");

function optimizeLandingDocument(document) {
  const removableResources = [
    /\n    <link\n      rel="stylesheet"\n      href="https:\/\/fonts\.googleapis\.com\/css2\?family=Inter:wght@400;500;600;700;800&family=JetBrains\+Mono:wght@400;600&display=swap"\n    \/>/,
    /\n    <link rel="stylesheet" href="\.\/app\.css" \/>/,
    /\n    <link rel="stylesheet" href="\.\/app-polish\.css\?v=20260609-overflow" \/>/,
    /\n    <script src="\.\/site-config\.js"><\/script>/,
    /\n    <script src="\.\/app\.js" type="module"><\/script>/,
    /\n    <script src="\.\/site-polish\.js" type="module"><\/script>/,
  ];

  return removableResources.reduce((result, resource) => {
    if (!resource.test(result)) throw new Error(`Landing resource was not found: ${resource}`);
    return result.replace(resource, "");
  }, document).replace(
    'src="https://www.netlify.com/assets/badges/netlify-badge-color-accent.svg"',
    'src="https://www.netlify.com/assets/badges/netlify-badge-color-accent.svg" width="114" height="32"'
  );
}

const copyList = [
  "index.html",
  "404.html",
  "app.css",
  "app-polish.css",
  "app.js",
  "api.js",
  "app-store.html",
  "app-store.js",
  "app-store-catalog.json",
  "landing.css",
  "landing-script.js",
  "roachclaw.js",
  "roachclaw-web.css",
  "router.js",
  "site-account.js",
  "site-config.js",
  "site-polish.js",
  "robots.txt",
  "sitemap.xml",
  "apple-touch-icon.png",
  "favicon.ico",
  "favicon-16x16.png",
  "favicon-32x32.png",
  "api",
  "assets",
  "brew",
  "collections",
  "downloads",
  "home",
  "ios",
  "roachclaw",
  "sitemap",
];

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

for (const entry of copyList) {
  const source = path.join(repoRoot, entry);
  const destination = path.join(outDir, entry);
  await cp(source, destination, { recursive: true });
}

const mainIndex = path.join(outDir, "index.html");
await writeFile(mainIndex, optimizeLandingDocument((await readFile(mainIndex, "utf8"))
  .replace('data-landing-shortcut aria-label', 'data-landing-shortcut role="group" aria-label')), "utf8");

console.log(`Built main site into ${outDir}`);
