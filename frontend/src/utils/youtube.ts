const DEFAULT_YOUTUBE_FALLBACK_VIDEO_ID = "M7lc1UVf-VE";

function withStart(url: string, startSeconds?: number): string {
  if (!startSeconds) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}start=${Math.max(0, Math.floor(startSeconds))}`;
}

export function getYoutubeEmbedUrl(url: string, startSeconds?: number): string {
  try {
    const parsed = new URL(url);
    const listType = parsed.searchParams.get("listType");
    const list = parsed.searchParams.get("list");

    if (listType === "search") {
      return withStart(
        `https://www.youtube.com/embed/${DEFAULT_YOUTUBE_FALLBACK_VIDEO_ID}?playsinline=1`,
        startSeconds
      );
    }

    if (listType && list && (listType === "playlist" || listType === "user_uploads")) {
      return withStart(
        `https://www.youtube.com/embed?listType=${encodeURIComponent(listType)}&list=${encodeURIComponent(list)}`,
        startSeconds
      );
    }

    const pathParts = parsed.pathname.split("/").filter(Boolean);
    const id =
      parsed.hostname.includes("youtu.be")
        ? pathParts[0]
        : parsed.pathname.startsWith("/embed/")
          ? pathParts[1]
          : parsed.pathname.startsWith("/shorts/")
            ? pathParts[1]
            : parsed.searchParams.get("v");

    if (!id) return url;
    return withStart(`https://www.youtube.com/embed/${id}?playsinline=1`, startSeconds);
  } catch {
    return url;
  }
}
