import { renderComponents, renderEmbeds } from "./components.js";
import {
  escapeHtml,
  humanFileSize,
  renderDiscordMarkdown,
  safeHttpUrl,
  type AssetResolver,
} from "./markdown.js";
import type {
  RenderedTranscriptPage,
  TranscriptMessage,
  TranscriptSnapshot,
} from "./types.js";

const MAX_PAGE_BYTES = 7 * 1024 * 1024;

const CSS = `
:root{color-scheme:dark;--bg:#313338;--panel:#2b2d31;--panel2:#232428;--text:#dbdee1;--muted:#949ba4;--link:#00a8fc;--mention:#5865f2;--border:#3f4147;font-family:"gg sans","Noto Sans",Arial,sans-serif}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-size:16px;line-height:1.375}a{color:var(--link);text-decoration:none}a:hover{text-decoration:underline}
.transcript-header{position:sticky;top:0;z-index:5;padding:18px 24px;background:rgba(35,36,40,.96);border-bottom:1px solid #1e1f22;backdrop-filter:blur(8px)}.transcript-header h1{font-size:20px;margin:0 0 4px}.header-meta{color:var(--muted);font-size:13px}
.messages{max-width:1100px;margin:0 auto;padding:18px 0 40px}.day{margin:20px 24px 8px;display:flex;align-items:center;gap:12px;color:var(--muted);font-size:12px;font-weight:700}.day:before,.day:after{content:"";height:1px;background:var(--border);flex:1}
.message{position:relative;padding:3px 24px 3px 80px;min-height:48px}.message:hover{background:#2e3035}.message.group-start{padding-top:10px;margin-top:7px}.avatar{position:absolute;left:24px;top:11px;width:40px;height:40px;border-radius:50%;object-fit:cover;background:var(--panel2)}.message.compact{min-height:0}.message.compact .avatar,.message.compact .message-head{display:none}
.message-head{height:22px;display:flex;align-items:baseline;gap:7px}.author{font-weight:600;color:var(--author-color,#f2f3f5)}.bot-badge,.type-badge{padding:1px 4px;border-radius:3px;background:#5865f2;color:white;font-size:10px;font-weight:700;text-transform:uppercase}.type-badge{background:#4e5058}.timestamp{font-size:12px;color:var(--muted)}.edited{font-size:10px;color:var(--muted)}
.content{overflow-wrap:anywhere;white-space:normal}.content:empty{display:none}.mention,.command-mention{display:inline-block;padding:0 2px;border-radius:3px;background:rgba(88,101,242,.28);color:#c9cdfb}.role-mention{background:color-mix(in srgb,var(--mention-color,#5865f2) 28%,transparent);color:color-mix(in srgb,var(--mention-color,#c9cdfb) 62%,white)}.emoji{width:1.375em;height:1.375em;vertical-align:-.32em;object-fit:contain}.inline-code,pre{background:#1e1f22;border:1px solid #111214;border-radius:4px;font-family:Consolas,monospace}.inline-code{padding:1px 4px;font-size:85%}pre{position:relative;padding:10px;overflow:auto;white-space:pre-wrap}pre code{font-size:13px}.code-language{display:block;color:var(--muted);font-size:11px;margin-bottom:5px}.spoiler{background:#1e1f22;color:transparent;border-radius:3px;padding:0 2px}.spoiler:focus,.spoiler:hover{color:inherit}.blockquote{display:block;border-left:4px solid #4e5058;padding-left:8px}.subtext{font-size:12px;color:var(--muted)}.md-heading{display:inline-block;font-weight:700}.md-heading-1{font-size:1.5em}.md-heading-2{font-size:1.25em}
.reply{display:flex;gap:6px;align-items:center;color:var(--muted);font-size:12px;white-space:nowrap;overflow:hidden}.reply:before{content:"↪";font-size:14px}.reply strong{color:#b5bac1}.reply span{overflow:hidden;text-overflow:ellipsis}.forward{margin:4px 0 6px;padding:8px 10px;border-left:4px solid #4e5058;border-radius:4px;background:#232428}.forward-label{margin-bottom:4px;color:var(--muted);font-size:12px}.command-context{display:inline-flex;gap:7px;align-items:center;margin:1px 0 5px;padding:4px 8px;border-radius:4px;background:#2b2d31;color:#b5bac1;font-size:13px}.command-context strong{color:#f2f3f5}
.attachments,.stickers{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}.attachment-image,.sticker{display:block;max-width:min(520px,100%);max-height:420px;border-radius:6px;object-fit:contain;background:var(--panel2)}.attachment-file,.v2-file{display:inline-flex;gap:8px;align-items:center;padding:10px;border:1px solid var(--border);border-radius:6px;background:var(--panel2)}.file-meta{color:var(--muted);font-size:12px}
.embed{position:relative;width:min(520px,100%);margin-top:6px;padding:12px 14px;border-left:4px solid var(--embed-color,#4e5058);border-radius:4px;background:#2b2d31;overflow:hidden}.embed-author{display:flex;align-items:center;gap:8px;font-size:13px}.embed-author-icon,.embed-footer-icon{width:24px;height:24px;border-radius:50%;object-fit:cover}.embed-footer-icon{width:20px;height:20px}.embed-title{display:block;margin-top:6px;font-weight:700}.embed-description{margin-top:6px}.embed-fields{display:grid;grid-template-columns:repeat(12,1fr);gap:8px;margin-top:8px}.embed-field{grid-column:span 12;font-size:14px}.embed-field.inline{grid-column:span 4}.embed-field strong{display:block;color:#f2f3f5}.embed-image{display:block;max-width:100%;max-height:420px;margin-top:12px;border-radius:4px}.embed-thumbnail{float:right;max-width:80px;max-height:80px;margin:8px 0 8px 14px;border-radius:4px}.embed-footer{display:flex;align-items:center;gap:6px;clear:both;margin-top:10px;color:var(--muted);font-size:12px}
.v2-container{width:min(760px,100%);margin-top:6px;padding:12px;border:1px solid var(--border);border-left:4px solid var(--v2-color,#4e5058);border-radius:8px;background:#2b2d31}.v2-container>*+*{margin-top:8px}.v2-section{display:flex;gap:12px;align-items:flex-start}.v2-section-content{flex:1;min-width:0}.v2-section-content>*+*{margin-top:6px}.v2-accessory{flex:none}.v2-thumbnail{width:84px;height:84px;border-radius:8px;object-fit:cover}.v2-gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:6px}.v2-media{width:100%;max-height:440px;border-radius:6px;object-fit:contain;background:var(--panel2)}.v2-space{height:8px}.v2-container hr{border:0;border-top:1px solid var(--border);margin:8px 0}
.component-row{display:flex;flex-wrap:wrap;gap:8px}.component-button,.component-select{display:inline-block;padding:7px 14px;border-radius:4px;background:#4e5058;color:#fff;font-weight:600;font-size:14px}.component-button.style-1{background:#5865f2}.component-button.style-3{background:#248046}.component-button.style-4{background:#da373c}.component-button.disabled{opacity:.45}.component-select summary{cursor:default;min-width:180px}.component-select div{padding-top:6px;color:#dbdee1;font-weight:400}
.reactions{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}.reaction{display:inline-flex;align-items:center;gap:4px;height:26px;padding:0 7px;border:1px solid var(--border);border-radius:8px;background:#2b2d31;font-size:13px}.reaction.mine{border-color:#5865f2;background:rgba(88,101,242,.15)}
.technical{margin-top:4px;color:var(--muted);font-size:11px}.technical summary{cursor:pointer;user-select:none}.technical-grid{display:grid;grid-template-columns:max-content 1fr;gap:2px 8px;margin:4px 0 0;padding:7px;border-radius:4px;background:var(--panel2);font-family:Consolas,monospace;overflow-wrap:anywhere}
.empty{padding:60px 24px;text-align:center;color:var(--muted)}.transcript-footer{padding:16px 24px;border-top:1px solid var(--border);color:var(--muted);font-size:12px;text-align:center}
@media(max-width:640px){.message{padding-left:64px;padding-right:12px}.avatar{left:12px}.transcript-header{padding:14px 12px}.embed-field.inline{grid-column:span 12}.v2-section{flex-direction:column}.v2-accessory{order:-1}.messages{padding-top:8px}}
`;

