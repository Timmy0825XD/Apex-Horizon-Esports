export function validationTicketTopic(challongeId: string, transcriptChannelId: string): string {
  return `Group validation | Tournament ID: ${challongeId} | Transcript: ${transcriptChannelId}`.slice(0, 1024);
}

export function parseValidationTicketTopic(
  topic: string | null | undefined,
): { challongeId: string; transcriptChannelId: string } | null {
  if (!topic) {
    return null;
  }
  const match = topic.match(/^Group validation \| Tournament ID: (.*) \| Transcript: (\d{17,20})$/);
  if (!match?.[1] || !match?.[2]) {
    return null;
  }
  return { challongeId: match[1], transcriptChannelId: match[2] };
}
