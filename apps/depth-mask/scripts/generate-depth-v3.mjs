import { existsSync } from "node:fs";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import Replicate from "replicate";
import sharp from "sharp";

const MODEL =
  "david20321/depth-anything-v3-metric-large:e3523ab17a5e6f0e279933a6afdde67efe130bb9e7753cafc52a4b082257f46b";
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const APP_DIR = join(SCRIPT_DIR, "..");
const ASSET_DIR = join(APP_DIR, "public", "3d");
const METADATA_PATH = join(SCRIPT_DIR, "depth-v3-metric-metadata.json");

const images = [
  "angel",
  "castle",
  "ginza",
  "isla",
  "mallorca",
  "osaka",
  "tokyo",
].map((name) => ({
  name,
  input: join(ASSET_DIR, `${name}_400.jpg`),
  output: join(ASSET_DIR, `${name}-depth-v3-metric_400.png`),
}));

dotenv.config({ path: join(APP_DIR, ".env.local"), quiet: true });

const auth = process.env.REPLICATE_KEY;
if (!auth) {
  throw new Error(
    "REPLICATE_KEY is missing. Add it to apps/depth-mask/.env.local.",
  );
}

const force = process.argv.includes("--force");
const resume = process.argv.includes("--resume");
const existingOutputs = images.filter(({ output }) => existsSync(output));

if (existingOutputs.length && !force && !resume) {
  const filenames = existingOutputs.map(({ output }) =>
    output.split("/").at(-1),
  );
  throw new Error(
    `Refusing to overwrite existing V3 output(s): ${filenames.join(", ")}. Re-run with --force to replace them.`,
  );
}

const replicate = new Replicate({ auth, useFileOutput: false });
const metadata = JSON.parse(await readFile(METADATA_PATH, "utf8"));
const pendingImages = resume
  ? images.filter(({ output }) => !existsSync(output))
  : images;

for (const { name, input, output } of pendingImages) {
  const filename = input.split("/").at(-1);
  console.log(`Generating depth for ${filename}...`);

  const image = await readFile(input);
  const prediction = await runWithRateLimitRetry(() =>
    replicate.run(MODEL, {
      input: {
        image,
        focal_length_px: 0,
        max_process_res: 0,
        return_raw_depth: false,
        include_base64: false,
      },
    }),
  );

  const rawPng = await readDepthPng(prediction);
  validateDepthPng(rawPng);
  const metricRange = readMetricRange(prediction);
  const png = await createRelativeDepthPng(rawPng, metricRange);
  const { width, height } = validateDepthPng(png);
  const temporaryOutput = `${output}.${process.pid}.tmp`;

  try {
    await writeFile(temporaryOutput, png);
    await rename(temporaryOutput, output);
    metadata[name] = metricRange;
    await writeFile(METADATA_PATH, `${JSON.stringify(metadata, null, 2)}\n`);
  } catch (error) {
    await unlink(temporaryOutput).catch(() => {});
    throw error;
  }

  console.log(
    `Saved ${output.split("/").at(-1)} (${width}x${height}, 16-bit).`,
  );
}

function readMetricRange(prediction) {
  const nearMeters = Number(prediction?.depth_min_m);
  const farMeters = Number(prediction?.depth_max_m);

  if (!(nearMeters > 0) || !(farMeters > nearMeters)) {
    throw new Error("Replicate did not return a valid metric depth range.");
  }

  return { nearMeters, farMeters };
}

async function createRelativeDepthPng(png, range) {
  const { data, info } = await sharp(png)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const depthRatio = range.farMeters / range.nearMeters;

  for (let i = 0; i < data.length; i++) {
    const normalizedMetricDepth = 1 - data[i] / 255;
    const normalizedInverseDepth =
      normalizedMetricDepth /
      (depthRatio - normalizedMetricDepth * (depthRatio - 1));
    data[i] = Math.round(normalizedInverseDepth * 255);
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 1 },
  })
    .toColourspace("grey16")
    .png()
    .toBuffer();
}

async function runWithRateLimitRetry(run, retries = 5) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      if (error?.response?.status !== 429 || attempt >= retries) throw error;

      const retryAfter = Number(error.response.headers.get("retry-after")) || 5;
      console.log(`Rate limited; retrying in ${retryAfter}s...`);
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1_000));
    }
  }
}

async function readDepthPng(prediction) {
  const depthPng = prediction?.depth_png;

  if (typeof depthPng === "string" || depthPng instanceof URL) {
    const response = await fetch(depthPng);
    if (!response.ok) {
      throw new Error(`Could not download depth PNG (${response.status}).`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  if (typeof depthPng?.blob === "function") {
    return Buffer.from(await (await depthPng.blob()).arrayBuffer());
  }

  throw new Error("Replicate did not return a depth_png output.");
}

function validateDepthPng(buffer) {
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buffer.length < 29 || !buffer.subarray(0, 8).equals(pngSignature)) {
    throw new Error("Replicate output is not a valid PNG.");
  }

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const bitDepth = buffer[24];
  const colorType = buffer[25];

  if (bitDepth !== 16 || colorType !== 0) {
    throw new Error(
      `Expected a 16-bit grayscale PNG, received bit depth ${bitDepth} and color type ${colorType}.`,
    );
  }

  return { width, height };
}
