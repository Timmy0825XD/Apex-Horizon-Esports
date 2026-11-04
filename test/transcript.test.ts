import assert from "node:assert/strict";
import test from "node:test";
import {
  isPublicIp,
  renderDiscordMarkdown,
  renderTranscriptPages,
  type TranscriptMessage,
  type TranscriptSnapshot,
} from "../src/commands/ticket/transcript/index.js";

const mentions = {
  users: { "11111111111111111": "Captain <One>" },
  roles: { "22222222222222222": { name: "Judge & Staff", color: "#ff0000" } },
  channels: { "33333333333333333": "battle-room" },
};

function message(overrides: Partial<TranscriptMessage> = {}): TranscriptMessage {
  return {
    id: "44444444444444444",
    type: 0,
    createdAt: "2026-10-23T15:00:00.000Z",
    editedAt: null,
    content: "",
    author: {
      id: "55555555555555555",
      username: "captain",
      displayName: "Captain",
      avatarUrl: "https://cdn.discordapp.com/embed/avatars/0.png",
      color: "#57f287",
      roleName: "Captain",
      bot: false,
    },
    attachments: [],
    embeds: [],
    components: [],
    reactions: [],
    stickers: [],
    interaction: null,
    reply: null,
    forwards: [],
    ...overrides,
  };
}

function snapshot(messages: TranscriptMessage[]): TranscriptSnapshot {
  return {
    guildId: "66666666666666666",
    guildName: "Apex <Horizon>",
    guildIconUrl: null,
    channelId: "77777777777777777",
    channelName: "battle-final",
    channelTopic: "Tournament ID: 1 | Match ID: 2",
    generatedAt: "2026-10-23T16:00:00.000Z",
    messages,
    mentions,
  };
}

test("Discord markdown escapes HTML and resolves mentions", () => {
  const html = renderDiscordMarkdown(
    "<script>alert(1)</script> **bold** <@11111111111111111> <@&22222222222222222> <#33333333333333333> </bracket upload:88888888888888888>",
    mentions,
    (url) => url,
  );

  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /@Captain &lt;One&gt;/);
  assert.match(html, /@Judge &amp; Staff/);
  assert.match(html, /#battle-room/);
  assert.match(html, /\/bracket upload/);
});

