import { isCrestKey } from "./crest-key";
// Browser DOM factory shared by Leaflet markers; text/URLs never become HTML.
// Assets use the existing trusted club crest reference, never a remote provider.
export function createStadiumBadge(crestPath: string | null, visits = 1): HTMLElement {
  const badge = document.createElement("span");
  badge.className = "stadium-badge";
  badge.setAttribute("aria-hidden", "true");
  const neutral = document.createElement("span");
  neutral.className = "stadium-badge-neutral";
  neutral.textContent = visits ? "ea." : "○";
  badge.append(neutral);
  if (visits > 0 && crestPath?.startsWith("/media/") && isCrestKey(crestPath.slice("/media/".length))) {
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
  const state = document.createElement("span");
  state.className = "stadium-badge-state";
  state.textContent = visits ? `✓ ${visits}` : "+";
  badge.append(state);
  return badge;
}
