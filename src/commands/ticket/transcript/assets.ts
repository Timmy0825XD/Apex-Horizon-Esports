import { promises as dns } from "node:dns";
import https from "node:https";
import net from "node:net";
import sharp from "sharp";
import type { TranscriptSnapshot } from "./types.js";

const DOWNLOAD_CONCURRENCY = 4;
const DOWNLOAD_TIMEOUT_MS = 5_000;
const MAX_SOURCE_BYTES = 4 * 1024 * 1024;
const MAX_EMBEDDED_BYTES = 6 * 1024 * 1024;
const MAX_ASSETS = 250;
const MAX_REDIRECTS = 3;

function blockedIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }
  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51) ||
    (a === 203 && b === 0) ||
    a >= 224
  );
}

export function isPublicIp(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) {
    return !blockedIpv4(address);
  }
  if (family !== 6) {
    return false;
  }
  const normalized = address.toLowerCase();
  if (normalized.startsWith("::ffff:")) {
    return isPublicIp(normalized.slice(7));
  }
  return !(
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith("ff") ||
    normalized.startsWith("2001:db8") ||
    normalized.startsWith("2001:10") ||
    normalized.startsWith("2001:2")
  );
}

async function publicAddress(hostname: string): Promise<{ address: string; family: 4 | 6 }> {
  const answers = await dns.lookup(hostname, { all: true, verbatim: true });
  const publicAnswers = answers.filter(
    (answer): answer is { address: string; family: 4 | 6 } =>
      (answer.family === 4 || answer.family === 6) && isPublicIp(answer.address),
  );
  if (publicAnswers.length !== answers.length || publicAnswers.length === 0) {
    throw new Error("Remote image resolved to a private or invalid address.");
  }
  return publicAnswers[0];
}

interface DownloadedImage {
  buffer: Buffer;
  contentType: string;
}

async function downloadImage(urlValue: string, redirects = 0): Promise<DownloadedImage> {
  const url = new URL(urlValue);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("Only public HTTPS image URLs can be embedded.");
  }
  const resolved = await publicAddress(url.hostname);

  return new Promise<DownloadedImage>((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif,*/*;q=0.1",
          "User-Agent": "ApexHorizonTranscript/1.0",
        },
        lookup: (_hostname, _options, callback) => callback(null, resolved.address, resolved.family),
      },
      (response) => {
        const status = response.statusCode ?? 0;
        if (status >= 300 && status < 400 && response.headers.location) {
          response.resume();
          if (redirects >= MAX_REDIRECTS) {
            reject(new Error("Remote image redirected too many times."));
            return;
          }
          let redirected: string;
          try {
            redirected = new URL(response.headers.location, url).href;
          } catch {
            reject(new Error("Remote image returned an invalid redirect."));
            return;
          }
          void downloadImage(redirected, redirects + 1).then(resolve, reject);
          return;
        }
        const contentType = String(response.headers["content-type"] ?? "")
          .split(";")[0]
          .trim()
          .toLowerCase();
        if (status < 200 || status >= 300 || !contentType.startsWith("image/")) {
          response.resume();
          reject(new Error("Remote resource is not an image."));
          return;
        }
        const declared = Number(response.headers["content-length"] ?? 0);
        if (declared > MAX_SOURCE_BYTES) {
          response.resume();
          reject(new Error("Remote image is too large."));
          return;
        }

        const chunks: Buffer[] = [];
        let bytes = 0;
        response.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > MAX_SOURCE_BYTES) {
            response.destroy(new Error("Remote image is too large."));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => resolve({ buffer: Buffer.concat(chunks), contentType }));
        response.on("error", reject);
      },
    );
    request.setTimeout(DOWNLOAD_TIMEOUT_MS, () => request.destroy(new Error("Remote image timed out.")));
    request.on("error", reject);
  });
}

async function makePreview(image: DownloadedImage): Promise<{ buffer: Buffer; contentType: string }> {
  try {
    const output = await sharp(image.buffer, { animated: true, limitInputPixels: 40_000_000 })
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78, effort: 3 })
      .toBuffer();
    return { buffer: output, contentType: "image/webp" };
  } catch {
    return image;
  }
}

function addUrl(url: string, urls: Set<string>): void {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:") {
      urls.add(parsed.href);
    }
  } catch {
    // Invalid URLs are not asset candidates.
  }
}

function collectUrls(value: unknown, urls: Set<string>): void {
  if (urls.size >= MAX_ASSETS || value == null) {
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectUrls(entry, urls);
    return;
  }
  if (typeof value !== "object") {
    return;
  }
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (
      typeof entry === "string" &&
      /(?:url|icon|avatar|image|thumbnail|media)/i.test(key) &&
      entry.startsWith("https://")
    ) {
      addUrl(entry, urls);
    } else {
      collectUrls(entry, urls);
    }
  }
}

export function assetUrls(snapshot: TranscriptSnapshot): string[] {
  const urls = new Set<string>();
  for (const message of snapshot.messages) {
    addUrl(message.author.avatarUrl, urls);
    for (const attachment of message.attachments) {
      if (attachment.image) addUrl(attachment.url, urls);
    }
    for (const reaction of message.reactions) {
      if (reaction.imageUrl) addUrl(reaction.imageUrl, urls);
    }
    for (const sticker of message.stickers) addUrl(sticker.url, urls);
    collectUrls(message.embeds, urls);
    collectUrls(message.components, urls);
    for (const forwarded of message.forwards) {
      for (const attachment of forwarded.attachments) {
        if (attachment.image) addUrl(attachment.url, urls);
      }
      for (const sticker of forwarded.stickers) addUrl(sticker.url, urls);
      collectUrls(forwarded.embeds, urls);
      collectUrls(forwarded.components, urls);
    }
    const emojiMatches = `${message.content}\n${message.forwards.map((forwarded) => forwarded.content).join("\n")}`.matchAll(
      /<(?:a?):[A-Za-z0-9_]+:(\d+)>/g,
    );
    for (const match of emojiMatches) {
      addUrl(
        `https://cdn.discordapp.com/emojis/${match[1]}.${match[0].startsWith("<a:") ? "gif" : "png"}`,
        urls,
      );
    }
  }
  return [...urls].slice(0, MAX_ASSETS);
}

export async function embedTranscriptAssets(snapshot: TranscriptSnapshot): Promise<Map<string, string>> {
  const urls = assetUrls(snapshot);
  const embedded = new Map<string, string>();
  let next = 0;
  let usedBytes = 0;

  async function allowExternal(url: string): Promise<boolean> {
    try {
      const candidate = new URL(url);
      if (candidate.protocol !== "https:" || candidate.username || candidate.password) {
        return false;
      }
      await publicAddress(candidate.hostname);
      embedded.set(url, url);
      return true;
    } catch {
      return false;
    }
  }

  async function worker(): Promise<void> {
    for (;;) {
      const index = next;
      next += 1;
      const url = urls[index];
      if (!url) {
        return;
      }
      if (usedBytes >= MAX_EMBEDDED_BYTES) {
        await allowExternal(url);
        continue;
      }
      try {
        const preview = await makePreview(await downloadImage(url));
        if (usedBytes + preview.buffer.length > MAX_EMBEDDED_BYTES) {
          embedded.set(url, url);
          continue;
        }
        usedBytes += preview.buffer.length;
        embedded.set(url, `data:${preview.contentType};base64,${preview.buffer.toString("base64")}`);
      } catch {
        await allowExternal(url);
      }
    }
  }

  await Promise.all(Array.from({ length: DOWNLOAD_CONCURRENCY }, () => worker()));
  return embedded;
}
