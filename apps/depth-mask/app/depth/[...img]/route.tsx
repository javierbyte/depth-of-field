import { ImageResponse } from "next/og";

const WIDTH = 400 * 2;
const HEIGHT = 500 * 2;

const depths = {
  "angel.jpg": "angel-depth.png",
  "tokyo.jpg": "tokyo-depth.png",
  "ml.jpg": "ml-depth.png",
  "osaka.jpg": "osaka-depth.png",
  "ginza.jpg": "ginza-depth.png",
  "mallorca.jpg": "mallorca-depth.png",
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

  return new ImageResponse(
    (
      <>
        <img
          src={`https://depth-of-field-8vawwj81i-borquez.vercel.app/3d/${img}`}
          style={{
            filter: `brightness(${brightness}) contrast(${contrast})`,
          }}
          width={WIDTH}
          height={HEIGHT}
        />
        {new Array(1024 * 0).fill(0).map((_, i) => (
          <div
            key={i}
            style={{
              width: 4,
              height: 4,
              background: "black",
              position: "absolute",
              top: Math.floor(HEIGHT * Math.random()),
              left: Math.floor(WIDTH * Math.random()),
            }}
          />
        ))}
      </>
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
