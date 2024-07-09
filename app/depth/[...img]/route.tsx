import { ImageResponse } from "next/og";

const WIDTH = 400 * 1.5;
const HEIGHT = 500 * 1.5;

const depths = {
  "2.jpg": "2-depth-src.png",
  "1.jpg": "1-depth-src.png",
} as const;

export async function GET(request: Request) {
  // Get query params from request.
  const { searchParams } = new URL(request.url);

  // console.log(">>", searchParams, request);

  const contrast = searchParams.get("contrast") || 1;
  const brightness = searchParams.get("brightness") || 1;

  const img = getImg(request.url);

  if (!img) {
    return new Response("Image not found", { status: 404 });
  }

  console.log(">>", img);

  return new ImageResponse(
    (
      <img
        src={`https://depth-of-field-git-test-3d-borquez.vercel.app/3d/${img}`}
        style={{
          filter: `brightness(${brightness}) contrast(${contrast})`,
        }}
        width={WIDTH}
        height={HEIGHT}
      />
    ),
    {
      width: WIDTH,
      height: HEIGHT,
    }
  );
}

function getImg(url: string): string | undefined {
  for (const key in depths) {
    if (url.includes(key)) {
      // @ts-ignore
      return depths[key];
    }
  }
}
