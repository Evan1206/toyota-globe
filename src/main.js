import './style.css';
import factories from './data/factories.json';
import marketSales from './data/marketSales.json';
import popularModels from './data/popularModels.json';
import { regions, buildNetworkArcs } from './data/toyotaSites.js';
import { createToyotaGlobe, updateGlobeData } from './globe/createToyotaGlobe.js';
import { getTopRecommendations, buildRecommendationArcs } from './ai/recommendations.js';
import { generateInsights, buildSmartTour } from './ai/insights.js';
import { filterSites } from './utils/filters.js';
import { renderDetails, renderSiteList } from './ui/renderPanel.js';

const app = document.querySelector('#app');

const countryRegions = {
  Japan: 'Asia',
  China: 'Asia',
  India: 'Asia',
  Thailand: 'Asia',
  Indonesia: 'Asia',
  Philippines: 'Asia',
  Vietnam: 'Asia',
  'Saudi Arabia': 'Asia',
  'United States': 'North America',
  Canada: 'North America',
  Mexico: 'North America',
  Brazil: 'South America',
  Argentina: 'South America',
  'United Kingdom': 'Europe',
  Germany: 'Europe',
  France: 'Europe',
  Turkey: 'Europe / Middle East',
  'South Africa': 'Africa',
  Australia: 'Oceania',
};

const growthColor = (pct) => {
  if (pct < 0) return '#e63946';
  if (pct < 3) return '#adb5bd';
  if (pct < 7) return '#f2994a';
  return '#2a9d8f';
};

const capacityMax = Math.max(...factories.map((factory) => factory.annualCapacityUnits));
const salesMax = Math.max(...marketSales.map((market) => market.salesUnits));
const topGrowthMarkets = new Set(
  [...marketSales]
    .sort((a, b) => b.yoyGrowthPct - a.yoyGrowthPct)
    .slice(0, 3)
    .map((market) => market.countryCode),
);

const factoryItems = factories.map((factory) => ({
  id: `factory-${factory.id}`,
  code: factory.countryCode,
  city: factory.name,
  country: factory.country,
  region: countryRegions[factory.country] ?? 'Global',
  lat: factory.lat,
  lng: factory.lng,
  type: 'Factory / Production base',
  signal: Math.round((factory.annualCapacityUnits / capacityMax) * 100),
  models: factory.mainProducts,
  note: `${factory.name} was established in ${factory.established}. Estimated annual capacity: ${factory.annualCapacityUnits.toLocaleString()} units.`,
  color: '#f04438',
  kind: 'factory',
  highGrowth: false,
  growth: null,
  share: null,
  statLabel: 'Annual capacity',
  statValue: `${Math.round(factory.annualCapacityUnits / 1000)}k`,
}));

const marketItems = marketSales.map((market) => ({
  id: `market-${market.countryCode}`,
  code: market.countryCode,
  city: market.country,
  country: market.country,
  region: countryRegions[market.country] ?? 'Global',
  lat: market.lat,
  lng: market.lng,
  type: market.hasFactory ? 'Market sales / Local factory' : 'Market sales',
  signal: Math.round((market.salesUnits / salesMax) * 100),
  models: (popularModels[market.country] ?? []).map((item) => `${item.rank}. ${item.model}`),
  note: `${market.salesUnits.toLocaleString()} demo sales units, ${market.yoyGrowthPct > 0 ? '+' : ''}${market.yoyGrowthPct}% YoY growth, ${market.marketSharePct}% market share.`,
  color: growthColor(market.yoyGrowthPct),
  kind: 'market',
  highGrowth: topGrowthMarkets.has(market.countryCode),
  growth: market.yoyGrowthPct,
  share: market.marketSharePct,
  statLabel: 'Market share',
  statValue: `${market.marketSharePct}%`,
}));

const allItems = [...factoryItems, ...marketItems];
const insights = generateInsights(marketSales, allItems);
const smartTour = buildSmartTour(insights, allItems);

