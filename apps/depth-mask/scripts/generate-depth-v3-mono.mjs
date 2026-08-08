import { existsSync } from "node:fs";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import Replicate from "replicate";
import sharp from "sharp";

const MODEL =
  "vufinder/depth-anything-v3-mono:2dad523efc4f21f134480ef1878e7a145c1d761d156d558392002196703f2e45";
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const APP_DIR = join(SCRIPT_DIR, "..");
const ASSET_DIR = join(APP_DIR, "public", "3d");
const DEPLOYED_ASSET_BASE = "https://depth-mask.vercel.app/3d";
const IMAGE_NAMES = [
  "angel",
  "castle",
  "ginza",
  "isla",
  "mallorca",
  "osaka",
  "tokyo",
];

dotenv.config({ path: join(APP_DIR, ".env.local"), quiet: true });

const auth = process.env.REPLICATE_KEY;
if (!auth) {
  throw new Error(
    "REPLICATE_KEY is missing. Add it to apps/depth-mask/.env.local.",
  );
}

const force = process.argv.includes("--force");
const resume = process.argv.includes("--resume");
const reuseLatest = process.argv.includes("--reuse-latest");
const requestedName = readArgument("--image");
if (requestedName && !IMAGE_NAMES.includes(requestedName)) {
  throw new Error(
    `Unknown image "${requestedName}". Choose one of: ${IMAGE_NAMES.join(", ")}.`,
  );
}

const images = (requestedName ? [requestedName] : IMAGE_NAMES).map((name) => ({
  name,
  input: join(ASSET_DIR, `${name}_400.jpg`),
  output: join(ASSET_DIR, `${name}-depth-v3-mono_400.jpg`),
}));
const existingOutputs = images.filter(({ output }) => existsSync(output));

if (existingOutputs.length && !force && !resume) {
  const filenames = existingOutputs.map(({ output }) =>
    output.split("/").at(-1),
  );
  throw new Error(
    `Refusing to overwrite existing V3 Mono output(s): ${filenames.join(", ")}. Re-run with --force to replace them.`,
  );
}

const replicate = new Replicate({ auth, useFileOutput: false });
const pendingImages = resume
  ? images.filter(({ output }) => !existsSync(output))
  : images;

for (const { input, output } of pendingImages) {
  const filename = input.split("/").at(-1);
  console.log(`Generating DA3 Mono depth for ${filename}...`);

  const image = await readFile(input);
  await verifyDeployedSource(image, filename);
  const requestInput = {
    images: [`${DEPLOYED_ASSET_BASE}/${filename}`],
    processing_resolution: "match_input",
    return_depth: true,
    output_format: "json",
    to_base64: false,
    keys_to_exclude: "conf,processed_images,intrinsics,extrinsics,aux",
    alpha_blend_onto: "white",
  };
  const prediction = reuseLatest
    ? await readLatestPrediction(requestInput.images[0])
    : await runWithRateLimitRetry(() =>
        replicate.run(MODEL, { input: requestInput }),
      );

  const predictionData = await readJsonOutput(prediction);
  const { values, width, height } = readDepthArray(predictionData);
  const { jpeg, low, high } = await createRelativeDepthJpeg(
    values,
    width,
    height,
  );
  const dimensions = await validateDepthJpeg(jpeg);
  const temporaryOutput = `${output}.${process.pid}.tmp`;

  try {
    await writeFile(temporaryOutput, jpeg);
    await rename(temporaryOutput, output);
  } catch (error) {
    await unlink(temporaryOutput).catch(() => {});
    throw error;
  }

  console.log(
    `Saved ${output.split("/").at(-1)} (${dimensions.width}x${dimensions.height}, grayscale JPEG, ${Math.round(jpeg.length / 1024)} KiB; raw 1st/99th percentiles ${low.toFixed(5)}–${high.toFixed(5)}).`,
  );
}

async function readLatestPrediction(imageUrl) {
  const version = MODEL.split(":").at(-1);
  const page = await replicate.predictions.list();
  const prediction = page.results.find(
    (candidate) =>
      candidate.status === "succeeded" &&
      candidate.version === version &&
      candidate.input?.images?.[0] === imageUrl &&
      candidate.output,
  );

  if (!prediction) {
    throw new Error("No reusable successful prediction was found.");
  }

  console.log(`Reusing successful prediction ${prediction.id}.`);
  return prediction.output;
}

