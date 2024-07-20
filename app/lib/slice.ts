/*

Layers are defined as a pair of numbers between 0 and 255, [24,210]
if the value of a given pixel is less than the first number, it is considered to be 0% visible
if the value of a given pixel is greater than the second number, it is considered to be 100% visible
if the value of a given pixel is between the two numbers, it is considered to be a percentage of visibility between 0 and 100

*/

const WIDTH = 400;
const HEIGHT = 500;

export async function depthSlicer(
  path: string,
  layers: [number, number][]
): Promise<string[]> {
  const img = new Image();
  img.src = path;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not get canvas context");
  }
  ctx.drawImage(img, 0, 0, WIDTH, HEIGHT);

  // get the pixel data from the canvas
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  const layerUrls: string[] = [];

  const scaledLayers = layers.map(([start, end]) => [
    Math.round((start / 100) * 255),
    Math.round((end / 100) * 255),
  ]);

  for (const layer of scaledLayers) {
    const newImageData = ctx.createImageData(canvas.width, canvas.height);

    for (let i = 0; i < data.length; i += 4) {
      const value = data[i];

      if (value < layer[0]) {
        newImageData.data[i + 3] = 0;
      } else if (value > layer[1]) {
        newImageData.data[i + 3] = 255;
      } else {
        const percentage = (value - layer[0]) / (layer[1] - layer[0]);
        newImageData.data[i + 3] = Math.round(percentage * 255);
      }
    }

    ctx.putImageData(newImageData, 0, 0);

    layerUrls.push(canvas.toDataURL());
  }

  return layerUrls;
}