app.innerHTML = `
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-mark">T</div>
      <div>
        <p class="eyebrow">Global Vehicle Network</p>
        <h1>Toyota 3D Globe</h1>
      </div>
    </div>

    <div class="metrics">
      <div><strong>${factories.length}</strong><span>factories</span></div>
      <div><strong>${marketSales.length}</strong><span>markets</span></div>
    </div>

    <details class="control-drawer">
      <summary>
        <span>
          <strong>Controls</strong>
          <small id="control-summary">All regions &middot; ${allItems.length} sites</small>
        </span>
        <span class="drawer-icon">v</span>
      </summary>

      <div class="control-content">
        <label class="search">
          <span>Search</span>
          <input id="search" placeholder="city, country, model" />
        </label>

        <div class="filters">
          ${regions.map((region) => `<button type="button" data-region="${region}" class="${region === 'All' ? 'active' : ''}">${region}</button>`).join('')}
        </div>

        <div class="layer-toggles">
          <label><input id="show-factories" type="checkbox" checked /> Factories</label>
          <label><input id="show-markets" type="checkbox" checked /> Markets</label>
          <label><input id="show-models" type="checkbox" checked /> Top models in details</label>
        </div>

        <div class="guide">
          <span>Drag to rotate</span>
          <span>Wheel or pinch to push / pull zoom</span>
          <span>Click a marker or site row</span>
        </div>
      </div>
    </details>

    <section id="related" class="related-panel" hidden></section>
    <div id="site-list" class="site-list"></div>
  </aside>

  <main class="stage">
    <div class="stage-title">
      <p class="eyebrow">WebGL live visualization</p>
      <h2>Global Toyota vehicle footprint</h2>
    </div>
    <div id="globe"></div>
    <section id="insights" class="insights-panel"></section>
    <div id="smart-tour" class="smart-tour" hidden></div>
    <section id="details" class="details"></section>
  </main>
`;

let selectedId = allItems[0].id;
let selectedRegion = 'All';
let query = '';
let showFactories = true;
let showMarkets = true;
let showModels = true;
let detailsVisible = false;
let recommendations = [];
let smartTourIndex = 0;

const listEl = document.querySelector('#site-list');
const relatedEl = document.querySelector('#related');
const detailsEl = document.querySelector('#details');
const insightsEl = document.querySelector('#insights');
const smartTourEl = document.querySelector('#smart-tour');
const controlSummaryEl = document.querySelector('#control-summary');
const searchEl = document.querySelector('#search');
const showFactoriesEl = document.querySelector('#show-factories');
const showMarketsEl = document.querySelector('#show-markets');
const showModelsEl = document.querySelector('#show-models');
const filterButtons = [...document.querySelectorAll('.filters button')];
const globe = createToyotaGlobe(document.querySelector('#globe'), { onSelect: selectSite });

function currentSites() {
  const layerItems = allItems.filter((item) => (item.kind === 'factory' ? showFactories : showMarkets));
  return filterSites(layerItems, selectedRegion, query);
}

function render() {
  const sites = currentSites();
  const selected = allItems.find((site) => site.id === selectedId) ?? sites[0] ?? allItems[0];
  if (!sites.some((site) => site.id === selected.id) && sites.length) selectedId = sites[0].id;

  const detailSite = allItems.find((site) => site.id === selectedId) ?? selected;
  recommendations = detailsVisible ? getTopRecommendations(detailSite, allItems, 3) : [];
  const arcs = recommendations.length
    ? buildRecommendationArcs(detailSite, recommendations)
    : buildNetworkArcs(sites.length ? sites : allItems).slice(0, 0);

  renderSiteList(listEl, sites, selectedId, selectSite);
  updateControlSummary(sites.length);
  renderRelated(detailSite);
  updateGlobeData(globe, sites, arcs, selectedId);

  if (detailsVisible) {
    renderDetails(detailsEl, detailSite, { showModels });
    detailsEl.classList.add('visible');
    positionDetails();
  } else {
    detailsEl.classList.remove('visible');
    detailsEl.innerHTML = '';
  }
}

function updateControlSummary(count) {
  const layers = [
    showFactories ? 'Factories' : null,
    showMarkets ? 'Markets' : null,
  ].filter(Boolean).join(' + ');
  const regionLabel = selectedRegion === 'All' ? 'All regions' : selectedRegion;
  const queryLabel = query ? ` · "${query}"` : '';
  controlSummaryEl.textContent = `${regionLabel}${queryLabel} · ${count} sites · ${layers}`;
}

