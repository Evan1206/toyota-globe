export function renderSiteList(container, sites, selectedId, onSelect) {
  container.innerHTML = sites.map((site) => `
    <button class="site-row ${site.id === selectedId ? 'selected' : ''}" data-id="${site.id}" type="button">
      <span class="dot" style="background:${site.color}"></span>
      <span>
        <strong>${site.city}</strong>
        <small>${site.country} &middot; ${site.type}</small>
      </span>
      <em>${site.signal}</em>
    </button>
  `).join('');

  container.querySelectorAll('.site-row').forEach((button) => {
    button.addEventListener('click', () => onSelect(button.dataset.id));
  });
}

export function renderDetails(container, site, options = {}) {
  const { showModels = true } = options;
  const title = site.city === site.country ? site.country : `${site.city}, ${site.country}`;
  container.innerHTML = `
    <div class="detail-heading">
      <span style="background:${site.color}"></span>
      <div>
        <p class="eyebrow">${site.region}</p>
        <h2>${title}</h2>
      </div>
    </div>
    <p>${site.note}</p>
    <div class="detail-grid">
      <div>
        <span class="label">Site type</span>
        <strong>${site.type}</strong>
      </div>
      <div>
        <span class="label">${site.statLabel ?? 'Signal'}</span>
        <strong>${site.statValue ?? site.signal}</strong>
      </div>
    </div>
    ${showModels ? `<div class="tag-list">${site.models.map((model) => `<span>${model}</span>`).join('')}</div>` : ''}
  `;
}
