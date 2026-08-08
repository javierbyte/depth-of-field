/*

Layers are defined as a pair of numbers between 0 and 255, [24,210]
if the value of a given pixel is less than the first number, it is considered to be 0% visible
if the value of a given pixel is greater than the second number, it is considered to be 100% visible
if the value of a given pixel is between the two numbers, it is considered to be a percentage of visibility between 0 and 100

*/

const WIDTH = 400;
const HEIGHT = 500;

export type DepthSource = {
  src: string;
};

export async function depthSlicer(
  sources: readonly DepthSource[],
  layers: [number, number][],
): Promise<string[]> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not get canvas context");
  }

  const sourceValues = await Promise.all(sources.map(loadDepthValues));
  const depthValues = averageDepthValues(sourceValues);

  const layerUrls: string[] = [];

  const scaledLayers = layers.map(([start, end]) => [
    Math.round((start / 100) * 255),
    Math.round((end / 100) * 255),
  ]);

  for (const layer of scaledLayers) {
    const newImageData = ctx.createImageData(canvas.width, canvas.height);

    for (let i = 0; i < depthValues.length; i++) {
      const value = depthValues[i];
      const alphaIndex = i * 4 + 3;

      if (value < layer[0]) {
        newImageData.data[alphaIndex] = 0;
      } else if (value > layer[1]) {
        newImageData.data[alphaIndex] = 255;
      } else {
        const percentage = (value - layer[0]) / (layer[1] - layer[0]);
        newImageData.data[alphaIndex] = Math.round(percentage * 255);
      }
    }

    ctx.putImageData(newImageData, 0, 0);

    const dataUrl = canvas.toDataURL();

    layerUrls.push(dataUrl);
  }

  return layerUrls;
}

async function loadDepthValues(source: DepthSource) {
  const img = new Image();
  img.src = source.src;
  await img.decode();

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");

  ctx.drawImage(img, 0, 0, WIDTH, HEIGHT);
  const pixels = ctx.getImageData(0, 0, WIDTH, HEIGHT).data;
  const values = new Uint8ClampedArray(WIDTH * HEIGHT);

  for (let i = 0; i < values.length; i++) {
    values[i] = pixels[i * 4];
  }

  return values;
}

function averageDepthValues(sources: Uint8ClampedArray[]) {
  if (!sources.length) throw new Error("At least one depth source is required");

  const averaged = new Uint8ClampedArray(sources[0].length);

  for (let i = 0; i < averaged.length; i++) {
    let total = 0;
    for (const source of sources) total += source[i];
    averaged[i] = Math.round(total / sources.length);
  }

  return averaged;
}
