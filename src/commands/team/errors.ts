import { SheetError } from "../../lib/sheet.js";

export function rosterLoadError(error: unknown): string {
  if (error instanceof SheetError) {
    if (error.code === "sheet-empty") {
      return "This tournament has no participants yet.";
    }
    if (error.code === "timeout") {
      return "Timed out loading participants. Try again.";
    }
    if (error.code === "invalid-link" || error.code === "sheet-private") {
      return "The participant list for this tournament is not readable right now.";
    }
    return "The participant list for this tournament is not in a readable format.";
  }
  return "Something went wrong while loading participants. Try again.";
}