const SCRIPT = `
(()=>{const relative=(date)=>{const seconds=Math.round((date.getTime()-Date.now())/1000);const abs=Math.abs(seconds);const unit=abs<60?"second":abs<3600?"minute":abs<86400?"hour":"day";const size=unit==="second"?seconds:unit==="minute"?Math.round(seconds/60):unit==="hour"?Math.round(seconds/3600):Math.round(seconds/86400);return new Intl.RelativeTimeFormat(undefined,{numeric:"auto"}).format(size,unit)};document.querySelectorAll("time").forEach(node=>{const date=new Date(node.dateTime);if(Number.isNaN(date.getTime()))return;const style=node.dataset.style;if(node.classList.contains("discord-time")&&style==="R")node.textContent=relative(date);else if(node.classList.contains("discord-time")&&style==="t")node.textContent=date.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});else if(node.classList.contains("discord-time")&&style==="D")node.textContent=date.toLocaleDateString([],{dateStyle:"long"});else node.textContent=date.toLocaleString();node.title=date.toISOString()})})();
`;

function resolveFrom(assets: Map<string, string>): AssetResolver {
  return (url) => {
    const direct = assets.get(url);
    if (direct) {
      return direct;
    }
    try {
      return assets.get(new URL(url).href) ?? "";
    } catch {
      return "";
    }
  };
}

