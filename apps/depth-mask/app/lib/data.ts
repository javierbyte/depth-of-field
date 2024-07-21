export const photos = {
  "Tokyo Tower": {
    src: "/3d/tokyo_400.jpg",
    depthSrc: "/3d/tokyo-depth_400.jpg",
    focus: {
      x: 0.001,
      y: 0.017,
    },
  },

  Mallorca: {
    src: "/3d/mallorca_400.jpg",
    depthSrc: "/3d/mallorca-depth_400.jpg",
    focus: {
      x: -0.002,
      y: -0.011,
    },
  },

  Siegessäule: {
    src: "/3d/angel_400.jpg",
    depthSrc: "/3d/angel-depth_400.jpg",
    focus: {
      x: -0.002,
      y: 0.087,
    },
  },

  Museumsinsel: {
    src: "/3d/isla_400.jpg",
    depthSrc: "/3d/isla-depth_400.jpg",
    focus: {
      x: 0.035,
      y: 0.015,
    },
  },

  Dotonbori: {
    src: "/3d/osaka_400.jpg",
    depthSrc: "/3d/osaka-depth_400.jpg",
    focus: {
      x: 0.003,
      y: -0.012,
    },
  },

  Ginza: {
    src: "/3d/ginza_400.jpg",
    depthSrc: "/3d/ginza-depth_400.jpg",
    focus: {
      x: 0.003,
      y: -0.045,
    },
  },

  "Osaka Castle": {
    src: "/3d/castle_400.jpg",
    depthSrc: "/3d/castle-depth_400.jpg",
    focus: {
      x: -0.075,
      y: 0.054,
    },
  },
} as const;