test("renderer includes commands, replies, embeds, V2 and message evidence", async () => {
  const first = message({ id: "10000000000000001", content: "Original message" });
  const second = message({
    id: "10000000000000002",
    createdAt: "2026-10-23T15:01:00.000Z",
    content: "Result **accepted**",
    author: {
      id: "99999999999999999",
      username: "bot",
      displayName: "Apex Bot",
      avatarUrl: "https://cdn.discordapp.com/embed/avatars/1.png",
      color: null,
      roleName: null,
      bot: true,
    },
    reply: { messageId: first.id, authorName: "Captain", content: first.content },
    interaction: {
      id: "12121212121212121",
      name: "bracket upload",
      userId: first.author.id,
      userName: first.author.displayName,
      type: 2,
    },
    embeds: [
      {
        title: "Score",
        description: "Team A vs Team B",
        color: 0x57f287,
        fields: [{ name: "Winner", value: "**Team A**", inline: true }],
      },
    ],
    components: [
      {
        type: 17,
        accent_color: 0x5865f2,
        components: [
          { type: 10, content: "# Match Complete" },
          {
            type: 9,
            components: [{ type: 10, content: "Evidence saved" }],
            accessory: { type: 11, media: { url: "https://cdn.discordapp.com/embed/avatars/2.png" } },
          },
        ],
      },
    ],
    reactions: [{ key: "ok", label: "✅", imageUrl: null, count: 3, reactedByBot: true }],
    stickers: [
      {
        id: "13131313131313131",
        name: "GG",
        description: "Good game",
        url: "https://media.discordapp.net/stickers/13131313131313131.png",
      },
    ],
    attachments: [
      {
        id: "14141414141414141",
        name: "proof.txt",
        url: "https://cdn.discordapp.com/attachments/proof.txt",
        description: null,
        contentType: "text/plain",
        size: 42,
        width: null,
        height: null,
        image: false,
      },
    ],
  });

  const third = message({
    id: "10000000000000003",
    createdAt: "2026-10-23T15:20:00.000Z",
    content: "Thanks",
    reply: { messageId: first.id, authorName: "Captain", content: first.content },
  });

  const pages = await renderTranscriptPages(snapshot([first, second, third]), new Map(), "battle.html");
  assert.equal(pages.length, 1);
  const html = pages[0].html;
  assert.match(html, /Captain<\/b><span>used<\/span><span class="command">\/bracket upload/);
  assert.match(html, /href="#message-10000000000000001">Original message/);
  assert.match(html, /class="embed"/);
  assert.match(html, /class="v2-container accent"/);
  assert.match(html, /Match Complete/);
  assert.match(html, /proof\.txt/);
  assert.match(html, /Good game/);
  assert.match(html, /Message details/);
  assert.match(html, /10000000000000002/);
  assert.match(html, /class="app-tag">APP/);
  assert.match(html, /Welcome to #battle-final!/);
  assert.match(html, /Participants — 2/);
  assert.match(html, /Captain — 1/);
  assert.match(html, /<small>2 messages<\/small>/);
  assert.match(html, /Apps — 1/);
});

test("each avatar is embedded once per page and grouped messages stay compact", async () => {
  const avatarUrl = "https://cdn.discordapp.com/embed/avatars/0.png";
  const pages = await renderTranscriptPages(
    snapshot([
      message({ id: "30000000000000001", content: "first" }),
      message({ id: "30000000000000002", content: "second", createdAt: "2026-10-23T15:01:00.000Z" }),
    ]),
    new Map([[avatarUrl, "data:image/png;base64,QUJD"]]),
    "group.html",
  );
  const html = pages[0].html;
  assert.equal(html.split("data:image/png;base64,QUJD").length - 1, 1);
  assert.match(html, /class="message compact" id="message-30000000000000002"/);
});

test("renderer splits oversized transcripts without losing message boundaries", async () => {
  const messages = Array.from({ length: 760 }, (_, index) =>
    message({
      id: String(20_000_000_000_000_000n + BigInt(index)),
      createdAt: new Date(Date.parse("2026-10-23T15:00:00.000Z") + index * 1000).toISOString(),
      content: `${index}:${"x".repeat(10_000)}`,
    }),
  );
  const pages = await renderTranscriptPages(snapshot(messages), new Map(), "large.html");
  assert.ok(pages.length > 1);
  assert.equal(pages[0].firstMessage, 0);
  assert.equal(pages.at(-1)?.lastMessage, messages.length - 1);
  for (let index = 1; index < pages.length; index += 1) {
    assert.equal(pages[index].firstMessage, pages[index - 1].lastMessage + 1);
  }
});

test("system messages stay plain text and forwards keep their visible content", async () => {
  const pages = await renderTranscriptPages(
    snapshot([
      message({
        type: 6,
        author: {
          id: "55555555555555555",
          username: "captain",
          displayName: "Captain <script>",
          avatarUrl: "https://cdn.discordapp.com/embed/avatars/0.png",
          color: null,
          roleName: null,
          bot: false,
        },
        forwards: [
          {
            createdAt: "2026-10-23T14:00:00.000Z",
            content: "Forwarded **proof**",
            embeds: [],
            components: [],
            attachments: [],
            stickers: [],
          },
        ],
      }),
    ]),
    new Map(),
    "system.html",
  );
  const html = pages[0].html;
  assert.match(html, /<b>Captain &lt;script&gt;<\/b> pinned a message/);
  assert.match(html, /class="message system"/);
  assert.doesNotMatch(html, /Captain <script>/);
  assert.match(html, /Forwarded <strong>proof<\/strong>/);
  assert.match(html, /Forwarded message/);
});

test("SSRF guard rejects private and reserved addresses", () => {
  for (const address of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "::1", "fd00::1"]) {
    assert.equal(isPublicIp(address), false, address);
  }
  assert.equal(isPublicIp("8.8.8.8"), true);
  assert.equal(isPublicIp("2606:4700:4700::1111"), true);
});
