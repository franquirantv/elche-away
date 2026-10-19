// Browser DOM factory shared by Leaflet markers; text/URLs never become HTML.
// Assets use the existing trusted club crest reference, never a remote provider.
export function createStadiumBadge(crestPath: string | null): HTMLElement {
  const badge = document.createElement("span");
  badge.className = "stadium-badge";
  badge.setAttribute("aria-hidden", "true");
  const neutral = document.createElement("span");
  neutral.className = "stadium-badge-neutral";
  neutral.textContent = "ea.";
  badge.append(neutral);
  if (crestPath && /^\/crests\/[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp|svg)$/.test(crestPath)) {
    const crest = document.createElement("img");
    crest.className = "stadium-badge-image";
    crest.alt = ""; // The marker's accessible name already identifies the stadium/rival.
    crest.width = 30;
    crest.height = 30;
    crest.hidden = true;
    crest.onload = () => { neutral.hidden = true; crest.hidden = false; };
    crest.onerror = () => { crest.remove(); neutral.hidden = false; };
    badge.append(crest);
    crest.src = crestPath;
  }
  return badge;
}
