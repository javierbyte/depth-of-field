/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState, useRef } from "react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CSS_PERSPECTIVE = 1080;
const SPRING_TENSION = 0.8;
const WEAK_SPRING_TENSION = 0.95;

const DEFAULT_SEPARATION: number = 8;

const BLUR_OPTION = {
  "No Blur": undefined,
  "Back focus": [0, 1, 2, 4, 5],
  "Close focus": [5, 4, 2, 1, 0],
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
  const [photo, setPhoto] = useState<keyof typeof photos>("Tokyo Tower");

  const [layerSeparationUI, setLayerSeparationUI] =
    useState(DEFAULT_SEPARATION);

  const [blurUI, setBlurUI] = useState("No Blur");

  const photoData = photos[photo];

  useEffect(() => {
    const imgContainer = document.querySelector<HTMLElement>(".frame");

    if (!imgContainer) {
      return;
    }

    const imgEl1 = imgContainer.querySelectorAll("img")[1];
    const imgEl2 = imgContainer.querySelectorAll("img")[2];
    const imgEl3 = imgContainer.querySelectorAll("img")[3];
    const imgEl4 = imgContainer.querySelectorAll("img")[4];

    imgEl1.style.maskImage = `url(${photoData.depth[0]})`;
    imgEl1.style.maskSize = "cover";
    imgEl1.style.maskPosition = "center";
    imgEl1.style.maskRepeat = "no-repeat";

    imgEl2.style.maskImage = `url(${photoData.depth[1]})`;
    imgEl2.style.maskSize = "cover";
    imgEl2.style.maskPosition = "center";
    imgEl2.style.maskRepeat = "no-repeat";

    imgEl3.style.maskImage = `url(${photoData.depth[2]})`;
    imgEl3.style.maskSize = "cover";
    imgEl3.style.maskPosition = "center";
    imgEl3.style.maskRepeat = "no-repeat";

    imgEl4.style.maskImage = `url(${photoData.depth[3]})`;
    imgEl4.style.maskSize = "cover";
    imgEl4.style.maskPosition = "center";
    imgEl4.style.maskRepeat = "no-repeat";
  }, [photo]);

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
        }
      } else {
        imgElBase.style.filter = "";
        imgEl1.style.filter = "";
        imgEl2.style.filter = "";
        imgEl3.style.filter = "";
        imgEl4.style.filter = "";
      }

      imgElBase.style.transform = `perspective(${CSS_PERSPECTIVE}px) rotateX(${yDeg}deg) rotateY(${xDeg}deg)`;
      imgEl1.style.transform = `perspective(${CSS_PERSPECTIVE}px) rotateX(${yDeg}deg) rotateY(${xDeg}deg) translateZ(${
        offset * 1
      }px)`;
      imgEl2.style.transform = `perspective(${CSS_PERSPECTIVE}px) rotateX(${yDeg}deg) rotateY(${xDeg}deg) translateZ(${
        offset * 2
      }px)`;
      imgEl3.style.transform = `perspective(${CSS_PERSPECTIVE}px) rotateX(${yDeg}deg) rotateY(${xDeg}deg) translateZ(${
        offset * 3
      }px)`;
      imgEl4.style.transform = `perspective(${CSS_PERSPECTIVE}px) rotateX(${yDeg}deg) rotateY(${xDeg}deg) translateZ(${
        offset * 4
      }px)`;

      window.requestAnimationFrame(updateStyles);
    }

    window.addEventListener("mousemove", onCursorMove);
    window.addEventListener("touchmove", (e) => {
      // @ts-ignore
      onCursorMove(e.touches[0]);
    });

    updateStyles();
  }, []);

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
              <SelectItem value="16">16px</SelectItem>
              <SelectItem value="32">32px</SelectItem>
              <SelectItem value="-32">-32px</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select
          value={String(blurUI)}
          onValueChange={(e) => {
            dataRef.current.blur = e;
            dataRef.current.forceRender = true;

            // also reset layer separation to 0
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
          className="absolute top-0 left-0 opacity-100"
          src={photoData.src}
        />

        <img
          id="image-0"
          alt=""
          className="absolute top-0 left-0 opacity-100"
          src={photoData.src}
        />

        <img
          id="image-1"
          alt=""
          className="absolute top-0 left-0 opacity-100"
          src={photoData.src}
        />

        <img
          id="image-2"
          alt=""
          className="absolute top-0 left-0 opacity-100"
          src={photoData.src}
        />

        <img
          id="image-3"
          alt=""
          className="absolute top-0 left-0 opacity-100"
          src={photoData.src}
        />
      </div>
    </>
  );
}

const photos = {
  "Tokyo Tower": {
    src: "/3d/2.jpg",
    depth: [
      "/3d/2-depth-3.png",
      "/3d/2-depth-2.png",
      "/3d/2-depth-1.png",
      "/3d/2-depth-0.png",
    ],
  },
  Osaka: {
    src: "/3d/1.jpg",
    depth: [
      "/3d/1-depth-3.png",
      "/3d/1-depth-2.png",
      "/3d/1-depth-1.png",
      "/3d/1-depth-0.png",
    ],
  },
} as const;
