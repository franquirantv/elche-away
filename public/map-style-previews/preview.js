/* global maplibregl */
"use strict";

const styles = [
  { id: "liberty", name: "Liberty", provider: "OpenFreeMap", cost: "0 € · sin cuenta ni clave", url: "https://tiles.openfreemap.org/styles/liberty", description: "Equilibrado y con color. Un candidato para conservar detalle sin el aspecto del OSM estándar." },
  { id: "bright", name: "Bright", provider: "OpenFreeMap", cost: "0 € · sin cuenta ni clave", url: "https://tiles.openfreemap.org/styles/bright", description: "Más vivo y descriptivo. Carreteras y zonas verdes tienen más presencia." },
  { id: "positron", name: "Positron", provider: "OpenFreeMap", cost: "0 € · sin cuenta ni clave", url: "https://tiles.openfreemap.org/styles/positron", description: "Claro y sobrio, con tonos grises. Da protagonismo a los marcadores sin eliminar las calles." },
  { id: "fiord", name: "Fiord", provider: "OpenFreeMap", cost: "0 € · sin cuenta ni clave", url: "https://tiles.openfreemap.org/styles/fiord", description: "Fondo azul oscuro y paleta fría. Otra dirección nocturna, con calles y edificios discretos." },
  { id: "dark", name: "Dark", provider: "OpenFreeMap", cost: "0 € · sin cuenta ni clave", url: "https://tiles.openfreemap.org/styles/dark", description: "Fondo oscuro con contraste para los marcadores. Permite valorar una dirección nocturna." },
  { id: "smooth", name: "Alidade Smooth", provider: "Stadia Maps", cost: "0 € condicionado · cuenta al publicar", url: "https://tiles.stadiamaps.com/styles/alidade_smooth.json", description: "Colores suaves y diseño discreto. Plan gratuito no comercial con cuota; esta demo sin clave funciona en localhost." },
  { id: "outdoors", name: "Outdoors", provider: "Stadia Maps", cost: "0 € condicionado · cuenta al publicar", url: "https://tiles.stadiamaps.com/styles/outdoors.json", description: "Más geográfico: relieve, naturaleza y calles. Plan gratuito no comercial con cuota; esta demo sin clave funciona en localhost." },
  { id: "osm", name: "OSM estándar", provider: "OpenStreetMap", cost: "Referencia actual · política de uso", description: "El mapa inicial, para comparar cuánto cambia el diseño. No requiere cambiar el motor actual de la aplicación." },
];
const scenes = {
  overview: { center: [-3.2, 39.8], zoom: 5 },
  city: { center: [-.3763, 39.4699], zoom: 12 },
  stadium: { center: [-.3583, 39.4747], zoom: 16.5 },
  islands: { center: [-15.6, 28.3], zoom: 7 },
};
const params = new URLSearchParams(location.search);
let selected = styles.find((style) => style.id === params.get("style")) ?? styles[0];
let scene = Object.hasOwn(scenes, params.get("scene")) ? params.get("scene") : "stadium";
let map;
let revision = 0;
let errorCount = 0;

const options = document.getElementById("style-options");
for (const style of styles) {
  const button = document.createElement("button");
  button.className = "style-option";
  button.dataset.style = style.id;
  const name = document.createElement("strong");
  name.textContent = style.name;
  const subtitle = document.createElement("span");
  subtitle.textContent = `${style.provider} · ${style.id === "smooth" || style.id === "outdoors" ? "Free con cuota" : "sin clave"}`;
  button.append(name, subtitle);
  button.addEventListener("click", () => selectStyle(style));
  options.append(button);
}
for (const style of styles) {
  const card = document.createElement("article");
  card.className = "preview-card";
  const heading = document.createElement("h3");
  heading.textContent = style.name;
  const description = document.createElement("p");
  description.textContent = `${style.provider} · ${style.cost}`;
  card.append(heading, description);
  for (const [key, label] of [["overview", "España"], ["stadium", "Mestalla · calles y estadio"]]) {
    const figure = document.createElement("figure");
    const link = document.createElement("a");
    link.href = `?style=${style.id}&scene=${key}`;
    const image = document.createElement("img");
    image.src = `previews/${style.id}-${key}.webp`;
    image.alt = `${style.name}: ${label}`;
    image.loading = "lazy";
    const caption = document.createElement("figcaption");
    caption.textContent = label;
    link.append(image);
    figure.append(link, caption);
    card.append(figure);
  }
  document.getElementById("gallery").append(card);
}
function updateInfo() {
  for (const button of options.querySelectorAll("button")) button.setAttribute("aria-pressed", String(button.dataset.style === selected.id));
  for (const button of document.querySelectorAll("[data-scene]")) button.setAttribute("aria-pressed", String(button.dataset.scene === scene));
  document.getElementById("active-name").textContent = `${selected.name} · ${selected.provider}`;
  document.getElementById("active-cost").textContent = selected.cost;
  document.getElementById("description").textContent = selected.description;
  history.replaceState(null, "", `?style=${selected.id}&scene=${scene}`);
}
async function getStyle(style) {
  if (style.id === "osm") return {
    version: 8,
    sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>' } },
    layers: [{ id: "osm", type: "raster", source: "osm" }],
  };
  if (style.provider === "Stadia Maps" && !["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)) throw new Error("Stadia necesita configurar una cuenta y el dominio para usar el mapa fuera de localhost. Puedes consultar las capturas de abajo.");
  const response = await fetch(style.url);
  if (!response.ok) throw new Error(`No se puede cargar ${style.name} (HTTP ${response.status}). Prueba otra opción o consulta la captura.`);
  return await response.json();
}
async function selectStyle(style) {
  selected = style;
  const current = ++revision;
  errorCount = 0;
  document.getElementById("status").textContent = "Cargando estilo…";
  updateInfo();
  try {
    const specification = await getStyle(style);
    if (current !== revision) return;
    if (map) {
      map.getContainer().style.visibility = "visible";
      map.setStyle(specification, { diff: false });
    }
    else {
      map = new maplibregl.Map({ container: "map", style: specification, ...scenes[scene], maxZoom: 19, attributionControl: false, canvasContextAttributes: { preserveDrawingBuffer: true } });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
      map.addControl(new maplibregl.AttributionControl({ compact: false }), "bottom-right");
      map.on("error", () => {
        errorCount++;
        document.getElementById("status").textContent = `Parte de ${selected.name} no ha podido cargarse. Prueba otra opción o consulta su captura.`;
      });
      map.on("idle", () => {
        if (!errorCount) document.getElementById("status").textContent = "";
      });
    }
    map.once("idle", () => { if (current === revision && !errorCount) document.getElementById("status").textContent = ""; });
  } catch (error) {
    if (current !== revision) return;
    errorCount++;
    if (map) map.getContainer().style.visibility = "hidden";
    document.getElementById("status").textContent = error instanceof Error ? error.message : "No se ha podido cargar el visor.";
  }
}
for (const button of document.querySelectorAll("[data-scene]")) button.addEventListener("click", () => {
  scene = button.dataset.scene;
  map?.jumpTo(scenes[scene]);
  updateInfo();
});
if (typeof maplibregl === "undefined") document.getElementById("status").textContent = "No se ha podido descargar el visor. Las previews y condiciones siguen disponibles debajo.";
else void selectStyle(selected);
