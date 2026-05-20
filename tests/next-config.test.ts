import { describe, expect, it } from "vitest";
import type { NetworkInterfaceInfo } from "node:os";
import {
  buildAllowedDevOrigins,
  collectLanDevOrigins,
  parseConfiguredDevOrigins
} from "../next.config";

function networkEntry(address: string, family: "IPv4" | "IPv6", internal: boolean): NetworkInterfaceInfo {
  return {
    address,
    family,
    internal,
    mac: "00:00:00:00:00:00",
    netmask: family === "IPv4" ? "255.255.255.0" : "ffff:ffff:ffff:ffff::",
    cidr: family === "IPv4" ? `${address}/24` : `${address}/64`,
    scopeid: family === "IPv6" ? 1 : undefined
  } as NetworkInterfaceInfo;
}

describe("Next dev external-origin config", () => {
  it("collects LAN IPv4 hosts that Next can allowlist for dev resources", () => {
    const origins = collectLanDevOrigins({
      en0: [networkEntry("10.18.0.84", "IPv4", false)],
      lo0: [networkEntry("127.0.0.1", "IPv4", true)],
      utun0: [networkEntry("fe80::151e:d6b7:47fc:5e03", "IPv6", false)]
    });

    expect(origins).toEqual(["10.18.0.84"]);
  });

  it("ignores a blanket wildcard because Next only supports exact or subdomain patterns", () => {
    expect(parseConfiguredDevOrigins("*,demo.local,*.ngrok-free.app")).toEqual([
      "demo.local",
      "*.ngrok-free.app"
    ]);
  });

  it("deduplicates configured and discovered dev origins", () => {
    const origins = buildAllowedDevOrigins({
      configuredOrigins: "10.18.0.84, demo.local",
      interfaces: {
        en0: [networkEntry("10.18.0.84", "IPv4", false)]
      }
    });

    expect(origins).toEqual(["10.18.0.84", "demo.local"]);
  });
});
