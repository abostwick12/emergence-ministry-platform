import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultSource = "C:\\Users\\awbostwick\\Desktop\\Scripture in new frontiers writeup\\scripture-in-new-frontiers-demo.mp4";
const source = process.env.SCRIPTURE_FRONTIERS_SOURCE ?? defaultSource;
const targetDir = path.join(repoRoot, "public", "scripture-frontiers");
const target = path.join(targetDir, "source.mp4");

await mkdir(targetDir, { recursive: true });
const sourceStat = await stat(source);
await copyFile(source, target);

console.log(`Prepared scripture-frontiers/source.mp4 from ${source} (${sourceStat.size} bytes).`);