function renderReply(message: TranscriptMessage, snapshot: TranscriptSnapshot, resolveAsset: AssetResolver): string {
  if (!message.reply) return "";
  return `<div class="reply"><strong>${escapeHtml(message.reply.authorName ?? "Unknown message")}</strong><span>${message.reply.content ? renderDiscordMarkdown(message.reply.content, snapshot.mentions, resolveAsset) : `Message ${escapeHtml(message.reply.messageId)}`}</span></div>`;
}

function renderForwards(message: TranscriptMessage, snapshot: TranscriptSnapshot, resolveAsset: AssetResolver): string {
  return message.forwards
    .map((forwarded) => {
      const synthetic = {
        ...message,
        content: "",
        embeds: [],
        components: [],
        reactions: [],
        stickers: forwarded.stickers,
        attachments: forwarded.attachments,
        reply: null,
        interaction: null,
        forwards: [],
      };
      const when = forwarded.createdAt ? `<time datetime="${escapeHtml(forwarded.createdAt)}">${escapeHtml(forwarded.createdAt)}</time>` : "original unavailable";
      const body = forwarded.content
        ? `<div class="content">${renderDiscordMarkdown(forwarded.content, snapshot.mentions, resolveAsset)}</div>`
        : "";
      return `<div class="forward"><div class="forward-label">Forwarded message • ${when}</div>${body}${renderEmbeds(forwarded.embeds, snapshot.mentions, resolveAsset)}${renderComponents(forwarded.components, snapshot.mentions, resolveAsset)}${renderAttachments(synthetic, resolveAsset)}${renderStickers(synthetic, resolveAsset)}</div>`;
    })
    .join("");
}

function renderInteraction(message: TranscriptMessage): string {
  const interaction = message.interaction;
  if (!interaction) return "";
  return `<div class="command-context"><span>Command used by <strong>${escapeHtml(interaction.userName)}</strong></span><span class="command-mention">/${escapeHtml(interaction.name)}</span></div>`;
}

function renderAttachments(message: TranscriptMessage, resolveAsset: AssetResolver): string {
  if (!message.attachments.length) return "";
  const content = message.attachments
    .map((attachment) => {
      const url = safeHttpUrl(attachment.url);
      if (!url) return "";
      if (attachment.image) {
        const renderedUrl = resolveAsset(url);
        return renderedUrl
          ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"><img class="attachment-image" src="${escapeHtml(renderedUrl)}" alt="${escapeHtml(attachment.description ?? attachment.name)}" loading="lazy"></a>`
          : `<span class="attachment-file">Image omitted: ${escapeHtml(attachment.name)}</span>`;
      }
      return `<a class="attachment-file" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"><span>📄</span><span><strong>${escapeHtml(attachment.name)}</strong><br><span class="file-meta">${humanFileSize(attachment.size)}</span></span></a>`;
    })
    .join("");
  return content ? `<div class="attachments">${content}</div>` : "";
}

