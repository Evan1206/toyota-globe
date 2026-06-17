function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values) {
  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance) || 1;
}

export function generateInsights(markets, allItems) {
  const growthValues = markets.map((market) => market.yoyGrowthPct);
  const salesValues = markets.map((market) => market.salesUnits);
  const growthMean = average(growthValues);
  const growthStd = standardDeviation(growthValues);
  const salesMean = average(salesValues);
  const salesStd = standardDeviation(salesValues);

  const byCode = new Map(allItems.map((item) => [item.code, item]));
  const scored = markets
    .map((market) => ({
      market,
      growthZ: (market.yoyGrowthPct - growthMean) / growthStd,
      salesZ: (market.salesUnits - salesMean) / salesStd,
    }))
    .sort((a, b) => (b.growthZ + b.salesZ * 0.35) - (a.growthZ + a.salesZ * 0.35));

  const growthLeader = scored[0];
  const biggestScale = scored.sort((a, b) => b.salesZ - a.salesZ)[0];
  const shareLeader = [...markets].sort((a, b) => b.marketSharePct - a.marketSharePct)[0];

  return [
    {
      id: `insight-growth-${growthLeader.market.countryCode}`,
      label: 'Growth signal',
      title: `${growthLeader.market.country} is accelerating`,
      text: `${growthLeader.market.yoyGrowthPct > 0 ? '+' : ''}${growthLeader.market.yoyGrowthPct}% YoY growth stands out against the network average.`,
      siteId: byCode.get(growthLeader.market.countryCode)?.id,
      score: Math.round((growthLeader.growthZ + 3) * 20),
    },
    {
      id: `insight-scale-${biggestScale.market.countryCode}`,
      label: 'Scale anchor',
      title: `${biggestScale.market.country} drives volume`,
      text: `${biggestScale.market.salesUnits.toLocaleString()} demo units make it the largest visible market in this dataset.`,
      siteId: byCode.get(biggestScale.market.countryCode)?.id,
      score: Math.round((biggestScale.salesZ + 3) * 18),
    },
    {
      id: `insight-share-${shareLeader.countryCode}`,
      label: 'Market share',
      title: `${shareLeader.country} has strong Toyota share`,
      text: `${shareLeader.marketSharePct}% share indicates a high local Toyota presence.`,
      siteId: byCode.get(shareLeader.countryCode)?.id,
      score: Math.round(shareLeader.marketSharePct),
    },
  ].filter((insight) => insight.siteId);
}

export function buildSmartTour(insights, allItems) {
  const byId = new Map(allItems.map((item) => [item.id, item]));
  return insights
    .map((insight) => ({ ...insight, site: byId.get(insight.siteId) }))
    .filter((item) => item.site)
    .sort((a, b) => b.score - a.score);
}
