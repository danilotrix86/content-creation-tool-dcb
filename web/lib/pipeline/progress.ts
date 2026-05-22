/** Structured pipeline progress events (mapped to short UI copy on the client). */
export type PipelineProgressEvent =
  | { type: "start" }
  | { type: "search_google"; keywords: string[] }
  | { type: "read_competitor_pages"; count: number; attempted?: number }
  | { type: "analyze_competitors" }
  | { type: "analyze_strategy" }
  | { type: "create_outline" }
  | { type: "internal_links" }
  | { type: "write_sections"; batch: number; total: number }
  | { type: "featured_image" }
  | { type: "inline_images" }
  | { type: "meta_tags" }
  | { type: "save" };

export function formatUserProgress(event: PipelineProgressEvent): string {
  switch (event.type) {
    case "start":
      return "Starting generation…";
    case "search_google": {
      const list = event.keywords.filter(Boolean).slice(0, 3).join(", ");
      const extra =
        event.keywords.length > 3
          ? ` (+${event.keywords.length - 3} more)`
          : "";
      return list
        ? `Searching Google for: ${list}${extra}`
        : "Searching Google for competitors…";
    }
    case "read_competitor_pages":
      if (event.count === 0 && event.attempted !== undefined) {
        return `Reading ${event.attempted} competitor page${event.attempted === 1 ? "" : "s"}…`;
      }
      if (event.attempted !== undefined && event.count < event.attempted) {
        return `Read ${event.count} of ${event.attempted} competitor pages (others blocked or empty)…`;
      }
      return event.count > 0
        ? `Read ${event.count} competitor page${event.count === 1 ? "" : "s"}…`
        : "Reading competitor pages…";
    case "analyze_competitors":
      return "Analyzing competitor content…";
    case "analyze_strategy":
      return "Planning article structure…";
    case "create_outline":
      return "Creating outline…";
    case "internal_links":
      return "Selecting internal links…";
    case "write_sections":
      return `Writing sections (${event.batch}/${event.total})…`;
    case "featured_image":
      return "Generating featured image…";
    case "inline_images":
      return "Generating inline images…";
    case "meta_tags":
      return "Writing SEO meta tags…";
    case "save":
      return "Saving article…";
    default:
      return "Working…";
  }
}

export type GenerateStreamMessage =
  | { type: "progress"; message: string }
  | { type: "done"; data: unknown }
  | { type: "error"; message: string };
