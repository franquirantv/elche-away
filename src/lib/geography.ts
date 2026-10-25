// INE province codes; autonomous cities are included. No venue inference.
export const provinces: Record<string, { name: string; community: string }> = {
  "01": { name: "Álava", community: "País Vasco" },
  "02": { name: "Albacete", community: "Castilla-La Mancha" },
  "03": { name: "Alicante", community: "Comunitat Valenciana" },
  "04": { name: "Almería", community: "Andalucía" },
  "05": { name: "Ávila", community: "Castilla y León" },
  "06": { name: "Badajoz", community: "Extremadura" },
  "07": { name: "Illes Balears", community: "Illes Balears" },
  "08": { name: "Barcelona", community: "Cataluña" },
  "09": { name: "Burgos", community: "Castilla y León" },
  "10": { name: "Cáceres", community: "Extremadura" },
  "11": { name: "Cádiz", community: "Andalucía" },
  "12": { name: "Castellón", community: "Comunitat Valenciana" },
  "13": { name: "Ciudad Real", community: "Castilla-La Mancha" },
  "14": { name: "Córdoba", community: "Andalucía" },
  "15": { name: "A Coruña", community: "Galicia" },
  "16": { name: "Cuenca", community: "Castilla-La Mancha" },
  "17": { name: "Girona", community: "Cataluña" },
  "18": { name: "Granada", community: "Andalucía" },
  "19": { name: "Guadalajara", community: "Castilla-La Mancha" },
  "20": { name: "Gipuzkoa", community: "País Vasco" },
  "21": { name: "Huelva", community: "Andalucía" },
  "22": { name: "Huesca", community: "Aragón" },
  "23": { name: "Jaén", community: "Andalucía" },
  "24": { name: "León", community: "Castilla y León" },
  "25": { name: "Lleida", community: "Cataluña" },
  "26": { name: "La Rioja", community: "La Rioja" },
  "27": { name: "Lugo", community: "Galicia" },
  "28": { name: "Madrid", community: "Comunidad de Madrid" },
  "29": { name: "Málaga", community: "Andalucía" },
  "30": { name: "Murcia", community: "Región de Murcia" },
  "31": { name: "Navarra", community: "Comunidad Foral de Navarra" },
  "32": { name: "Ourense", community: "Galicia" },
  "33": { name: "Asturias", community: "Principado de Asturias" },
  "34": { name: "Palencia", community: "Castilla y León" },
  "35": { name: "Las Palmas", community: "Canarias" },
  "36": { name: "Pontevedra", community: "Galicia" },
  "37": { name: "Salamanca", community: "Castilla y León" },
  "38": { name: "Santa Cruz de Tenerife", community: "Canarias" },
  "39": { name: "Cantabria", community: "Cantabria" },
  "40": { name: "Segovia", community: "Castilla y León" },
  "41": { name: "Sevilla", community: "Andalucía" },
  "42": { name: "Soria", community: "Castilla y León" },
  "43": { name: "Tarragona", community: "Cataluña" },
  "44": { name: "Teruel", community: "Aragón" },
  "45": { name: "Toledo", community: "Castilla-La Mancha" },
  "46": { name: "Valencia", community: "Comunitat Valenciana" },
  "47": { name: "Valladolid", community: "Castilla y León" },
  "48": { name: "Bizkaia", community: "País Vasco" },
  "49": { name: "Zamora", community: "Castilla y León" },
  "50": { name: "Zaragoza", community: "Aragón" },
  "51": { name: "Ceuta", community: "Ceuta" },
  "52": { name: "Melilla", community: "Melilla" },
};

export function formatLocation(city: string | null, provinceCode: string | null) {
  const province = provinceCode ? provinces[provinceCode] : undefined;
  return [city, province?.name, province?.community].filter(Boolean).join(" · ") || "Ubicación desconocida";
}

// A venue visit establishes presence in a territory, never its area travelled.
export function territorialProgress(stadiums: { visits: number; provinceCode: string | null }[]) {
  const visited = stadiums.filter((stadium) => stadium.visits > 0);
  const known = visited.filter((stadium) => stadium.provinceCode !== null && provinces[stadium.provinceCode]);
  const codes = new Set(known.map((stadium) => stadium.provinceCode));
  const entries = Object.entries(provinces);
  const provincial = entries.filter(([code]) => code !== "51" && code !== "52");
  const communities = [...new Set(provincial.map(([, province]) => province.community))].sort((a, b) => a.localeCompare(b, "es"));
  const visitedCommunities = new Set(known.filter((stadium) => stadium.provinceCode !== "51" && stadium.provinceCode !== "52").map((stadium) => provinces[stadium.provinceCode ?? ""].community));
  return {
    knownStadiums: known.length, visitedStadiums: visited.length,
    provinces: provincial.map(([code, province]) => ({ name: province.name, visited: codes.has(code) })),
    communities: communities.map((name) => ({ name, visited: visitedCommunities.has(name) })),
    cities: ["51", "52"].map((code) => ({ name: provinces[code].name, visited: codes.has(code) })),
  };
}
