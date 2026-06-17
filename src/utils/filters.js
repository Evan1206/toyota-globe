export function filterSites(sites, region, query) {
  const normalizedQuery = query.trim().toLowerCase();
  return sites.filter((site) => {
    const matchesRegion = region === 'All' || site.region.includes(region);
    const haystack = `${site.city} ${site.country} ${site.region} ${site.type} ${site.models.join(' ')}`.toLowerCase();
    return matchesRegion && (!normalizedQuery || haystack.includes(normalizedQuery));
  });
}

export function averageSignal(sites) {
  return Math.round(sites.reduce((sum, site) => sum + site.signal, 0) / sites.length);
}
