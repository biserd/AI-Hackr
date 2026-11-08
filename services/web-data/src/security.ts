import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import ipaddr from "ipaddr.js";
import { AppError, limits } from "./contracts.js";
export function publicAddress(address: string) {
  try {
    const ip = ipaddr.parse(address);
    if (ip.kind() === "ipv6" && (ip as ipaddr.IPv6).isIPv4MappedAddress())
      return false;
    return ip.range() === "unicast";
  } catch {
    return false;
  }
}
export function target(raw: string) {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new AppError("INVALID_INPUT", "Invalid target URL.");
  }
  if (
    !["http:", "https:"].includes(u.protocol) ||
    u.username ||
    u.password ||
    u.port
  )
    throw new AppError(
      "TARGET_RESTRICTED",
      "Only public HTTP(S) on standard ports without credentials is supported.",
      403,
    );
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    (!host.includes(".") && !host.includes(":")) ||
    (ipaddr.isValid(host) && !publicAddress(host))
  )
    throw new AppError(
      "TARGET_RESTRICTED",
      "Private or reserved destination blocked.",
      403,
    );
  for (const key of u.searchParams.keys())
    if (
      /(^|[_-])(token|key|secret|password|signature|sig|credential|authorization)($|[_-])/i.test(
        key,
      ) ||
      /^x-amz-|^x-goog-/i.test(key)
    )
      throw new AppError(
        "TARGET_RESTRICTED",
        "Signed or credential-bearing target URLs are unsupported.",
        403,
      );
  u.hash = "";
  return u;
}
export function canonicalUrl(raw: string) {
  const u = target(raw);
  for (const key of [...u.searchParams.keys()])
    if (/^utm_|^(fbclid|gclid|msclkid)$/i.test(key)) u.searchParams.delete(key);
  u.searchParams.sort();
  return u.href;
}
export async function resolvePublic(u: URL, resolver = dns.lookup) {
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const addresses = await resolver(host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((x) => !publicAddress(x.address)))
    throw new AppError(
      "TARGET_RESTRICTED",
      "DNS resolves to a restricted destination.",
      403,
    );
  return addresses[0];
}
export type FetchResult = {
  body: string;
  url: string;
  status: number;
  contentType: string;
  bytes: number;
};
export async function safeFetch(
  raw: string,
  options: { sameOrigin?: string; maxBytes?: number; timeoutMs?: number } = {},
): Promise<FetchResult> {
  const deadline = Date.now() + (options.timeoutMs ?? 20000);
  let current = target(raw);
  for (let redirects = 0; redirects <= limits.redirects; redirects++) {
    if (options.sameOrigin && current.origin !== options.sameOrigin)
      throw new AppError(
        "TARGET_RESTRICTED",
        "Cross-origin redirect blocked.",
        403,
      );
    const remaining = deadline - Date.now();
    if (remaining <= 0)
      throw new AppError(
        "UPSTREAM_TIMEOUT",
        "Retrieval deadline exceeded.",
        504,
        true,
      );
    const resolved = await resolvePublic(current);
    const result = await new Promise<{
      body: string;
      status: number;
      location?: string;
      contentType: string;
      bytes: number;
    }>((resolve, reject) => {
      const transport = current.protocol === "https:" ? https : http;
      // Connect to the validated IP. The original host remains the HTTP Host and TLS SNI.
      const req = transport.request(
        current,
        {
          agent: false,
          lookup: (_host, opts, cb) => {
            if ((opts as { all?: boolean }).all) (cb as any)(null, [resolved]);
            else cb(null, resolved.address, resolved.family);
          },
          headers: {
            "User-Agent": "AIHackr/0.1 (+https://aihackr.com/web-data)",
            Accept: "text/html,text/plain;q=0.9",
            "Accept-Encoding": "identity",
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          let bytes = 0;
          const max = options.maxBytes ?? limits.responseBytes;
          if (
            res.headers["content-encoding"] &&
            res.headers["content-encoding"] !== "identity"
          ) {
            res.destroy();
            reject(
              new AppError(
                "UNSUPPORTED_CONTENT",
                "Compressed response despite identity request.",
                422,
              ),
            );
            return;
          }
          res.on("data", (chunk: Buffer) => {
            bytes += chunk.length;
            if (bytes > max) {
              res.destroy();
              reject(
                new AppError(
                  "UNSUPPORTED_CONTENT",
                  "Response exceeds size limit.",
                  422,
                ),
              );
            } else chunks.push(chunk);
          });
          res.on("end", () =>
            resolve({
              body: Buffer.concat(chunks).toString("utf8"),
              status: res.statusCode ?? 502,
              location: res.headers.location,
              contentType: String(res.headers["content-type"] ?? ""),
              bytes,
            }),
          );
          res.on("error", reject);
        },
      );
      const timer = setTimeout(
        () =>
          req.destroy(
            new AppError(
              "UPSTREAM_TIMEOUT",
              "Retrieval deadline exceeded.",
              504,
              true,
            ),
          ),
        Math.max(1, deadline - Date.now()),
      );
      req.on("close", () => clearTimeout(timer));
      req.on("error", reject);
      req.end();
    });
    if (result.status >= 300 && result.status < 400 && result.location) {
      if (redirects === limits.redirects)
        throw new AppError(
          "TARGET_RESTRICTED",
          "Redirect limit exceeded.",
          403,
        );
      current = target(new URL(result.location, current).href);
      continue;
    }
    return { ...result, url: current.href };
  }
  throw new AppError("UPSTREAM_TIMEOUT", "Redirect limit exceeded.", 504);
}
