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
  console.info(">>SLICING", path, layers);

  // path is the URL of a depth map, load it into an image and then a canvas

  const img = new Image();
  img.src = path;
  await img.decode();
  const canvas = document.createElement("canvas");
  // canvas.width = img.width;
  // canvas.height = img.height;
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not get canvas context");
  }
  // ctx.drawImage(img, 0, 0);
  ctx.drawImage(img, 0, 0, WIDTH, HEIGHT);

  // get the pixel data from the canvas
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // transform the image from black-white to black visible to black 0% visible

  const layerUrls: string[] = [];

  for (const layer of layers) {
    const newImageData = ctx.createImageData(canvas.width, canvas.height);

    for (let i = 0; i < data.length; i += 4) {
      const value = (data[i] / 255) * 100;
      if (value < layer[0]) {
        newImageData.data[i] = 0;
        newImageData.data[i + 1] = 0;
        newImageData.data[i + 2] = 0;
        newImageData.data[i + 3] = 0;
      } else if (value > layer[1]) {
        newImageData.data[i] = 0;
        newImageData.data[i + 1] = 0;
        newImageData.data[i + 2] = 0;
        newImageData.data[i + 3] = 255;
      } else {
        const percentage = (value - layer[0]) / (layer[1] - layer[0]);
        newImageData.data[i] = 0;
        newImageData.data[i + 1] = 0;
        newImageData.data[i + 2] = 0;
        newImageData.data[i + 3] = percentage * 255;
      }
    }

    ctx.putImageData(newImageData, 0, 0);

    const url = canvas.toDataURL();

    layerUrls.push(url);
  }

  return layerUrls;

  // const newImageData = ctx.createImageData(canvas.width, canvas.height);

  // for (let i = 0; i < data.length; i += 4) {

  //   newImageData.data[i] = 0;
  //   newImageData.data[i + 1] = 0;
  //   newImageData.data[i + 2] = 0;
  //   // newImageData.data[i + 3] = 255 - data[i];

  // }

  // ctx.putImageData(newImageData, 0, 0);

  // const url = canvas.toDataURL();

  // // console.log(url);

  // return [url, url, url, url, url];
}
