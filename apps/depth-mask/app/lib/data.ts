export const depthModels = {
  v2: "Depth Anything V2",
  v3Mono: "Depth Anything V3 Mono",
  combined: "V2 + V3 Average",
} as const;

export type DepthModel = keyof typeof depthModels;

export const photos = {
  "Tokyo Tower": {
    src: "/3d/tokyo_400.jpg",
    depthMaps: {
      v2: { src: "/3d/tokyo-depth_400.jpg" },
      v3Mono: { src: "/3d/tokyo-depth-v3-mono_400.jpg" },
    },
    focus: {
      x: 0.001,
      y: 0.017,
    },
  },

  Mallorca: {
    src: "/3d/mallorca_400.jpg",
    depthMaps: {
      v2: { src: "/3d/mallorca-depth_400.jpg" },
      v3Mono: { src: "/3d/mallorca-depth-v3-mono_400.jpg" },
    },
    focus: {
      x: -0.002,
      y: -0.011,
    },
  },

  Siegessäule: {
    src: "/3d/angel_400.jpg",
    depthMaps: {
      v2: { src: "/3d/angel-depth_400.jpg" },
      v3Mono: { src: "/3d/angel-depth-v3-mono_400.jpg" },
    },
    focus: {
      x: -0.002,
      y: 0.087,
    },
  },

  Museumsinsel: {
    src: "/3d/isla_400.jpg",
    depthMaps: {
      v2: { src: "/3d/isla-depth_400.jpg" },
      v3Mono: { src: "/3d/isla-depth-v3-mono_400.jpg" },
    },
    focus: {
      x: 0.035,
      y: 0.015,
    },
  },

  Dotonbori: {
    src: "/3d/osaka_400.jpg",
    depthMaps: {
      v2: { src: "/3d/osaka-depth_400.jpg" },
      v3Mono: { src: "/3d/osaka-depth-v3-mono_400.jpg" },
    },
    focus: {
      x: 0.003,
      y: -0.012,
    },
  },

  Ginza: {
    src: "/3d/ginza_400.jpg",
    depthMaps: {
      v2: { src: "/3d/ginza-depth_400.jpg" },
      v3Mono: { src: "/3d/ginza-depth-v3-mono_400.jpg" },
    },
    focus: {
      x: 0.003,
      y: -0.045,
    },
  },

  "Osaka Castle": {
    src: "/3d/castle_400.jpg",
    depthMaps: {
      v2: { src: "/3d/castle-depth_400.jpg" },
      v3Mono: { src: "/3d/castle-depth-v3-mono_400.jpg" },
    },
    focus: {
      x: -0.075,
      y: 0.054,
    },
  },
} as const;
