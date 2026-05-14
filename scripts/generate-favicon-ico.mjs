/**
 * Writes a real multi-resolution ICO to public/favicon.ico from public/dna_image.png.
 * Uses Sharp for resizing so alpha is preserved (to-ico's resize path uses Jimp and often
 * flattens transparency onto white). Google needs a valid ICO, not a renamed PNG.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import toIco from "to-ico";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const pngPath = path.join(root, "public", "dna_image.png");
const icoPath = path.join(root, "public", "favicon.ico");

if (!fs.existsSync(pngPath)) {
  console.warn("[favicon] public/dna_image.png missing — skipping favicon.ico generation.");
  process.exit(0);
}

const sizes = [16, 32, 48];
const buffers = await Promise.all(
  sizes.map((size) =>
    sharp(pngPath)
      .ensureAlpha()
      .resize(size, size, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer()
  )
);

const ico = await toIco(buffers);
fs.writeFileSync(icoPath, ico);
console.log("[favicon] wrote public/favicon.ico (alpha-safe ICO from dna_image.png, 16/32/48)");
