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
const promotionLockOwner = path.join(promotionLock, "owner.json");

function processIsAlive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === "EPERM") return true;
    if (error.code === "ESRCH") return false;
    throw error;
  }
}

async function acquirePromotionLock() {
  const token = `${process.pid}:${randomUUID()}`;
  for (let attempt = 0; attempt < 200; attempt += 1) {
    try {
      await mkdir(promotionLock);
      await writeFile(promotionLockOwner, JSON.stringify({ pid: process.pid, token }), "utf8");
      return token;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;

      let owner;
      try {
        owner = JSON.parse(await readFile(promotionLockOwner, "utf8"));
      } catch (ownerError) {
        if (ownerError.code !== "ENOENT" && !(ownerError instanceof SyntaxError)) throw ownerError;
        let age;
        try {
          age = Date.now() - (await stat(promotionLock)).mtimeMs;
        } catch (statError) {
          if (statError.code === "ENOENT") continue;
          throw statError;
        }
        if (age > 5_000) await rm(promotionLock, { recursive: true, force: true });
        await delay(25);
        continue;
      }

      if (!processIsAlive(owner.pid)) {
        await rm(promotionLock, { recursive: true, force: true });
        continue;
      }
      if (attempt === 199) throw new Error("Timed out waiting to publish website-main-dist");
      await delay(25);
    }
  }
  throw new Error("Unable to acquire website-main-dist promotion lock");
}

async function releasePromotionLock(token) {
  try {
    const owner = JSON.parse(await readFile(promotionLockOwner, "utf8"));
    if (owner.token === token) {
      await rm(promotionLock, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function promote(stagedDirectory) {
  const lockToken = await acquirePromotionLock();

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
    await releasePromotionLock(lockToken);
  }
}

// The Mission landing shares the site shell (app.css, app.js, motion layer), so the build
// keeps its resources and only pins the Netlify badge size to avoid layout shift.
function optimizeLandingDocument(document) {
  // The Mission page shares the site shell (nav, motion layer), so it keeps every
  // stylesheet and script it links. The build only sizes the Netlify badge.
  return document.replace(
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
  "motion-layer.css",
  "motion-layer.js",
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
