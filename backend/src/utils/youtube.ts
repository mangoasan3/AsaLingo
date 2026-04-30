export const DEFAULT_YOUTUBE_FALLBACK_VIDEO_ID = "M7lc1UVf-VE";

export function buildYoutubeRuntimeSourceUrl(): string {
  // YouTube deprecated iframe search embeds on 2020-11-15, so runtime tasks
  // should always point at a real embeddable video URL.
  return `https://www.youtube.com/watch?v=${DEFAULT_YOUTUBE_FALLBACK_VIDEO_ID}`;
}