function renderStickers(message: TranscriptMessage, resolveAsset: AssetResolver): string {
  if (!message.stickers.length) return "";
  const content = message.stickers
    .map((sticker) => {
      const url = safeHttpUrl(sticker.url);
      if (!url) return "";
      if (/\.json(?:\?|$)/i.test(url)) {
        return `<a class="attachment-file" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Sticker: ${escapeHtml(sticker.name)}</a>`;
      }
      const renderedUrl = resolveAsset(url);
      return renderedUrl
        ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"><img class="sticker" src="${escapeHtml(renderedUrl)}" alt="${escapeHtml(sticker.name)}" title="${escapeHtml(sticker.description ?? sticker.name)}" loading="lazy"></a>`
        : `<span class="attachment-file">Sticker omitted: ${escapeHtml(sticker.name)}${sticker.description ? ` — ${escapeHtml(sticker.description)}` : ""}</span>`;
    })
    .join("");
  return content ? `<div class="stickers">${content}</div>` : "";
}

function renderReactions(message: TranscriptMessage, resolveAsset: AssetResolver): string {
  if (!message.reactions.length) return "";
  return `<div class="reactions">${message.reactions
    .map((reaction) => {
      const icon = reaction.imageUrl
        ? resolveAsset(reaction.imageUrl)
          ? `<img class="emoji" src="${escapeHtml(resolveAsset(reaction.imageUrl))}" alt="${escapeHtml(reaction.label)}">`
          : escapeHtml(reaction.label)
        : escapeHtml(reaction.label);
      return `<span class="reaction${reaction.reactedByBot ? " mine" : ""}">${icon}<strong>${reaction.count}</strong></span>`;
    })
    .join("")}</div>`;
}

function renderTechnical(message: TranscriptMessage): string {
  const interaction = message.interaction;
  return `<details class="technical"><summary>Technical details</summary><div class="technical-grid"><span>Message ID</span><span>${escapeHtml(message.id)}</span><span>User ID</span><span>${escapeHtml(message.author.id)}</span><span>Type</span><span>${message.type}</span>${interaction ? `<span>Interaction ID</span><span>${escapeHtml(interaction.id)}</span><span>Application command</span><span>${escapeHtml(interaction.name)}</span>` : ""}</div></details>`;
}

function systemMessageText(message: TranscriptMessage): string {
  const author = message.author.displayName;
  const labels: Record<number, string> = {
    1: `${author} added a recipient.`,
    2: `${author} removed a recipient.`,
    3: "A call took place.",
    4: `${author} changed the channel name.`,
    5: `${author} changed the channel icon.`,
    6: `${author} pinned a message.`,
    7: `${author} joined the server.`,
    8: `${author} boosted the server.`,
    9: "The server reached boost tier 1.",
    10: "The server reached boost tier 2.",
    11: "The server reached boost tier 3.",
    12: `${author} added a followed channel.`,
    18: `${author} created a thread.`,
    21: "Thread starter message.",
    22: "Discord sent a server invite reminder.",
    24: "Discord AutoMod took an action.",
    25: `${author} purchased a role subscription.`,
    27: "A Stage event started.",
    28: "A Stage event ended.",
    29: `${author} became a Stage speaker.`,
    31: "The Stage topic changed.",
  };
  return labels[message.type] ?? `Discord system message (type ${message.type}).`;
}

function renderMessage(
  message: TranscriptMessage,
  snapshot: TranscriptSnapshot,
  resolveAsset: AssetResolver,
  compact: boolean,
): string {
  const roleColor = message.author.color && /^#[0-9a-f]{6}$/i.test(message.author.color) ? message.author.color : null;
  const avatar = safeHttpUrl(message.author.avatarUrl);
  const renderedAvatar = avatar ? resolveAsset(avatar) : "";
  const ordinaryType = message.type === 0 || message.type === 19 || message.type === 20 || message.type === 23;
  const body = message.content
    ? renderDiscordMarkdown(message.content, snapshot.mentions, resolveAsset)
    : !ordinaryType
      ? escapeHtml(systemMessageText(message))
      : "";
  return [
    `<article class="message ${compact ? "compact" : "group-start"}" id="message-${escapeHtml(message.id)}">`,
    renderedAvatar
      ? `<img class="avatar" src="${escapeHtml(renderedAvatar)}" alt="" loading="lazy">`
      : "",
    `<div class="message-head"><span class="author"${roleColor ? ` style="--author-color:${roleColor}"` : ""}>${escapeHtml(message.author.displayName)}</span>${message.author.bot ? '<span class="bot-badge">APP</span>' : ""}${!ordinaryType ? `<span class="type-badge">SYSTEM ${message.type}</span>` : ""}<time class="timestamp" datetime="${escapeHtml(message.createdAt)}">${escapeHtml(message.createdAt)}</time>${message.editedAt ? '<span class="edited">(edited)</span>' : ""}</div>`,
    renderReply(message, snapshot, resolveAsset),
    renderForwards(message, snapshot, resolveAsset),
    renderInteraction(message),
    body ? `<div class="content">${body}</div>` : "",
    renderEmbeds(message.embeds, snapshot.mentions, resolveAsset),
    renderComponents(message.components, snapshot.mentions, resolveAsset),
    renderAttachments(message, resolveAsset),
    renderStickers(message, resolveAsset),
    renderReactions(message, resolveAsset),
    renderTechnical(message),
    "</article>",
  ].join("");
}

