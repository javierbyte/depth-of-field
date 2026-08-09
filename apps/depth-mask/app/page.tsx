/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState, useRef } from "react";
import { depthModels, photos, type DepthModel } from "./lib/data";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

import { depthSlicer, type DepthSource } from "./lib/slice";
import {
  createPlaneProjection,
  projectPoint,
  unprojectPoint,
} from "./lib/focus";

const CSS_PERSPECTIVE = 980;

const SPRING_TENSION = 0.82;
const WEAK_SPRING_TENSION = 0.94;

const SLICES_OPTIONS = [2, 3, 5, 8, 13, 21, 34];
const DEFAULT_SLICES = 8;

const SPREAD_OPTIONS = [0, 0.05, 0.1, 0.2, 0.4, 0.7, 1];
const DEFAULT_SPREAD = 0.05;

const VOLUME_SCALE = new Array(10).fill(0).map((_, i) => {
  return Math.round(128 * Math.pow(1.22, i) - 128);
});
const DEFAULT_VOLUME = VOLUME_SCALE[4];
const DEFAULT_PHOTO = "Museumsinsel";
const DEFAULT_DEPTH_MODEL: DepthModel = "combined";
const DEPTH_MODEL_SHORT_LABELS: Record<DepthModel, string> = {
  v2: "V2",
  v3Mono: "V3",
  combined: "V2 + V3",
};

const LOCK_CURSOR_TIME = 128;
const SNAP_TIME = 650;
const MOTION_SENSITIVITY = 0.006;
const MAX_MOTION_TARGET = 0.25;

type MotionTrackingStatus =
  "idle" | "requesting" | "enabled" | "denied" | "unsupported" | "error";

type MotionOrigin = {
  beta: number;
  gamma: number;
  screenAngle: number;
  targetX: number;
  targetY: number;
};

type DeviceOrientationEventWithPermission = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

function clampMotionTarget(value: number) {
  return Math.max(-MAX_MOTION_TARGET, Math.min(MAX_MOTION_TARGET, value));
}

function shortestAngleDelta(angle: number, origin: number) {
  return ((angle - origin + 540) % 360) - 180;
}

function getScreenAngle() {
  const legacyWindow = window as Window & { orientation?: number };
  return window.screen.orientation?.angle ?? legacyWindow.orientation ?? 0;
}

