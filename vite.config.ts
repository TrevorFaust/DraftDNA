import fs from "fs";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const publicDir = path.resolve(__dirname, "public");
const faviconPng = path.join(publicDir, "dna_image.png");
const faviconIco = path.join(publicDir, "favicon.ico");
/** Google often requests /favicon.ico; mirror the PNG so SERP icons match your DNA mark. */
function syncFaviconIcoFromPng() {
  try {
    if (fs.existsSync(faviconPng)) {
      fs.copyFileSync(faviconPng, faviconIco);
    }
  } catch (e) {
    console.warn("[vite] Could not copy dna_image.png → favicon.ico:", e);
  }
}

syncFaviconIcoFromPng();

const SEO_PATHS = [
  "/",
  "/rankings",
  "/players",
  "/statistics",
  "/mock-draft",
  "/prediction-challenge",
  "/badges",
] as const;

function siteOriginFromEnv(mode: string, envDir: string): string | undefined {
  const env = loadEnv(mode, envDir, "");
  const raw = env.VITE_SITE_URL?.trim();
  if (!raw) return undefined;
  return raw.replace(/\/+$/, "");
}

function absoluteSeoHeadPlugin(mode: string, envDir: string): Plugin {
  return {
    name: "absolute-seo-head",
    transformIndexHtml(html) {
      const origin = siteOriginFromEnv(mode, envDir);
      if (!origin) return html;

      const image = `${origin}/dna_image.png`;
      const websiteLd = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "Draft DNA",
        alternateName: ["DraftDNA", "Draft DNA Fantasy Football"],
        url: `${origin}/`,
        description:
          "Custom NFL fantasy rankings, mock drafts, player stats, draft badges, and the Pick Six challenge with up to $30,000 in prizes.",
      };

      const block = `
    <link rel="canonical" href="${origin}/" />
    <meta property="og:url" content="${origin}/" />
    <meta property="og:image" content="${image}" />
    <meta name="twitter:image" content="${image}" />
    <script type="application/ld+json">${JSON.stringify(websiteLd)}</script>`;

      return html.replace("</head>", `${block}\n  </head>`);
    },
  };
}

function distSitemapAndRobotsPlugin(mode: string, envDir: string): Plugin {
  return {
    name: "dist-sitemap-robots",
    closeBundle() {
      const origin = siteOriginFromEnv(mode, envDir);
      const distDir = path.resolve(__dirname, "dist");
      if (!origin) {
        console.warn(
          "[vite] VITE_SITE_URL is not set — skipping sitemap.xml and Sitemap: line in dist/robots.txt (set in production for SEO)."
        );
        return;
      }
      if (!fs.existsSync(distDir)) return;

      const lastmod = new Date().toISOString().slice(0, 10);
      const urls = SEO_PATHS.map(
        (p) =>
          `  <url>\n    <loc>${origin}${p === "/" ? "/" : p}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n  </url>`
      ).join("\n");
      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
      fs.writeFileSync(path.join(distDir, "sitemap.xml"), sitemap, "utf8");

      const robotsPath = path.join(distDir, "robots.txt");
      let robots = "";
      if (fs.existsSync(robotsPath)) {
        robots = fs.readFileSync(robotsPath, "utf8").trimEnd();
      } else {
        robots = `User-agent: *\nAllow: /`;
      }
      if (!robots.includes("Sitemap:")) {
        robots += `\n\nSitemap: ${origin}/sitemap.xml\n`;
        fs.writeFileSync(robotsPath, robots, "utf8");
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const envDir = path.resolve(__dirname);
  if (mode === "development") {
    const env = loadEnv(mode, envDir, "");
    if (!env.VITE_SYNC_ADMIN_USER_ID?.trim()) {
      console.warn(
        "\n[vite] VITE_SYNC_ADMIN_USER_ID is missing from .env on disk. Save .env in the project root (next to package.json) and restart the dev server.\n"
      );
    }
  }
  return {
    envDir,
    server: {
      host: true, // Allows access from all network interfaces, including localhost
      port: 8080,
    },
    plugins: [
      react(),
      absoluteSeoHeadPlugin(mode, envDir),
      distSitemapAndRobotsPlugin(mode, envDir),
      mode === "development" && componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
