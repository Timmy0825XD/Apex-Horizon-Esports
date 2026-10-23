import { escapeHtml, renderDiscordMarkdown, safeHttpUrl, type AssetResolver } from "./markdown.js";
import type { TranscriptMentionMaps } from "./types.js";

type UnknownRecord = Record<string, unknown>;

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
    return `<section class="v2-container"${accent ? ` style="--v2-color:${accent}"` : ""}>${nested
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
    return `<a class="v2-file" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">📄 ${escapeHtml(filename)}</a>`;
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
    return url
      ? `<a class="component-button style-${number(component.style) ?? 1}" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`
      : `<span class="component-button style-${number(component.style) ?? 1}${component.disabled ? " disabled" : ""}">${label}</span>`;
  }
  if (type != null && type >= 3 && type <= 8) {
    const options = children(component.options)
      .map((entry) => escapeHtml(string(record(entry).label)))
      .filter(Boolean);
    const summary = escapeHtml(string(component.placeholder) || "Select menu");
    return `<details class="component-select"><summary>${summary}</summary>${options.length ? `<div>${options.join("<br>")}</div>` : ""}</details>`;
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