export default function Home() {
  const dataRef = useRef({
    photo: DEFAULT_PHOTO,
    slices: DEFAULT_SLICES,
    volume: 0,
    renderLayerSeparation: 0,
    forceRender: false,
    targetX: 0,
    targetY: 0,
    renderX: 0,
    renderY: 0,
    focusing: 0,
    focusActive: false,
    targetFocusX: 0.5,
    targetFocusY: 0.5,
    renderFocusX: 0.5,
    renderFocusY: 0.5,
    targetFocusViewX: 0,
    targetFocusViewY: 0,
    renderFocusViewX: 0,
    renderFocusViewY: 0,
    renderFocusAmount: 0,
  });
  const depthRef = useRef<HTMLDivElement>(null);
  const baseImageRef = useRef<HTMLImageElement>(null);
  const motionTrackingRef = useRef(false);
  const motionOriginRef = useRef<MotionOrigin | null>(null);
  const [photo, setPhoto] = useState<keyof typeof photos>(DEFAULT_PHOTO);
  const [depthModel, setDepthModel] = useState<DepthModel>(DEFAULT_DEPTH_MODEL);
  const [photoDepthMap, setPhotoDepthMap] = useState<string[]>([]);
  const [motionTrackingAvailable, setMotionTrackingAvailable] = useState(false);
  const [motionTrackingStatus, setMotionTrackingStatus] =
    useState<MotionTrackingStatus>("idle");
  const [ui, setUI] = useState({
    slices: DEFAULT_SLICES,
    volume: DEFAULT_VOLUME,
    spread: DEFAULT_SPREAD,
  });

  function set(
    path: "slices" | "volume" | "renderLayerSeparation" | "photo" | "focusing",
    value: any,
  ) {
    // @ts-ignore
    dataRef.current[path] = value;
    dataRef.current.forceRender = true;
  }

  function resetClickFocus() {
    const data = dataRef.current;
    data.focusActive = false;
    data.targetFocusX = 0.5;
    data.targetFocusY = 0.5;
    data.renderFocusX = 0.5;
    data.renderFocusY = 0.5;
    data.targetFocusViewX = 0;
    data.targetFocusViewY = 0;
    data.renderFocusViewX = 0;
    data.renderFocusViewY = 0;
    data.renderFocusAmount = 0;
    data.forceRender = true;
  }

  function focusAt(clientX: number, clientY: number) {
    const imgContainer = depthRef.current;
    const imgLayerBase = baseImageRef.current;

    if (!imgContainer || !imgLayerBase) {
      return;
    }

    const { width, height } = imgLayerBase.getBoundingClientRect();
    const projection = createPlaneProjection(
      window.getComputedStyle(imgLayerBase).transform,
      imgLayerBase.offsetWidth,
      imgLayerBase.offsetHeight,
    );

    if (!width || !height || !projection) {
      return;
    }

    const containerRect = imgContainer.getBoundingClientRect();
    const focusPoint = unprojectPoint(projection, {
      x: clientX - containerRect.left,
      y: clientY - containerRect.top,
    });

    if (
      !focusPoint ||
      focusPoint.x < 0 ||
      focusPoint.x > imgLayerBase.offsetWidth ||
      focusPoint.y < 0 ||
      focusPoint.y > imgLayerBase.offsetHeight
    ) {
      return;
    }

    const data = dataRef.current;
    if (!data.focusActive) {
      data.renderFocusViewX = data.renderX;
      data.renderFocusViewY = data.renderY;
    }
    data.focusActive = true;
    data.targetFocusX = focusPoint.x / imgLayerBase.offsetWidth;
    data.targetFocusY = focusPoint.y / imgLayerBase.offsetHeight;
    data.targetFocusViewX = data.renderX;
    data.targetFocusViewY = data.renderY;
    data.focusing = 0;
    data.forceRender = true;
  }

  async function toggleMotionTracking() {
    if (motionTrackingRef.current) {
      motionTrackingRef.current = false;
      motionOriginRef.current = null;
      setMotionTrackingStatus("idle");
      return;
    }

    if (!("DeviceOrientationEvent" in window)) {
      setMotionTrackingStatus("unsupported");
      return;
    }

    setMotionTrackingStatus("requesting");

    try {
      const DeviceOrientation =
        window.DeviceOrientationEvent as DeviceOrientationEventWithPermission;
      const permission = DeviceOrientation.requestPermission
        ? await DeviceOrientation.requestPermission()
        : "granted";

      if (permission !== "granted") {
        setMotionTrackingStatus("denied");
        return;
      }

      motionOriginRef.current = null;
      motionTrackingRef.current = true;
      setMotionTrackingStatus("enabled");
    } catch {
      setMotionTrackingStatus("error");
    }
  }

  useEffect(() => {
    if (!("DeviceOrientationEvent" in window)) {
      return;
    }

    const DeviceOrientation =
      window.DeviceOrientationEvent as DeviceOrientationEventWithPermission;

    // iOS only exposes motion data after a user-triggered permission request,
    // so the permission API itself is the capability signal there.
    if (DeviceOrientation.requestPermission) {
      setMotionTrackingAvailable(true);
      return;
    }

    function detectMotionData(event: DeviceOrientationEvent) {
      if (event.beta === null || event.gamma === null) {
        return;
      }

      setMotionTrackingAvailable(true);
      window.removeEventListener("deviceorientation", detectMotionData, true);
    }

    window.addEventListener("deviceorientation", detectMotionData, true);

    return () => {
      window.removeEventListener("deviceorientation", detectMotionData, true);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    set("photo", photo);
    set("volume", 0);
    set("renderLayerSeparation", 0);
    set("focusing", Date.now());
    setPhotoDepthMap([]);

    const depthMapClamp = 82;
    async function updateDepthLayers(depthSources: readonly DepthSource[]) {
      const data = dataRef.current;
      console.log("SLICING!", ui.slices, data.slices);

      const spread = ui.spread * data.slices;

      const sliceArr: [number, number][] = new Array(data.slices)
        .fill(0)
        .map((_, i) => {
          const progress = ((i + 0.5) / data.slices) * depthMapClamp;
          const sliceDiff = (100 / data.slices) * spread;
          return [
            Math.max(progress - sliceDiff),
            Math.min(progress + sliceDiff, 100),
          ];
        });

      const newDepthMap = await depthSlicer(depthSources, sliceArr);

      if (cancelled) return;
      setPhotoDepthMap(newDepthMap);
      set("volume", ui.volume);
    }
    const depthMaps = photos[photo].depthMaps;
    const depthSources: readonly DepthSource[] =
      depthModel === "combined"
        ? [depthMaps.v2, depthMaps.v3Mono]
        : [depthMaps[depthModel]];
    updateDepthLayers(depthSources);

    return () => {
      cancelled = true;
    };
  }, [depthModel, photo, ui.slices, ui.spread]);

  const photoData = photos[photo];

  useEffect(() => {
    function onCursorMove(e: MouseEvent) {
      if (motionTrackingRef.current) {
        return;
      }

      const data = dataRef.current;

      const { innerWidth, innerHeight } = window;

      const centerX = innerWidth / 2;
      const centerY = innerHeight / 2;

      const scaleX = innerHeight > innerWidth ? 1.25 : 1;

      data.targetX =
        ((e.clientX - centerX) / (innerWidth + innerHeight)) * scaleX;
      data.targetY = (e.clientY - centerY) / (innerWidth + innerHeight);
    }
    function onCursorMoveTouch(e: TouchEvent) {
      if (!e.touches[0]) {
        return;
      }

      // @ts-ignore
      onCursorMove(e.touches[0]);
    }
    function onResize() {
      dataRef.current.forceRender = true;
    }

    window.addEventListener("mousemove", onCursorMove);
    window.addEventListener("touchmove", onCursorMoveTouch);
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("mousemove", onCursorMove);
      window.removeEventListener("touchmove", onCursorMoveTouch);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    if (motionTrackingStatus !== "enabled") {
      return;
    }

    function onDeviceOrientation(event: DeviceOrientationEvent) {
      if (!motionTrackingRef.current) {
        return;
      }

      if (event.beta === null || event.gamma === null) {
        return;
      }

      const data = dataRef.current;
      const screenAngle = getScreenAngle();
      let origin = motionOriginRef.current;

      if (!origin || origin.screenAngle !== screenAngle) {
        origin = {
          beta: event.beta,
          gamma: event.gamma,
          screenAngle,
          targetX: data.targetX,
          targetY: data.targetY,
        };
        motionOriginRef.current = origin;
        return;
      }

      const betaDelta = shortestAngleDelta(event.beta, origin.beta);
      const gammaDelta = shortestAngleDelta(event.gamma, origin.gamma);
      const normalizedScreenAngle = ((screenAngle % 360) + 360) % 360;
      let horizontalDelta = gammaDelta;
      let verticalDelta = betaDelta;

      if (normalizedScreenAngle === 90) {
        horizontalDelta = betaDelta;
        verticalDelta = -gammaDelta;
      } else if (normalizedScreenAngle === 180) {
        horizontalDelta = -gammaDelta;
        verticalDelta = -betaDelta;
      } else if (normalizedScreenAngle === 270) {
        horizontalDelta = -betaDelta;
        verticalDelta = gammaDelta;
      }

      data.targetX = clampMotionTarget(
        origin.targetX + horizontalDelta * MOTION_SENSITIVITY,
      );
      data.targetY = clampMotionTarget(
        origin.targetY + verticalDelta * MOTION_SENSITIVITY,
      );
      data.forceRender = true;
    }

    window.addEventListener("deviceorientation", onDeviceOrientation, true);

    return () => {
      window.removeEventListener(
        "deviceorientation",
        onDeviceOrientation,
        true,
      );
    };
  }, [motionTrackingStatus]);

  useEffect(() => {
    const imgContainer = depthRef.current;

    if (!imgContainer) {
      return;
    }

    let animationFrame = 0;

    function updateStyles() {
      const data = dataRef.current;
      if (!imgContainer) {
        return;
      }

      const allImgElements = imgContainer.querySelectorAll("img");

      const imgLayerBase = allImgElements[0];
      const imgLayers = Array.from(allImgElements).slice(1);

      if (!imgLayerBase) {
        return;
      }

      const targetLayerSeparation = data.volume / data.slices;

      let targetX = data.targetX;
      let targetY = data.targetY;

      // @ts-ignore
      const targetFocus = photos[data.photo].focus;
      if (data.focusing && targetFocus) {
        const now = Date.now();

        if (now > data.focusing + SNAP_TIME) {
          data.focusing = 0;
        } else {
          if (now < data.focusing + LOCK_CURSOR_TIME) {
            targetX = data.renderX;
            targetY = data.renderY;
          } else {
            targetX = (targetFocus.x * window.innerWidth) / 1512;
            targetY = (targetFocus.y * window.innerHeight) / 857;
          }

          data.targetX = targetX;
          data.targetY = targetY;
        }
      }

      const checkTotalDiff =
        Math.abs(targetX - data.renderX) + Math.abs(targetY - data.renderY);
      const checkLayerDiff = Math.abs(
        targetLayerSeparation - data.renderLayerSeparation,
      );
      const checkFocusDiff = data.focusActive
        ? Math.abs(data.targetFocusX - data.renderFocusX) +
          Math.abs(data.targetFocusY - data.renderFocusY) +
          Math.abs(data.targetFocusViewX - data.renderFocusViewX) +
          Math.abs(data.targetFocusViewY - data.renderFocusViewY) +
          Math.abs(1 - data.renderFocusAmount)
        : data.renderFocusAmount;
      if (
        checkTotalDiff < 0.01 &&
        checkLayerDiff < 0.1 &&
        checkFocusDiff < 0.0001 &&
        !data.forceRender &&
        !data.focusing
      ) {
        data.forceRender = false;
        animationFrame = window.requestAnimationFrame(updateStyles);
        return;
      }
      data.forceRender = false;

      const movementTension = data.focusing
        ? WEAK_SPRING_TENSION
        : SPRING_TENSION;

      data.renderX =
        data.renderX * movementTension + targetX * (1 - movementTension);
      data.renderY =
        data.renderY * movementTension + targetY * (1 - movementTension);

      data.renderLayerSeparation =
        data.renderLayerSeparation * WEAK_SPRING_TENSION +
        targetLayerSeparation * (1 - WEAK_SPRING_TENSION);

      if (data.focusActive) {
        data.renderFocusX =
          data.renderFocusX * SPRING_TENSION +
          data.targetFocusX * (1 - SPRING_TENSION);
        data.renderFocusY =
          data.renderFocusY * SPRING_TENSION +
          data.targetFocusY * (1 - SPRING_TENSION);
        data.renderFocusViewX =
          data.renderFocusViewX * SPRING_TENSION +
          data.targetFocusViewX * (1 - SPRING_TENSION);
        data.renderFocusViewY =
          data.renderFocusViewY * SPRING_TENSION +
          data.targetFocusViewY * (1 - SPRING_TENSION);
        data.renderFocusAmount =
          data.renderFocusAmount * SPRING_TENSION + 1 - SPRING_TENSION;

        if (Math.abs(data.targetFocusX - data.renderFocusX) < 0.00001) {
          data.renderFocusX = data.targetFocusX;
        }
        if (Math.abs(data.targetFocusY - data.renderFocusY) < 0.00001) {
          data.renderFocusY = data.targetFocusY;
        }
        if (Math.abs(data.targetFocusViewX - data.renderFocusViewX) < 0.00001) {
          data.renderFocusViewX = data.targetFocusViewX;
        }
        if (Math.abs(data.targetFocusViewY - data.renderFocusViewY) < 0.00001) {
          data.renderFocusViewY = data.targetFocusViewY;
        }
        if (Math.abs(1 - data.renderFocusAmount) < 0.00001) {
          data.renderFocusAmount = 1;
        }
      }

      const x = data.renderX * 0.618;
      const y = data.renderY * 0.618;

      const xDeg = Math.round(x * 180 * 100) / 100;
      const yDeg = Math.round(-y * 180 * 100) / 100;

      const offset = data.renderLayerSeparation;
      const baseOffset = Math.round(
        data.renderLayerSeparation * data.slices * -0.33,
      );

      const baseTransform = `perspective(${CSS_PERSPECTIVE}px) rotateX(${yDeg}deg) rotateY(${xDeg}deg) translateZ(${baseOffset}px)`;
      imgLayerBase.style.transform = baseTransform;

      const imageWidth = imgLayerBase.offsetWidth;
      const imageHeight = imgLayerBase.offsetHeight;
      const focusPoint = {
        x: data.renderFocusX * imageWidth,
        y: data.renderFocusY * imageHeight,
      };
      const focusX = data.renderFocusViewX * 0.618;
      const focusY = data.renderFocusViewY * 0.618;
      const focusXDeg = Math.round(focusX * 180 * 100) / 100;
      const focusYDeg = Math.round(-focusY * 180 * 100) / 100;
      const focusBaseTransform = `perspective(${CSS_PERSPECTIVE}px) rotateX(${focusYDeg}deg) rotateY(${focusXDeg}deg) translateZ(${baseOffset}px)`;
      const baseProjection = data.focusActive
        ? createPlaneProjection(focusBaseTransform, imageWidth, imageHeight)
        : null;
      const projectedFocus = baseProjection
        ? projectPoint(baseProjection, focusPoint)
        : null;

      for (let i = 0; i < imgLayers.length; i++) {
        // hack - first layer looks better if it is closer than the others
        const imgLayer = imgLayers[i];
        const layerOffset = offset * (i + 0.5) + baseOffset;
        const layerTransform = `perspective(${CSS_PERSPECTIVE}px) rotateX(${yDeg}deg) rotateY(${xDeg}deg) translateZ(${layerOffset}px)`;

        if (projectedFocus && data.renderFocusAmount > 0) {
          const focusLayerTransform = `perspective(${CSS_PERSPECTIVE}px) rotateX(${focusYDeg}deg) rotateY(${focusXDeg}deg) translateZ(${layerOffset}px)`;
          const layerProjection = createPlaneProjection(
            focusLayerTransform,
            imageWidth,
            imageHeight,
          );
          const layerPoint = layerProjection
            ? unprojectPoint(layerProjection, projectedFocus)
            : null;

          if (layerPoint) {
            const translateX =
              (layerPoint.x - focusPoint.x) * data.renderFocusAmount;
            const translateY =
              (layerPoint.y - focusPoint.y) * data.renderFocusAmount;
            imgLayer.style.transform = `perspective(${CSS_PERSPECTIVE}px) rotateX(${yDeg}deg) rotateY(${xDeg}deg) translate3d(${translateX}px, ${translateY}px, ${layerOffset}px)`;
            continue;
          }
        }

        imgLayer.style.transform = layerTransform;
      }

      animationFrame = window.requestAnimationFrame(updateStyles);
    }
    updateStyles();

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <>
      <div id="depth" ref={depthRef} className="frame">
        <img
          id="image"
          ref={baseImageRef}
          alt=""
          className="absolute top-0 left-0 layer"
          src={photoData.src}
          draggable={false}
          onClick={(event) => focusAt(event.clientX, event.clientY)}
        />

        {photoDepthMap.map((depth, i) => (
          <img
            key={i}
            id={`image-${i}`}
            alt=""
            className="absolute top-0 left-0 layer layer-masked pointer-events-none"
            src={photoData.src}
            draggable={false}
            style={{
              maskImage: `url(${depth})`,
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-1 p-2">
        <Select
          value={String(photo)}
          onValueChange={(e) => {
            resetClickFocus();
            dataRef.current.forceRender = true;
            setPhoto(e as keyof typeof photos);
          }}
        >
          <SelectTrigger className="w-[135px]">
            <SelectValue placeholder="Change photo" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem disabled value="Select Photo" className="w-[150px]">
                Select Photo
              </SelectItem>
              {Object.keys(photos).map((key) => (
                <SelectItem key={key} value={key}>
                  {key}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select
          value={String(ui.volume)}
          onValueChange={(e) => {
            set("volume", Number(e));
            setUI((ui) => ({ ...ui, volume: Number(e) }));
          }}
        >
          <SelectTrigger className="w-[82px]">
            <SelectValue placeholder="Volume" />
          </SelectTrigger>
          <SelectContent
            onBlur={() => {
              set("volume", ui.volume);
            }}
          >
            <SelectGroup>
              <SelectItem disabled value="Volume">
                Volume
              </SelectItem>

              {VOLUME_SCALE.map((separation) => (
                <SelectItem
                  key={separation}
                  onFocus={() => {
                    set("volume", separation);
                  }}
                  value={String(separation)}
                >
                  {separation}px
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select
          value={String(ui.slices)}
          onValueChange={(e) => {
            set("slices", Number(e));
            setUI((ui) => ({ ...ui, slices: Number(e) }));
          }}
        >
          <SelectTrigger className="w-[60px]">
            <SelectValue placeholder="Layer Separation" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem disabled value="Slices">
                Slices
              </SelectItem>
              {SLICES_OPTIONS.map((slices) => (
                <SelectItem key={slices} value={String(slices)}>
                  {slices}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select
          value={String(ui.spread)}
          onValueChange={(e) => {
            setUI((ui) => ({ ...ui, spread: Number(e) }));
          }}
        >
          <SelectTrigger className="w-[82px]">
            <SelectValue placeholder="Layer Spread" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem disabled value="Layer Spread">
                Layer Spread
              </SelectItem>
              {SPREAD_OPTIONS.map((spread) => (
                <SelectItem key={spread} value={String(spread)}>
                  {spread * 100}%
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select
          value={depthModel}
          onValueChange={(value) => setDepthModel(value as DepthModel)}
        >
          <SelectTrigger aria-label="Depth model" className="w-[100px]">
            <SelectValue>{DEPTH_MODEL_SHORT_LABELS[depthModel]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem disabled value="Depth Model">
                Depth Model
              </SelectItem>
              {(Object.keys(depthModels) as DepthModel[]).map((model) => (
                <SelectItem key={model} value={model}>
                  {depthModels[model]}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        {motionTrackingAvailable && (
          <Button
            type="button"
            size="sm"
            variant={motionTrackingStatus === "enabled" ? "default" : "outline"}
            aria-label={
              motionTrackingStatus === "enabled"
                ? "Disable motion tracking"
                : "Enable motion tracking"
            }
            aria-pressed={motionTrackingStatus === "enabled"}
            aria-busy={motionTrackingStatus === "requesting"}
            disabled={motionTrackingStatus === "requesting"}
            onClick={toggleMotionTracking}
          >
            Motion Tracking
          </Button>
        )}

        {motionTrackingStatus === "denied" && (
          <span role="status" className="self-center px-1 text-sm">
            Motion access was denied.
          </span>
        )}
        {motionTrackingStatus === "error" && (
          <span role="status" className="self-center px-1 text-sm">
            Motion tracking could not be enabled.
          </span>
        )}
      </div>
      <SidebarLayer layers={photoDepthMap} />
      <Footer />
    </>
  );
}

function SidebarLayer({ layers }: { layers: string[] }) {
  return (
    <div
      className="hidden lg:block fixed h-dvh"
      style={{
        overflowY: "auto",
        overflowX: "hidden",
        top: 0,
        right: 0,
      }}
    >
      <div className="flex flex-col gap-2 p-2 rounded-3xl m-2 bg-gray-200">
        {layers.map((layer, i) => (
          <img
            key={i}
            id={`image-${i}`}
            alt=""
            className="rounded-2xl block bg-gray-400"
            style={{
              backgroundImage: `url("/checkers.svg")`,
              backgroundRepeat: `repeat`,
              width: 80 * 2,
              height: 100 * 2,
            }}
            src={layer}
          />
        ))}
      </div>
    </div>
  );
}

function Footer() {
  return (
    <div className="fixed bottom-4 left-4 text-sm">
      Depth map rendered with CSS masks proof of concept.
      <br />
      {"By "}
      <a className="underline" href="https://twitter.com/javierbyte">
        @javierbyte
      </a>
      {". Depth maps by "}
      <a className="underline" href="https://depth-anything-v2.github.io/">
        Depth Anything V2
      </a>
      {" and "}
      <a
        className="underline"
        href="https://replicate.com/vufinder/depth-anything-v3-mono"
      >
        Depth Anything V3 Mono
      </a>
      {". "}
      <a
        className="underline"
        href="https://github.com/javierbyte/depth-of-field"
      >
        Source
      </a>
      {"."}
    </div>
  );
}