function renderRelated(site) {
  if (!detailsVisible || !recommendations.length) {
    relatedEl.hidden = true;
    relatedEl.innerHTML = '';
    return;
  }

  relatedEl.hidden = false;
  relatedEl.innerHTML = `
    <p class="eyebrow">Related sites</p>
    <h3>${site.city}</h3>
    ${recommendations.map(({ site: item, reason }, index) => `
      <button type="button" data-id="${item.id}">
        <span>${index + 1}</span>
        <strong>${item.city}</strong>
        <small>${reason}</small>
      </button>
    `).join('')}
  `;
  relatedEl.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', () => selectSite(button.dataset.id));
  });
}

function renderInsights() {
  insightsEl.innerHTML = `
    <div class="insight-header">
      <span>Smart insights</span>
      <button id="tour-next" type="button">Smart tour</button>
    </div>
    ${insights.map((insight) => `
      <button class="insight-card" type="button" data-id="${insight.siteId}">
        <span>${insight.label}</span>
        <strong>${insight.title}</strong>
        <small>${insight.text}</small>
      </button>
    `).join('')}
  `;
  insightsEl.querySelectorAll('.insight-card').forEach((button) => {
    button.addEventListener('click', () => selectSite(button.dataset.id));
  });
  insightsEl.querySelector('#tour-next')?.addEventListener('click', playSmartTourStep);
}

function playSmartTourStep() {
  if (!smartTour.length) return;
  const item = smartTour[smartTourIndex % smartTour.length];
  smartTourIndex += 1;
  smartTourEl.hidden = false;
  smartTourEl.textContent = `${item.label}: ${item.title}`;
  selectSite(item.siteId);
}

function selectSite(id) {
  selectedId = id;
  detailsVisible = true;
  render();
}

function positionDetails() {
  if (!detailsVisible) return;
  const site = allItems.find((item) => item.id === selectedId);
  const stage = document.querySelector('.stage');
  const projected = globe.projectSite(site);
  if (!site || !projected || !projected.visible) {
    detailsEl.classList.remove('visible');
    return;
  }

  const stageRect = stage.getBoundingClientRect();
  const cardRect = detailsEl.getBoundingClientRect();
  const preferRight = projected.x < stageRect.width * 0.58;
  const offsetX = preferRight ? 22 : -(cardRect.width + 22);
  const offsetY = -Math.min(cardRect.height * 0.38, 112);
  const minX = 18;
  const minY = 96;
  const maxX = Math.max(minX, stageRect.width - cardRect.width - 18);
  const maxY = Math.max(minY, stageRect.height - cardRect.height - 18);
  const x = Math.min(Math.max(projected.x + offsetX, minX), maxX);
  const y = Math.min(Math.max(projected.y + offsetY, minY), maxY);

  detailsEl.style.left = `${x}px`;
  detailsEl.style.top = `${y}px`;
  detailsEl.style.right = 'auto';
  detailsEl.style.bottom = 'auto';
  detailsEl.dataset.anchor = preferRight ? 'left' : 'right';
  detailsEl.classList.add('visible');
}

searchEl.addEventListener('input', (event) => {
  query = event.target.value;
  render();
});

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    selectedRegion = button.dataset.region;
    filterButtons.forEach((item) => item.classList.toggle('active', item === button));
    render();
  });
});

showFactoriesEl.addEventListener('change', (event) => {
  showFactories = event.target.checked;
  if (!showFactories && !showMarkets) {
    showMarkets = true;
    showMarketsEl.checked = true;
  }
  render();
});

showMarketsEl.addEventListener('change', (event) => {
  showMarkets = event.target.checked;
  if (!showFactories && !showMarkets) {
    showFactories = true;
    showFactoriesEl.checked = true;
  }
  render();
});

showModelsEl.addEventListener('change', (event) => {
  showModels = event.target.checked;
  render();
});

window.addEventListener('resize', () => globe.width(document.querySelector('#globe').clientWidth));

function followSelectedPin() {
  positionDetails();
  requestAnimationFrame(followSelectedPin);
}

render();
renderInsights();
requestAnimationFrame(followSelectedPin);
