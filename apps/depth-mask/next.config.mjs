import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// The workspace root, not this app: pnpm symlinks node_modules/next into the
// root .pnpm store, so scoping Turbopack to the app dir puts it out of bounds.
const workspaceRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: workspaceRoot,
  },
};

export default nextConfig;
