function toRad(value) {
  return (value * Math.PI) / 180;
}

function distanceKm(a, b) {
  const earthKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function sharedModels(a, b) {
  const left = new Set((a.models ?? []).map((model) => model.toLowerCase().replace(/^\d+\.\s*/, '')));
  return (b.models ?? []).filter((model) => left.has(model.toLowerCase().replace(/^\d+\.\s*/, '')));
}

export function getTopRecommendations(site, allItems, limit = 3) {
  return allItems
    .filter((candidate) => candidate.id !== site.id)
    .map((candidate) => {
      const sameCountry = candidate.country === site.country;
      const sameRegion = candidate.region === site.region;
      const shared = sharedModels(site, candidate);
      const nearby = Math.max(0, 1 - distanceKm(site, candidate) / 9000);
      const factoryMarketPair = site.kind !== candidate.kind && sameCountry;
      const highGrowthMarket = candidate.kind === 'market' && (candidate.growth ?? 0) >= 6;
      const strongSignal = candidate.signal >= 75;

      let score = nearby * 28;
      if (sameCountry) score += 42;
      if (sameRegion) score += 16;
      if (factoryMarketPair) score += 35;
      if (shared.length) score += Math.min(shared.length, 3) * 12;
      if (highGrowthMarket) score += 12;
      if (strongSignal) score += 8;

      const reason = [
        factoryMarketPair ? 'same country production and market link' : null,
        shared.length ? `shared model focus: ${shared.slice(0, 2).join(', ')}` : null,
        sameRegion && !sameCountry ? `same ${site.region} region` : null,
        highGrowthMarket ? `${candidate.growth > 0 ? '+' : ''}${candidate.growth}% YoY market growth` : null,
        strongSignal ? 'high signal score' : null,
      ].filter(Boolean)[0] ?? 'nearest strategic network neighbor';

      return { site: candidate, score, reason };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function buildRecommendationArcs(site, recommendations) {
  return recommendations.map(({ site: target }, index) => ({
    id: `rec-${site.id}-${target.id}`,
    startLat: site.lat,
    startLng: site.lng,
    endLat: target.lat,
    endLng: target.lng,
    color: [site.color, target.color],
    siteId: target.id,
    recommended: true,
    rank: index + 1,
  }));
}
