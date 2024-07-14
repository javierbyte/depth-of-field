/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState, useRef, use } from "react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { depthSlicer } from "./lib/slice";

const CSS_PERSPECTIVE = 1080;

const SPRING_TENSION = 0.8;
const WEAK_SPRING_TENSION = 0.95;

const DEFAULT_SEPARATION: number = 12;

const BLUR_OPTION = {
  "No Blur": undefined,
  "Back focus": [0, 0, 1, 2, 3, 4],
  "Close focus": [4, 3, 2, 1, 0, 0],
} as const;

export default function Home() {
  const dataRef = useRef({
    layerSeparation: DEFAULT_SEPARATION,
    renderLayerSeparation: 0,
    blur: "No Blur",
    forceRender: false,
    targetX: -0.22,
    targetY: -0.1,
    renderX: 0,
    renderY: 0,
  });
  const [photo, setPhoto] = useState<keyof typeof photos>("tokyo");
  const [photoDepthMap, setPhotoDepthMap] = useState<string[]>([]);

  const [isReady, setIsReady] = useState<null | string>(null);

  useEffect(() => {
    async function updateDepthLayers(depthSrc: string) {
      const overlap = 5;
      const slices = 5;
      const availableSolidRange = 100 - overlap * (slices - 1);
      const solidRange = availableSolidRange / slices; // important

      const newDepthMap = await depthSlicer(
        depthSrc,
        [
          [0, solidRange + overlap],
          [solidRange, solidRange * 2 + overlap * 2],
          [solidRange * 2 + overlap, solidRange * 3 + overlap * 3],
          [solidRange * 3 + overlap * 2, solidRange * 4 + overlap * 4],
          [solidRange * 4 + overlap * 3, solidRange * 5 + overlap * 4],
        ],
        (b) => b * 1.25
      );
      setPhotoDepthMap(newDepthMap);
      setIsReady(depthSrc);
    }
    updateDepthLayers(photos[photo].depthSrc);
  }, [photo]);

  const [layerSeparationUI, setLayerSeparationUI] =
    useState(DEFAULT_SEPARATION);

  const [blurUI, setBlurUI] = useState("No Blur");

  const photoData = photos[photo];

  useEffect(() => {
    const imgContainer = document.querySelector<HTMLElement>(".frame");

    if (!imgContainer) {
      return;
    }

    const onCursorMove = (e: MouseEvent) => {
      const data = dataRef.current;

      const { innerWidth, innerHeight } = window;

      const { width, height, left, top } = imgContainer.getBoundingClientRect();
      const imgCenterX = left + width / 2;
      const imgCenterY = top + height / 2;

      const scaleX = innerHeight > innerWidth ? 1.25 : 1;

      data.targetX =
        ((e.clientX - imgCenterX) / (innerWidth + innerHeight)) * scaleX;
      data.targetY = (e.clientY - imgCenterY) / (innerWidth + innerHeight);
    };

    function updateStyles() {
      const data = dataRef.current;
      if (!imgContainer) {
        return;
      }

      const imgEls = imgContainer.querySelectorAll("img");

      const imgElBase = imgEls[0];
      const imgEl1 = imgEls[1];
      const imgEl2 = imgEls[2];
      const imgEl3 = imgEls[3];
      const imgEl4 = imgEls[4];
      const imgEl5 = imgEls[5];

      if (!imgElBase || !imgEl1 || !imgEl2 || !imgEl3 || !imgEl4) {
        return;
      }

      const totalDiff =
        Math.abs(data.targetX - data.renderX) +
        Math.abs(data.targetY - data.renderY);

      if (totalDiff < 0.02 && !data.forceRender) {
        data.forceRender = false;
        window.requestAnimationFrame(updateStyles);
        return;
      }

      data.renderX =
        data.renderX * SPRING_TENSION + data.targetX * (1 - SPRING_TENSION);
      data.renderY =
        data.renderY * SPRING_TENSION + data.targetY * (1 - SPRING_TENSION);

      data.renderLayerSeparation =
        data.renderLayerSeparation * WEAK_SPRING_TENSION +
        data.layerSeparation * (1 - WEAK_SPRING_TENSION);

      const x = data.renderX * 0.618;
      const y = data.renderY * 0.618;

      const xDeg = Math.round(x * 180 * 1000) / 1000;
      const yDeg = Math.round(-y * 180 * 1000) / 1000;

      const offset = data.renderLayerSeparation;

      if (data.blur !== "No Blur") {
        // @ts-ignore
        const blurScale = BLUR_OPTION[data.blur];
        if (blurScale) {
          imgElBase.style.filter = `blur(${blurScale[0]}px)`;
          imgEl1.style.filter = `blur(${blurScale[1]}px)`;
          imgEl2.style.filter = `blur(${blurScale[2]}px)`;
          imgEl3.style.filter = `blur(${blurScale[3]}px)`;
          imgEl4.style.filter = `blur(${blurScale[4]}px)`;
          imgEl5 && (imgEl5.style.filter = `blur(${blurScale[5]}px)`);
        }
      } else {
        imgElBase.style.filter = "";
        imgEl1.style.filter = "";
        imgEl2.style.filter = "";
        imgEl3.style.filter = "";
        imgEl4.style.filter = "";
        imgEl5 && (imgEl5.style.filter = "");
      }

      imgElBase.style.transform = `perspective(${CSS_PERSPECTIVE}px) rotateX(${yDeg}deg) rotateY(${xDeg}deg) translateZ(${
        offset * -1
      }px)`;
      imgEl1.style.transform = `perspective(${CSS_PERSPECTIVE}px) rotateX(${yDeg}deg) rotateY(${xDeg}deg) translateZ(${
        offset * 0
      }px)`;
      imgEl2.style.transform = `perspective(${CSS_PERSPECTIVE}px) rotateX(${yDeg}deg) rotateY(${xDeg}deg) translateZ(${
        offset * 1
      }px)`;
      imgEl3.style.transform = `perspective(${CSS_PERSPECTIVE}px) rotateX(${yDeg}deg) rotateY(${xDeg}deg) translateZ(${
        offset * 2
      }px)`;
      imgEl4.style.transform = `perspective(${CSS_PERSPECTIVE}px) rotateX(${yDeg}deg) rotateY(${xDeg}deg) translateZ(${
        offset * 3
      }px)`;
      imgEl5 &&
        (imgEl5.style.transform = `perspective(${CSS_PERSPECTIVE}px) rotateX(${yDeg}deg) rotateY(${xDeg}deg) translateZ(${
          offset * 4
        }px)`);

      window.requestAnimationFrame(updateStyles);
    }

    window.addEventListener("mousemove", onCursorMove);
    window.addEventListener("touchmove", (e) => {
      // @ts-ignore
      onCursorMove(e.touches[0]);
    });

    updateStyles();
  }, [isReady]);

  return (
    <>
      <div className="flex gap-1 p-2">
        <Select
          value={String(photo)}
          onValueChange={(e) => {
            // bug in safari with the blur not updating
            dataRef.current.targetX += 0.05;
            dataRef.current.targetY += 0.05;
            dataRef.current.forceRender = true;
            setPhoto(e as keyof typeof photos);
          }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Change photo" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {Object.keys(photos).map((key) => (
                <SelectItem key={key} value={key}>
                  {key}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select
          value={String(layerSeparationUI)}
          onValueChange={(e) => {
            dataRef.current.layerSeparation = Number(e);
            dataRef.current.forceRender = true;
            setLayerSeparationUI(Number(e));
          }}
        >
          <SelectTrigger className="w-[72px]">
            <SelectValue placeholder="Layer Separation" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {/* title */}
              <SelectItem disabled value="Layer Separation">
                Layer Separation
              </SelectItem>
              <SelectItem value="0">0px</SelectItem>
              <SelectItem value="4">4px</SelectItem>
              <SelectItem value="8">8px</SelectItem>
              <SelectItem value="12">12px</SelectItem>
              <SelectItem value="16">16px</SelectItem>
              <SelectItem value="32">32px</SelectItem>
              <SelectItem value="64">64px</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select
          value={String(blurUI)}
          onValueChange={(e) => {
            dataRef.current.blur = e;
            dataRef.current.forceRender = true;
            dataRef.current.layerSeparation = 0;
            setLayerSeparationUI(0);

            setBlurUI(e);
          }}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Blur" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {Object.keys(BLUR_OPTION).map((key) => (
                <SelectItem key={key} value={key}>
                  {key}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <div className="fixed bottom-4 left-4 text-sm">
        Depth of field with layered masks proof of concept.
        <br />
        {"Made by "}
        <a className="underline" href="https://twitter.com/javierbyte">
          @javierbyte
        </a>
        {". Source "}
        <a
          className="underline"
          href="https://github.com/javierbyte/depth-of-field"
        >
          Github
        </a>
        .
      </div>
      <div className="frame">
        <img
          id="image"
          alt=""
          className="absolute top-0 left-0 opacity-100 layer layer-masked"
          src={photoData.src}
        />

        {photoDepthMap.map((depth, i) => (
          <img
            key={i}
            id={`image-${i}`}
            alt=""
            className="absolute top-0 left-0 opacity-100 layer layer-masked"
            // src={depth}
            src={photoData.src}
            style={{
              maskImage: `url(${depth})`,
            }}
          />
        ))}
      </div>

      <div
        // shoiw onl;y on desktop
        className="flex-col align-center hidden md:flex"
        style={{
          position: "fixed",
          height: "100vh",
          overflowY: "auto",
          overflowX: "hidden",
          gap: 4,
          top: 0,
          right: 0,
          width: 80 * 2 + 16,
          padding: "16px 8px 32px",
          backgroundColor: "#ecf0f1",
        }}
      >
        {/* <img
            alt=""
            className="layer layer-masked"
            style={{
              display: "inline-block",
              width: 80 * 2,
              height: 100 * 2,
              margin: 4,
            }}
            src={photoData.depthSrc}
          /> */}

        {photoDepthMap.map((layer, i) => (
          <img
            key={i}
            id={`image-${i}`}
            alt=""
            className="layer layer-masked"
            style={{
              backgroundColor: "#808080",
              display: "inline-block",
              width: 80 * 2,
              height: 100 * 2,
            }}
            src={layer}
          />
        ))}
      </div>
    </>
  );
}

const photos = {
  tokyo: {
    src: "/3d/tokyo.jpg",
    depthSrc: "/3d/tokyo-depth.png",
  },

  mallorca: {
    src: "/3d/mallorca.jpg",
    depthSrc: "/3d/mallorca-depth.png",
  },

  angel: {
    src: "/3d/angel.jpg",
    depthSrc: "/3d/angel-depth.png",
  },

  ml: {
    src: "/3d/ml.jpg",
    depthSrc: "/3d/ml-depth.png",
  },

  osaka: {
    src: "/3d/osaka.jpg",
    depthSrc: "/3d/osaka-depth.png",
  },

  ginza: {
    src: "/3d/ginza.jpg",
    depthSrc: "/3d/ginza-depth.png",
  },
} as const;
