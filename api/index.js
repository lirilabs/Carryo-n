from pathlib import Path
import shutil, textwrap

root = Path("/mnt/data/carryon-vercel-launcher")
if root.exists():
    shutil.rmtree(root)
root.mkdir(parents=True)

server_js = r'''/**
 * Carryon Dynamic URL Launcher
 * Vercel Serverless Function
 *
 * Stable URLs:
 *   /carryon
 *   /carryon/download
 *   /carryon/download/arm64
 *   /carryon/download/armeabi-v7a
 *   /carryon/download/x86_64
 *   /carryon/download/universal
 *
 * API:
 *   /api/carryon/release
 *
 * The latest stable GitHub release is used automatically.
 */

const APPS = {
  carryon: {
    name: "Carryon",
    owner: "sanjay434343",
    repo: "Carryon",

    // Used by /carryon and /carryon/download
    defaultAsset: "app-release.apk",

    // Architecture -> GitHub release asset
    assets: {
      arm64: "app-arm64-v8a-release.apk",
      "armeabi-v7a": "app-armeabi-v7a-release.apk",
      x86_64: "app-x86_64-release.apk",
      universal: "app-release.apk"
    }
  }
};

// Vercel functions are stateless. This cache is only an optimization.
// A new serverless instance may fetch GitHub immediately.
const cache = new Map();
const CACHE_MS = 5 * 60 * 1000;

function json(res, status, data) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.send(JSON.stringify(data, null, 2));
}

async function getLatestRelease(app) {
  const cached = cache.get(app);

  if (cached && Date.now() - cached.time < CACHE_MS) {
    return cached.data;
  }

  const url =
    `https://api.github.com/repos/${encodeURIComponent(app.owner)}/` +
    `${encodeURIComponent(app.repo)}/releases/latest`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "carryon-vercel-launcher"
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API returned ${response.status}: ${body}`);
  }

  const release = await response.json();

  if (release.draft || release.prerelease) {
    throw new Error("Latest GitHub release is not a stable release.");
  }

  const assets = {};

  for (const asset of release.assets || []) {
    assets[asset.name] = {
      name: asset.name,
      url: asset.browser_download_url,
      size: asset.size,
      sha256: asset.digest || null,
      downloadCount: asset.download_count
    };
  }

  const result = {
    app: "carryon",
    name: app.name,
    version: release.tag_name,
    releaseName: release.name,
    releaseUrl: release.html_url,
    publishedAt: release.published_at,
    assets
  };

  cache.set(app, {
    time: Date.now(),
    data: result
  });

  return result;
}

function findAsset(release, app, architecture) {
  const filename = architecture
    ? app.assets[architecture]
    : app.defaultAsset;

  if (!filename) {
    return null;
  }

  return release.assets[filename] || null;
}

function getPath(req) {
  // Vercel can provide req.url with query parameters.
  return new URL(req.url, `https://${req.headers.host || "localhost"}`).pathname;
}

module.exports = async (req, res) => {
  const path = getPath(req);

  // ------------------------------------------------------------
  // Health / home
  // ------------------------------------------------------------
  if (path === "/" || path === "") {
    return json(res, 200, {
      service: "Carryon Dynamic URL Launcher",
      status: "ok",
      version: "1.0.0",
      routes: [
        "/carryon",
        "/carryon/download",
        "/carryon/download/arm64",
        "/carryon/download/armeabi-v7a",
        "/carryon/download/x86_64",
        "/carryon/download/universal",
        "/api/carryon/release"
      ]
    });
  }

  // ------------------------------------------------------------
  // Release API
  // ------------------------------------------------------------
  if (path === "/api/carryon/release") {
    try {
      const app = APPS.carryon;
      const release = await getLatestRelease(app);

      return json(res, 200, release);
    } catch (error) {
      console.error(error);

      return json(res, 502, {
        error: "Unable to fetch latest GitHub release",
        message: error.message
      });
    }
  }

  // ------------------------------------------------------------
  // Match Carryon routes
  // ------------------------------------------------------------
  const match = path.match(
    /^\/carryon(?:\/download(?:\/([^/]+))?)?$/
  );

  if (!match) {
    return json(res, 404, {
      error: "Route not found"
    });
  }

  const architecture = match[1] || null;
  const app = APPS.carryon;

  // Validate architecture before calling GitHub.
  if (architecture && !app.assets[architecture]) {
    return json(res, 404, {
      error: "Unknown APK architecture",
      requested: architecture,
      available: Object.keys(app.assets)
    });
  }

  try {
    const release = await getLatestRelease(app);
    const asset = findAsset(release, app, architecture);

    if (!asset) {
      return json(res, 404, {
        error: "APK not found in latest GitHub release",
        version: release.version,
        requestedArchitecture: architecture || "default",
        expectedAsset: architecture
          ? app.assets[architecture]
          : app.defaultAsset
      });
    }

    // 302 makes the stable Vercel URL redirect to the actual
    // GitHub release asset.
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Location", asset.url);

    return res.status(302).send(
      `Redirecting to Carryon ${release.version}`
    );
  } catch (error) {
    console.error(error);

    return json(res, 502, {
      error: "Unable to resolve latest Carryon release",
      message: error.message
    });
  }
};
'''

vercel_json = r'''{
  "version": 2,
  "functions": {
    "api/index.js": {
      "runtime": "nodejs22.x"
    }
  },
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/api"
    }
  ]
}
'''

package_json = r'''{
  "name": "carryon-vercel-launcher",
  "version": "1.0.0",
  "private": true,
  "description": "Dynamic Carryon GitHub release URL launcher for Vercel",
  "scripts": {
    "dev": "vercel dev"
  },
  "engines": {
    "node": ">=18"
  }
}
'''

gitignore = r'''node_modules
.vercel
.env
.env.local
'''

readme = r'''# Carryon Dynamic URL Launcher — Vercel

This project turns stable Vercel URLs into dynamic links to the latest stable
Carryon GitHub release.

## GitHub source

Repository:

https://github.com/sanjay434343/Carryon

The server uses:

```text
https://api.github.com/repos/sanjay434343/Carryon/releases/latest
