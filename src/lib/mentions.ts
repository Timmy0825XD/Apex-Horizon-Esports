import type { Client } from "discord.js";

/**
 * Discord only attaches user data to `<@id>` mentions the message is allowed to ping. Messages sent
 * with `allowedMentions: { parse: [] }` leave the reader's client to resolve each id from its own
 * member cache, so uncached members show as "@unknown-user".
 *
 * Edits never notify, so every message edit that goes through the bot's REST client gets its user
 * mentions allowed, and every new message with unresolved mentions gets one silent edit afterwards.
 * Pings on new messages stay exactly as each command set them.
 */

const USER_MENTION = /<@!?(\d{17,20})>/g;
const MAX_USERS = 100;
const FOLLOW_UP_DELAY_MS = 1500;

type Body = Record<string, unknown>;
type AllowedMentions = { parse?: string[]; users?: string[] };
type RestRequest = Parameters<Client["rest"]["request"]>[0];

const CHANNEL_MESSAGE = /^\/channels\/(\d+)\/messages$/;
const CHANNEL_MESSAGE_EDIT = /^\/channels\/(\d+)\/messages\/(\d+)$/;
const WEBHOOK_MESSAGE = /^\/webhooks\/(\d+)\/([^/]+)$/;
const WEBHOOK_MESSAGE_EDIT = /^\/webhooks\/(\d+)\/([^/]+)\/messages\/(\d+|@original)$/;
const INTERACTION_CALLBACK = /^\/interactions\/(\d+)\/([^/]+)\/callback$/;

const REPLY = 4;
const UPDATE = 7;

function isBody(value: unknown): value is Body {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mentionedUsers(body: Body): string[] {
  const text = JSON.stringify([body.content ?? "", body.components ?? []]);
  const ids = new Set<string>();
  for (const match of text.matchAll(USER_MENTION)) {
    if (match[1]) {
      ids.add(match[1]);
    }
  }
  return [...ids];
}

/** Adds every mentioned user to `allowed_mentions`. Only safe on edits, which never notify. */
function allowUsers(body: Body): void {
  if (body.content === undefined && body.components === undefined) {
    return;
  }
  const ids = mentionedUsers(body);
  if (ids.length === 0) {
    return;
  }
  const allowed: AllowedMentions = isBody(body.allowed_mentions) ? { ...(body.allowed_mentions as AllowedMentions) } : { parse: [] };
  if (allowed.parse?.includes("users")) {
    return;
  }
  allowed.users = [...new Set([...(allowed.users ?? []), ...ids])].slice(0, MAX_USERS);
  body.allowed_mentions = allowed;
}

/** Ids the new message mentions but Discord did not resolve. */
function unresolved(body: Body, sent: unknown): string[] {
  const ids = mentionedUsers(body);
  if (ids.length === 0) {
    return [];
  }
  if (isBody(sent) && Array.isArray(sent.mentions)) {
    const known = new Set(sent.mentions.map((user) => (isBody(user) ? String(user.id) : "")));
    return ids.filter((id) => !known.has(id));
  }
  const allowed = isBody(body.allowed_mentions) ? (body.allowed_mentions as AllowedMentions) : undefined;
  if (!allowed) {
    return [];
  }
  if (allowed.parse?.includes("users")) {
    return [];
  }
  return ids.filter((id) => !allowed.users?.includes(id));
}

/** Replaying a body that points at uploaded files could break them; those messages are left as sent. */
function replayable(body: Body, request: RestRequest): boolean {
  const usesUploads = JSON.stringify(body.components ?? []).includes("attachment://");
  return !(usesUploads && request.files && request.files.length > 0);
}

function replayBody(body: Body): Body {
  const replay: Body = {};
  if (body.content !== undefined) {
    replay.content = body.content;
  }
  if (body.components !== undefined) {
    replay.components = body.components;
  }
  if (body.allowed_mentions !== undefined) {
    replay.allowed_mentions = body.allowed_mentions;
  }
  return replay;
}

export function installMentionResolver(client: Client): void {
  const rest = client.rest;
  const send = rest.request.bind(rest);
  // A message the command edits on its own no longer needs the follow-up edit (and must not get an old body).
  const pending = new Map<string, NodeJS.Timeout>();

  function settle(key: string): void {
    const timer = pending.get(key);
    if (timer) {
      clearTimeout(timer);
      pending.delete(key);
    }
  }

  function followUp(key: string, route: `/${string}`, body: Body, auth: boolean, query?: URLSearchParams): void {
    settle(key);
    const replay = replayBody(body);
    const timer = setTimeout(() => {
      pending.delete(key);
      void rest.patch(route, { body: replay, auth, query }).catch(() => undefined);
    }, FOLLOW_UP_DELAY_MS);
    pending.set(key, timer);
  }

  rest.request = async (request: RestRequest) => {
    const route = request.fullRoute;
    const method = request.method;
    const body = isBody(request.body) ? request.body : null;
    const data = body && isBody(body.data) ? body.data : null;

    if (method === "PATCH" && body) {
      const channelEdit = CHANNEL_MESSAGE_EDIT.exec(route);
      const webhookEdit = WEBHOOK_MESSAGE_EDIT.exec(route);
      if (channelEdit?.[2]) {
        settle(channelEdit[2]);
        allowUsers(body);
      } else if (webhookEdit?.[3]) {
        settle(webhookEdit[3] === "@original" ? `original:${webhookEdit[2]}` : webhookEdit[3]);
        allowUsers(body);
      }
    }

    const callback = method === "POST" ? INTERACTION_CALLBACK.exec(route) : null;
    if (callback && body?.type === UPDATE && data) {
      allowUsers(data);
    }

    const result = await send(request);

    if (method !== "POST" || !body) {
      return result;
    }

    try {
      const channelSend = CHANNEL_MESSAGE.exec(route);
      if (channelSend?.[1] && isBody(result) && unresolved(body, result).length > 0 && replayable(body, request)) {
        const id = String(result.id);
        followUp(id, `/channels/${channelSend[1]}/messages/${id}`, body, true);
        return result;
      }

      const webhookSend = WEBHOOK_MESSAGE.exec(route);
      if (webhookSend && isBody(result) && unresolved(body, result).length > 0 && replayable(body, request)) {
        const id = String(result.id);
        const threadId = request.query?.get("thread_id");
        const query = threadId ? new URLSearchParams({ thread_id: threadId }) : undefined;
        followUp(id, `/webhooks/${webhookSend[1]}/${webhookSend[2]}/messages/${id}`, body, false, query);
        return result;
      }

      if (callback?.[2] && body.type === REPLY && data && unresolved(data, null).length > 0 && replayable(data, request)) {
        const appId = client.application?.id ?? client.user?.id;
        if (appId) {
          followUp(`original:${callback[2]}`, `/webhooks/${appId}/${callback[2]}/messages/@original`, data, false);
        }
      }
    } catch (error) {
      console.error("Mention resolver could not schedule its edit", error);
    }

    return result;
  };
}
