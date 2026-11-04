import { escapeHtml, renderDiscordMarkdown, safeHttpUrl, type AssetResolver } from "./markdown.js";
import type { TranscriptMentionMaps } from "./types.js";

type UnknownRecord = Record<string, unknown>;

export const FILE_ICON =
  '<svg class="file-icon" viewBox="0 0 30 40" aria-hidden="true"><path d="M2 0h18l10 10v28a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2Z" fill="#5865f2"/><path d="M20 0v8a2 2 0 0 0 2 2h8Z" fill="#8f99f5"/><path d="M7 20h16M7 25h16M7 30h10" stroke="#fff" stroke-width="2"/></svg>';
const EXTERNAL_ICON =
  '<svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14 3v2h3.6l-9.3 9.3 1.4 1.4L19 6.4V10h2V3h-7ZM5 5h6V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6h-2v6H5V5Z"/></svg>';
const CHEVRON_ICON =
  '<svg class="select-chevron" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5.3 9.3a1 1 0 0 1 1.4 0l5.3 5.3 5.3-5.3a1 1 0 1 1 1.4 1.4l-6 6a1 1 0 0 1-1.4 0l-6-6a1 1 0 0 1 0-1.4Z"/></svg>';

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? (value as UnknownRecord) : {};
}

function string(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function children(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function color(value: unknown): string | null {
  const numeric = number(value);
  return numeric == null ? null : `#${Math.max(0, Math.min(0xffffff, numeric)).toString(16).padStart(6, "0")}`;
}

function image(
  source: string,
  className: string,
  alt: string,
  resolveAsset: AssetResolver,
): string {
  const url = safeHttpUrl(source);
  if (!url) return "";
  const renderedUrl = resolveAsset(url);
  if (!renderedUrl) return "";
  return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"><img class="${className}" src="${escapeHtml(renderedUrl)}" alt="${escapeHtml(alt)}" loading="lazy"></a>`;
}

function renderEmoji(value: unknown, resolveAsset: AssetResolver): string {
  const emoji = record(value);
  const id = string(emoji.id);
  const name = string(emoji.name);
  if (!id) return escapeHtml(name);
  const url = `https://cdn.discordapp.com/emojis/${id}.${emoji.animated ? "gif" : "png"}`;
  const renderedUrl = resolveAsset(url);
  return renderedUrl
    ? `<img class="emoji" src="${escapeHtml(renderedUrl)}" alt="${escapeHtml(name)}">`
    : escapeHtml(name);
}

export function renderEmbeds(
  embeds: unknown[],
  mentions: TranscriptMentionMaps,
  resolveAsset: AssetResolver,
): string {
  return embeds
    .map((raw) => {
      const embed = record(raw);
      const accent = color(embed.color);
      const author = record(embed.author);
      const footer = record(embed.footer);
      const imageData = record(embed.image);
      const thumbnail = record(embed.thumbnail);
      const fields = children(embed.fields);
      const title = string(embed.title);
      const titleUrl = safeHttpUrl(string(embed.url));
      const authorIcon = image(string(author.icon_url), "embed-author-icon", "", resolveAsset);
      const footerIcon = image(string(footer.icon_url), "embed-footer-icon", "", resolveAsset);
      const titleHtml = title
        ? titleUrl
          ? `<a class="embed-title" href="${escapeHtml(titleUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(title)}</a>`
          : `<div class="embed-title">${escapeHtml(title)}</div>`
        : "";
      const fieldsHtml = fields
        .map((entry) => {
          const field = record(entry);
          return `<div class="embed-field${field.inline ? " inline" : ""}"><strong>${escapeHtml(string(field.name))}</strong><div>${renderDiscordMarkdown(string(field.value), mentions, resolveAsset)}</div></div>`;
        })
        .join("");
      return [
        `<article class="embed"${accent ? ` style="--embed-color:${accent}"` : ""}>`,
        string(author.name)
          ? `<div class="embed-author">${authorIcon}<strong>${escapeHtml(string(author.name))}</strong></div>`
          : "",
        titleHtml,
        string(embed.description)
          ? `<div class="embed-description">${renderDiscordMarkdown(string(embed.description), mentions, resolveAsset)}</div>`
          : "",
        fieldsHtml ? `<div class="embed-fields">${fieldsHtml}</div>` : "",
        image(string(imageData.url), "embed-image", string(imageData.description) || "Embed image", resolveAsset),
        image(string(thumbnail.url), "embed-thumbnail", string(thumbnail.description) || "Embed thumbnail", resolveAsset),
        string(footer.text) || string(embed.timestamp)
          ? `<div class="embed-footer">${footerIcon}<span>${escapeHtml(string(footer.text))}${footer.text && embed.timestamp ? " • " : ""}${escapeHtml(string(embed.timestamp))}</span></div>`
          : "",
        "</article>",
      ].join("");
    })
    .join("");
}

function renderComponent(
  raw: unknown,
  mentions: TranscriptMentionMaps,
  resolveAsset: AssetResolver,
): string {
  const component = record(raw);
  const type = number(component.type);
  const nested = children(component.components);

  if (type === 17) {
    const accent = color(component.accent_color);
    return `<section class="v2-container${accent ? " accent" : ""}"${accent ? ` style="--v2-color:${accent}"` : ""}>${nested
      .map((entry) => renderComponent(entry, mentions, resolveAsset))
      .join("")}</section>`;
  }
  if (type === 9) {
    const accessory = component.accessory
      ? `<div class="v2-accessory">${renderComponent(component.accessory, mentions, resolveAsset)}</div>`
      : "";
    return `<div class="v2-section"><div class="v2-section-content">${nested
      .map((entry) => renderComponent(entry, mentions, resolveAsset))
      .join("")}</div>${accessory}</div>`;
  }
  if (type === 10) {
    return `<div class="v2-text">${renderDiscordMarkdown(string(component.content), mentions, resolveAsset)}</div>`;
  }
  if (type === 11) {
    const media = record(component.media);
    return image(string(media.url), "v2-thumbnail", string(component.description) || "Thumbnail", resolveAsset);
  }
  if (type === 12) {
    const items = children(component.items)
      .map((entry) => {
        const item = record(entry);
        const media = record(item.media);
        return image(string(media.url), "v2-media", string(item.description) || "Gallery image", resolveAsset);
      })
      .join("");
    return `<div class="v2-gallery">${items}</div>`;
  }
  if (type === 13) {
    const file = record(component.file);
    const url = safeHttpUrl(string(file.url));
    if (!url) return "";
    const rawFilename = new URL(url).pathname.split("/").pop() ?? "Attached file";
    let filename = rawFilename;
    try {
      filename = decodeURIComponent(rawFilename);
    } catch {
      // Keep the encoded name when the remote URL contains malformed percent escapes.
    }
    return `<a class="v2-file" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${FILE_ICON}<span class="file-name">${escapeHtml(filename)}</span></a>`;
  }
  if (type === 14) {
    return component.divider === false ? '<div class="v2-space"></div>' : "<hr>";
  }
  if (type === 1) {
    return `<div class="component-row">${nested
      .map((entry) => renderComponent(entry, mentions, resolveAsset))
      .join("")}</div>`;
  }
  if (type === 2) {
    const url = safeHttpUrl(string(component.url));
    const label = `${renderEmoji(component.emoji, resolveAsset)}${component.emoji ? " " : ""}${escapeHtml(string(component.label) || "Button")}`;
    const style = number(component.style) ?? 1;
    const disabled = component.disabled ? " disabled" : "";
    return url
      ? `<a class="component-button style-${style}${disabled}" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${label}${EXTERNAL_ICON}</a>`
      : `<span class="component-button style-${style}${disabled}">${label}</span>`;
  }
  if (type != null && type >= 3 && type <= 8) {
    const options = children(component.options)
      .map((entry) => escapeHtml(string(record(entry).label)))
      .filter(Boolean);
    const summary = escapeHtml(string(component.placeholder) || "Select menu");
    return `<details class="component-select"><summary><span>${summary}</span>${CHEVRON_ICON}</summary>${options.length ? `<div class="component-options">${options.map((option) => `<span>${option}</span>`).join("")}</div>` : ""}</details>`;
  }
  if (nested.length) {
    return nested.map((entry) => renderComponent(entry, mentions, resolveAsset)).join("");
  }
  return "";
}

export function renderComponents(
  components: unknown[],
  mentions: TranscriptMentionMaps,
  resolveAsset: AssetResolver,
): string {
  return components.map((component) => renderComponent(component, mentions, resolveAsset)).join("");
}
