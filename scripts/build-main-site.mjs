import { randomUUID } from "node:crypto";
import { cp, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outDir = path.join(repoRoot, "website-main-dist");
const stagingDir = path.join(repoRoot, `.website-main-dist-${process.pid}-${randomUUID()}`);
const previousDir = path.join(repoRoot, `.website-main-dist-previous-${process.pid}-${randomUUID()}`);
const promotionLock = path.join(repoRoot, ".website-main-dist.lock");

async function promote(stagedDirectory) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    try {
      await mkdir(promotionLock);
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      let age;
      try {
        age = Date.now() - (await stat(promotionLock)).mtimeMs;
      } catch (statError) {
        if (statError.code === "ENOENT") continue;
        throw statError;
      }
      if (age > 300_000) {
        await rm(promotionLock, { recursive: true, force: true });
        continue;
      }
      if (attempt === 199) throw new Error("Timed out waiting to publish website-main-dist");
      await delay(25);
    }
  }

  let hadPrevious = false
  try {
    try {
      await rename(outDir, previousDir);
      hadPrevious = true;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }

    try {
      await rename(stagedDirectory, outDir);
    } catch (error) {
      if (hadPrevious) await rename(previousDir, outDir);
      throw error;
    }

    if (hadPrevious) await rm(previousDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
  } finally {
    await rm(promotionLock, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
  }
}

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

await rm(stagingDir, { recursive: true, force: true });
await mkdir(stagingDir, { recursive: true });

try {
  for (const entry of copyList) {
    const source = path.join(repoRoot, entry);
    const destination = path.join(stagingDir, entry);
    await cp(source, destination, { recursive: true });
  }

  const mainIndex = path.join(stagingDir, "index.html");
  await writeFile(mainIndex, optimizeLandingDocument((await readFile(mainIndex, "utf8"))
    .replace('data-landing-shortcut aria-label', 'data-landing-shortcut role="group" aria-label')), "utf8");

  await promote(stagingDir);
} catch (error) {
  await rm(stagingDir, { recursive: true, force: true });
  throw error;
}

console.log(`Built main site into ${outDir}`);