function documentHtml(
  snapshot: TranscriptSnapshot,
  body: string,
  page: number,
  pages: number,
  count: number,
): string {
  const title = `#${snapshot.channelName} — ${snapshot.guildName}`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${escapeHtml(title)}</title><style>${CSS}</style></head>
<body><header class="transcript-header"><h1>${escapeHtml(snapshot.guildName)} / #${escapeHtml(snapshot.channelName)}</h1><div class="header-meta">${count} message${count === 1 ? "" : "s"}${pages > 1 ? ` • Part ${page} of ${pages}` : ""} • Generated <time datetime="${escapeHtml(snapshot.generatedAt)}">${escapeHtml(snapshot.generatedAt)}</time>${snapshot.channelTopic ? ` • ${escapeHtml(snapshot.channelTopic)}` : ""}</div></header>
<main class="messages">${body || '<div class="empty">This channel had no visible messages.</div>'}</main>
<footer class="transcript-footer">Channel ID ${escapeHtml(snapshot.channelId)} • Guild ID ${escapeHtml(snapshot.guildId)} • Final visible state at export time</footer><script>${SCRIPT}</script></body></html>`;
}

function safeBase(filename: string): string {
  return filename.replace(/\.html?$/i, "").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "").trim() || "transcript";
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

export async function renderTranscriptPages(
  snapshot: TranscriptSnapshot,
  assets: Map<string, string>,
  filename: string,
): Promise<RenderedTranscriptPage[]> {
  const embeddedResolver = resolveFrom(assets);
  const externalResolver: AssetResolver = (url) => {
    if (assets.has(url)) {
      return url;
    }
    try {
      const href = new URL(url).href;
      return assets.has(href) ? href : "";
    } catch {
      return "";
    }
  };
  const chunks: string[] = [];
  let previous: TranscriptMessage | undefined;
  let currentDay = "";

  for (const message of snapshot.messages) {
    if (chunks.length > 0 && chunks.length % 25 === 0) {
      await yieldToEventLoop();
    }
    const day = message.createdAt.slice(0, 10);
    const daySeparator = day !== currentDay ? `<div class="day"><span>${escapeHtml(day)}</span></div>` : "";
    currentDay = day;
    const compact =
      previous?.author.id === message.author.id &&
      !message.reply &&
      !message.interaction &&
      Date.parse(message.createdAt) - Date.parse(previous.createdAt) < 7 * 60 * 1000;
    let rendered = `${daySeparator}${renderMessage(message, snapshot, embeddedResolver, compact)}`;
    if (Buffer.byteLength(rendered, "utf8") > MAX_PAGE_BYTES) {
      rendered = `${daySeparator}${renderMessage(message, snapshot, externalResolver, compact)}`;
    }
    chunks.push(rendered);
    previous = message;
  }

  const bodies: { html: string; first: number; last: number }[] = [];
  let body = "";
  let first = 0;
  for (let index = 0; index < chunks.length; index += 1) {
    const next = body + chunks[index];
    if (body && Buffer.byteLength(next, "utf8") > MAX_PAGE_BYTES) {
      bodies.push({ html: body, first, last: index - 1 });
      body = chunks[index];
      first = index;
    } else {
      body = next;
    }
  }
  bodies.push({ html: body, first, last: Math.max(0, chunks.length - 1) });

  const base = safeBase(filename);
  return bodies.map((entry, index) => ({
    filename: bodies.length === 1 ? `${base}.html` : `${base}-part-${index + 1}.html`,
    html: documentHtml(snapshot, entry.html, index + 1, bodies.length, snapshot.messages.length),
    firstMessage: entry.first,
    lastMessage: entry.last,
  }));
}
