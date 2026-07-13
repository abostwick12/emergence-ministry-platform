export function getEmbeddableVideoUrl(input: string | undefined) {
  const raw = extractVideoSource(input);
  if (!raw) return "";

  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return "";

    const hostname = url.hostname.replace(/^www\./, "").toLowerCase();
    if (hostname === "youtube.com" || hostname === "m.youtube.com") {
      if (url.pathname.startsWith("/embed/")) return url.toString();
      if (url.pathname === "/watch") {
        const videoId = url.searchParams.get("v");
        if (videoId) return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`;
      }
      if (url.pathname.startsWith("/shorts/")) {
        const videoId = url.pathname.split("/").filter(Boolean)[1];
        if (videoId) return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`;
      }
    }

    if (hostname === "youtu.be") {
      const videoId = url.pathname.split("/").filter(Boolean)[0];
      if (videoId) return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`;
    }

    if (hostname === "player.vimeo.com" && url.pathname.startsWith("/video/")) return url.toString();
    if (hostname === "vimeo.com") {
      const videoId = url.pathname.split("/").filter(Boolean)[0];
      if (videoId && /^\d+$/.test(videoId)) return `https://player.vimeo.com/video/${videoId}`;
    }
  } catch {
    return "";
  }

  return "";
}

function extractVideoSource(input: string | undefined) {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return "";

  const iframeSource = trimmed.match(/\ssrc=["']([^"']+)["']/i)?.[1];
  return iframeSource ?? trimmed;
}
