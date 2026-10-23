import type { TranscriptMentionMaps } from "./types.js";

export type AssetResolver = (url: string) => string;

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function safeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

export function humanFileSize(bytes: number): string {
  return formatBytes(bytes);
}

function roleStyle(color: string | null): string {
  return color ? ` style="--mention-color:${escapeHtml(color)}"` : "";
}

export function renderDiscordMarkdown(
  source: string,
  mentions: TranscriptMentionMaps,
  resolveAsset: AssetResolver,
): string {
  if (!source) {
    return "";
  }

  const stored: string[] = [];
  const stash = (html: string): string => {
    const index = stored.push(html) - 1;
    return `\u0000TRANSCRIPT${index}\u0000`;
  };

  let text = source.replace(/```([^\n`]*)\n?([\s\S]*?)```/g, (_match, language: string, body: string) => {
    const languageLabel = language.trim()
      ? `<span class="code-language">${escapeHtml(language.trim())}</span>`
      : "";
    return stash(
      `<pre>${languageLabel}<code>${escapeHtml(body.replace(/\n$/, ""))}</code></pre>`,
    );
  });

  text = text.replace(/`([^`\n]+)`/g, (_match, body: string) =>
    stash(`<code class="inline-code">${escapeHtml(body)}</code>`),
  );

  text = text.replace(/<(a?):([A-Za-z0-9_]+):(\d+)>/g, (_match, animated: string, name: string, id: string) => {
    const sourceUrl = `https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "png"}`;
    const url = resolveAsset(sourceUrl);
    return stash(
      url
        ? `<img class="emoji" src="${escapeHtml(url)}" alt=":${escapeHtml(name)}:" title=":${escapeHtml(name)}:">`
        : `:${escapeHtml(name)}:`,
    );
  });

  text = text.replace(/<@!?(\d{17,20})>/g, (_match, id: string) =>
    stash(`<span class="mention user-mention">@${escapeHtml(mentions.users[id] ?? `user-${id}`)}</span>`),
  );
  text = text.replace(/<@&(\d{17,20})>/g, (_match, id: string) => {
    const role = mentions.roles[id];
    return stash(
      `<span class="mention role-mention"${roleStyle(role?.color ?? null)}>@${escapeHtml(role?.name ?? `role-${id}`)}</span>`,
    );
  });
  text = text.replace(/<#(\d{17,20})>/g, (_match, id: string) =>
    stash(`<span class="mention channel-mention">#${escapeHtml(mentions.channels[id] ?? `channel-${id}`)}</span>`),
  );
  text = text.replace(/<\/([^:>]+):(\d{17,20})>/g, (_match, name: string) =>
    stash(`<span class="command-mention">/${escapeHtml(name)}</span>`),
  );
  text = text.replace(/<t:(\d{1,12})(?::([tTdDfFR]))?>/g, (_match, unix: string, style: string | undefined) => {
    const iso = new Date(Number(unix) * 1000).toISOString();
    return stash(
      `<time class="discord-time" datetime="${iso}" data-style="${style ?? "f"}">${escapeHtml(iso)}</time>`,
    );
  });

  text = text.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (_match, label: string, href: string) => {
    const safe = safeHttpUrl(href);
    return safe
      ? stash(
          `<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`,
        )
      : escapeHtml(label);
  });
  text = text.replace(/https?:\/\/[^\s<]+/g, (href) => {
    const trailing = href.match(/[),.!?]+$/)?.[0] ?? "";
    const clean = trailing ? href.slice(0, -trailing.length) : href;
    const safe = safeHttpUrl(clean);
    return safe
      ? `${stash(`<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">${escapeHtml(clean)}</a>`)}${trailing}`
      : href;
  });

  text = escapeHtml(text);
  text = text
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_\n]+)__/g, "<u>$1</u>")
    .replace(/~~([^~\n]+)~~/g, "<s>$1</s>")
    .replace(/\|\|([^|\n]+)\|\|/g, '<span class="spoiler" tabindex="0">$1</span>')
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>")
    .replace(/(?<!_)_([^_\n]+)_(?!_)/g, "<em>$1</em>");

  const lines = text.split("\n").map((line) => {
    if (/^#{1,3}\s/.test(line)) {
      const level = Math.min(3, line.match(/^#+/)?.[0].length ?? 1);
      return `<span class="md-heading md-heading-${level}">${line.replace(/^#{1,3}\s+/, "")}</span>`;
    }
    if (line.startsWith("&gt; ")) {
      return `<span class="blockquote">${line.slice(5)}</span>`;
    }
    if (line.startsWith("-# ")) {
      return `<span class="subtext">${line.slice(3)}</span>`;
    }
    return line;
  });

  return lines
    .join("<br>")
    .replace(/\u0000TRANSCRIPT(\d+)\u0000/g, (_match, index: string) => stored[Number(index)] ?? "");
}
