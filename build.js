import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetDir = path.join(__dirname, "public");

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Copy all necessary files for the frontend
const filesToCopy = [
  "index.html",
  "style.css",
  "game.js",
  "metadata.json"
];

// Add all PNG sprite image files
const allFiles = fs.readdirSync(__dirname);
allFiles.forEach(file => {
  if (file.endsWith(".png") || file.endsWith(".svg") || file.endsWith(".ico") || file.endsWith(".webmanifest")) {
    filesToCopy.push(file);
  }
});

filesToCopy.forEach(file => {
  const src = path.join(__dirname, file);
  const dest = path.join(targetDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
});

console.log(`Successfully built ${filesToCopy.length} assets into /public for Vercel deployment!`);