async function verifyDeployedSource(localImage, filename) {
  const response = await fetch(`${DEPLOYED_ASSET_BASE}/${filename}`);
  if (!response.ok) {
    throw new Error(
      `Could not read deployed source ${filename} (${response.status}).`,
    );
  }

  const deployedImage = Buffer.from(await response.arrayBuffer());
  if (!localImage.equals(deployedImage)) {
    throw new Error(
      `Deployed source ${filename} differs from the local source; refusing to generate it.`,
    );
  }
}

function readArgument(name) {
  const exactIndex = process.argv.indexOf(name);
  if (exactIndex !== -1) return process.argv[exactIndex + 1];

  const prefix = `${name}=`;
  return process.argv
    .find((argument) => argument.startsWith(prefix))
    ?.slice(prefix.length);
}

async function readJsonOutput(prediction) {
  const dataOutput = prediction?.data?.[0];
  if (!dataOutput) {
    throw new Error("Replicate did not return prediction data.");
  }

  if (typeof dataOutput === "object" && dataOutput !== null) {
    if (typeof dataOutput.json === "function") return dataOutput.json();
    if (typeof dataOutput.blob === "function") {
      return JSON.parse(await (await dataOutput.blob()).text());
    }
  }

  const response = await fetch(dataOutput);
  if (!response.ok) {
    throw new Error(`Could not download prediction JSON (${response.status}).`);
  }
  return response.json();
}

function readDepthArray(predictionData) {
  const depth = predictionData?.depth;
  if (!Array.isArray(depth)) {
    throw new Error(
      `Prediction JSON does not contain a numeric depth array (keys: ${Object.keys(predictionData ?? {}).join(", ")}).`,
    );
  }

  const plane = unwrapSingleDimensions(depth);
  if (!Array.isArray(plane) || !Array.isArray(plane[0])) {
    throw new Error("Prediction depth does not have a two-dimensional shape.");
  }

  const height = plane.length;
  const width = plane[0].length;
  const values = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    if (!Array.isArray(plane[y]) || plane[y].length !== width) {
      throw new Error("Prediction depth rows have inconsistent widths.");
    }
    for (let x = 0; x < width; x++) {
      const value = Number(plane[y][x]);
      if (!Number.isFinite(value)) {
        throw new Error("Prediction depth contains a non-finite value.");
      }
      values[y * width + x] = value;
    }
  }

  return { values, width, height };
}

function unwrapSingleDimensions(value) {
  let result = value;
  while (
    Array.isArray(result) &&
    result.length === 1 &&
    Array.isArray(result[0]) &&
    Array.isArray(result[0][0])
  ) {
    result = result[0];
  }
  return result;
}

async function createRelativeDepthJpeg(values, width, height) {
  const sorted = Float32Array.from(values).sort();
  const low = sorted[Math.floor((sorted.length - 1) * 0.01)];
  const high = sorted[Math.ceil((sorted.length - 1) * 0.99)];
  if (!(high > low)) {
    throw new Error("Prediction depth range is empty.");
  }

  // DA3 Mono predicts depth directly, while V2's disparity-style output and
  // this app use inverse depth. Bake that curve and the near-is-bright
  // convention into the asset, clipping outliers to robust scene bounds.
  const raster = new Uint8ClampedArray(values.length);
  const inverseLow = 1 / high;
  const inverseHigh = 1 / low;
  for (let i = 0; i < values.length; i++) {
    const clippedDepth = Math.min(high, Math.max(low, values[i]));
    const normalizedInverse =
      (1 / clippedDepth - inverseLow) / (inverseHigh - inverseLow);
    raster[i] = Math.round(normalizedInverse * 255);
  }

  const jpeg = await sharp(raster, {
    raw: { width, height, channels: 1 },
  })
    .toColourspace("b-w")
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
  return { jpeg, low, high };
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

async function validateDepthJpeg(buffer) {
  const metadata = await sharp(buffer).metadata();
  if (
    metadata.format !== "jpeg" ||
    metadata.depth !== "uchar" ||
    metadata.channels !== 1
  ) {
    throw new Error(
      `Expected an 8-bit grayscale JPEG, received ${metadata.format}, ${metadata.depth}, ${metadata.channels} channels.`,
    );
  }

  return { width: metadata.width, height: metadata.height };
}
