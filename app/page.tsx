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
const MAX_BLUR = 16;
const SPRING_TENSION = 0.8;
const PAN_RANGE = -100;

export default function Home() {
  const dataRef = useRef({
    globalAperture: 1.4,
    forceRender: false,
    targetX: -0.22,
    targetY: -0.1,
    renderX: 0,
    renderY: 0,
  });
  const [aperture, setAperture] = useState(1.4);
  const [photo, setPhoto] = useState<keyof typeof photos>("Berlin");

  const photoData = photos[photo];

  useEffect(() => {
    const imgContainer = document.querySelector<HTMLElement>(".frame");

    const imgFar = document.querySelector<HTMLElement>("#imageFar");
    const imgMedium = document.querySelector<HTMLElement>("#imageMedium");
    const img = document.querySelector<HTMLElement>("#image");

    if (!imgContainer || !imgFar || !img || !imgMedium) {
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
      if (!imgContainer || !imgFar || !img || !imgMedium) {
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

      const x = data.renderX * 0.618;
      const y = data.renderY * 0.618;

      const angle = Math.atan2(y, x);
      const angleDeg = Math.round(((angle * 180) / Math.PI + 90) * 1000) / 1000;

      const xDeg = Math.round(x * 180 * 1000) / 1000;
      const yDeg = Math.round(-y * 180 * 1000) / 1000;

      const isSmallScreen = window.innerWidth < 768;

      if (isSmallScreen) {
        imgContainer.style.transform = `perspective(${CSS_PERSPECTIVE}px) rotateX(${yDeg}deg) rotateY(${xDeg}deg)`;
      } else {
        imgContainer.style.transform = `translatex(${
          x * PAN_RANGE
        }px) translatey(${
          -y * -PAN_RANGE
        }px) perspective(${CSS_PERSPECTIVE}px) rotateX(${yDeg}deg) rotateY(${xDeg}deg)`;
      }

      const blurIntensity =
        (Math.sqrt(Math.pow(xDeg, 2) + Math.pow(yDeg, 2)) /
          data.globalAperture) *
          0.4 -
        1;

      const finalBlur = Math.max(Math.min(blurIntensity, MAX_BLUR), 0);

      const mask = `linear-gradient(
        ${angleDeg}deg,
        rgba(0, 0, 0, 0) 0%,
        rgba(0, 0, 0, 0) 20%,
        rgba(0, 0, 0, 1) 35%,
        rgba(0, 0, 0, 1) 65%,
        rgba(0, 0, 0, 0) 80%,
        rgba(0, 0, 0, 0) 100%
      )`;

      img.style.maskImage = mask;

      const mediumMask =
        data.globalAperture < 1
          ? `linear-gradient(
        ${angleDeg}deg,
        rgba(0, 0, 0, 1) 0%,
        rgba(0, 0, 0, 1) 40%,
        rgba(0, 0, 0, 0) 48%,
        rgba(0, 0, 0, 0) 53%,
        rgba(0, 0, 0, 1) 60%,
        rgba(0, 0, 0, 1) 100%
      )`
          : `linear-gradient(
        ${angleDeg}deg,
        rgba(0, 0, 0, 1) 0%,
        rgba(0, 0, 0, 1) 35%,
        rgba(0, 0, 0, 0) 45%,
        rgba(0, 0, 0, 0) 55%,
        rgba(0, 0, 0, 1) 65%,
        rgba(0, 0, 0, 1) 100%
      )`;
      imgMedium.style.maskImage = mediumMask;
      imgMedium.style.filter = `blur(${finalBlur * 0.5}px)`;

      const maskFar =
        data.globalAperture < 1
          ? `linear-gradient(
        ${angleDeg}deg,
        rgba(0, 0, 0, 1) 0%,
        rgba(0, 0, 0, 1) 25%,
        rgba(0, 0, 0, 0) 35%,
        rgba(0, 0, 0, 0) 65%,
        rgba(0, 0, 0, 1) 75%,
        rgba(0, 0, 0, 1) 100%
      )`
          : `linear-gradient(
        ${angleDeg}deg,
        rgba(0, 0, 0, 1) 0%,
        rgba(0, 0, 0, 1) 20%,
        rgba(0, 0, 0, 0) 30%,
        rgba(0, 0, 0, 0) 70%,
        rgba(0, 0, 0, 1) 80%,
        rgba(0, 0, 0, 1) 100%
      )`;
      imgFar.style.maskImage = maskFar;
      imgFar.style.filter = `blur(${finalBlur}px)`;

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
          value={String(aperture)}
          onValueChange={(e) => {
            dataRef.current.globalAperture = Number(e);
            dataRef.current.forceRender = true;
            setAperture(Number(e));
          }}
        >
          <SelectTrigger className="w-[80px]">
            <SelectValue placeholder="Change aperture" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="0.95">ƒ0.95</SelectItem>
              <SelectItem value="1.4">ƒ1.4</SelectItem>
              <SelectItem value="2">ƒ2</SelectItem>
              <SelectItem value="4">ƒ4</SelectItem>
              <SelectItem value="8">ƒ8</SelectItem>
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
          src={photoData.src[0]}
        />

        <img
          id="imageMedium"
          alt=""
          className="absolute top-0 left-0 opacity-100"
          src={photoData.src[1]}
        />
        <img
          id="imageFar"
          alt=""
          className="absolute top-0 left-0 opacity-100"
          src={photoData.src[2]}
        />
      </div>
    </>
  );
}

const photos = {
  Berlin: {
    src: ["/berlin-1.jpg", "/berlin-1.jpg", "/berlin-1.jpg"],
  },
  Schwerin: {
    src: ["/schwerin-1.jpg", "/schwerin-1.jpg", "/schwerin-1.jpg"],
  },
  Brutalita: {
    src: ["/brutalita-1.jpg", "/brutalita-1.jpg", "/brutalita-1.jpg"],
  },
  "Todos Santos": {
    src: ["todos-santos-1.jpg", "todos-santos-1.jpg", "todos-santos-1.jpg"],
  },
  "Debug Layers": {
    src: ["/solid-1.png", "/solid-2.png", "/solid-3.png"],
  },
} as const;
