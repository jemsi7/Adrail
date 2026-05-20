import { networkInterfaces, type NetworkInterfaceInfo } from "node:os";
import type { NextConfig } from "next";

type NetworkInterfaceMap = ReturnType<typeof networkInterfaces>;

export function parseConfiguredDevOrigins(value = process.env.NEXT_ALLOWED_DEV_ORIGINS) {
  return (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0 && origin !== "*");
}

export function collectLanDevOrigins(interfaces: NetworkInterfaceMap = networkInterfaces()) {
  return Object.values(interfaces)
    .flatMap((entries) => entries ?? [])
    .filter((entry): entry is NetworkInterfaceInfo => Boolean(entry))
    .filter((entry) => entry.family === "IPv4" && !entry.internal)
    .map((entry) => entry.address);
}

export function buildAllowedDevOrigins({
  configuredOrigins = process.env.NEXT_ALLOWED_DEV_ORIGINS,
  interfaces = networkInterfaces()
}: {
  configuredOrigins?: string;
  interfaces?: NetworkInterfaceMap;
} = {}) {
  return Array.from(new Set([
    ...parseConfiguredDevOrigins(configuredOrigins),
    ...collectLanDevOrigins(interfaces)
  ]));
}

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: buildAllowedDevOrigins()
};

export default nextConfig;
