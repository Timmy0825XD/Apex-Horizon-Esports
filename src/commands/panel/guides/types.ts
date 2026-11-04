/**
 * One staff guide per slash path. Summary and access come from `bot/catalog.ts`; option names and
 * whether they are required come from the slash builder, so the guide only holds the explanation.
 *
 * Write `{/command sub}` to mention another command: it becomes a clickable mention when posted.
 */
export type Guide = {
  /** Where it runs, or what it needs first. Shown under "Who can use it". */
  where?: string;
  /** 2–4 plain steps: what you do and what the bot does after. */
  steps: string[];
  /**
   * Explanation per option. A key with several names separated by spaces groups them on one line.
   * Options left out fall back to the builder description.
   */
  options?: Record<string, string>;
  /** 2–4 things to keep in mind. */
  notes: string[];
  /** Neighbouring slash paths, without the leading slash. */
  related?: string[];
};

export type GuideBook = Record<string, Guide>;
