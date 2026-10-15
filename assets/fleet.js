'use strict';
(() => {
  // Preserved demonstration data. Replace this data boundary with an authenticated
  // telematics integration before presenting any vehicle positions as live.
  const DEPOT = { name: 'Harare Bulk Depot', lat: -17.8252, lng: 31.0335 };
  const TOWNS = {
    mutare: { name: 'Mutare', lat: -18.9707, lng: 32.6709 },
    gweru: { name: 'Gweru', lat: -19.4500, lng: 29.8167 },
    bulawayo: { name: 'Bulawayo', lat: -20.1500, lng: 28.5833 },
    chinhoyi: { name: 'Chinhoyi', lat: -17.3667, lng: 30.2000 },
    masvingo: { name: 'Masvingo', lat: -20.0637, lng: 30.8277 }
  };
  const ROUTES = [
    { id: 'OMK-14', product: 'Diesel · 30,000L', waypoints: [DEPOT, TOWNS.mutare], duration: 26000, status: 'transit', driver: 'Route to Mutare farms' },
    { id: 'OMK-08', product: 'Petrol · 25,000L', waypoints: [DEPOT, TOWNS.gweru, TOWNS.bulawayo], duration: 40000, status: 'transit', driver: 'Route to Bulawayo corridor' },
    { id: 'OMK-21', product: 'LPG · 12,000kg', waypoints: [DEPOT, TOWNS.chinhoyi], duration: 18000, status: 'loading', driver: 'Loading at Harare depot' },
    { id: 'OMK-05', product: 'Diesel · 28,000L', waypoints: [DEPOT, TOWNS.masvingo], duration: 32000, status: 'transit', driver: 'Route to Masvingo farms' }
  ];
  const mapElement = document.getElementById('fleetMap');
  const mapStatus = document.getElementById('mapStatus');
  const panel = document.getElementById('fleetItems');
  const fit = document.getElementById('fitRoutes');
  const pause = document.getElementById('pauseFleet');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const truckIcon = '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 5h13v12H2zM15 10h4l3 4v3h-7"/><circle cx="6" cy="18" r="2" fill="currentColor"/><circle cx="18" cy="18" r="2" fill="currentColor"/></svg>';
  let map, tiles, filter = 'all', selected = 'OMK-14', started = false, inView = false;
  let paused = false, frame = 0, last = 0, elapsed = 0, lastPaint = 0;
  const trucks = [];
  fit.disabled = true;
  pause.disabled = true;

  ROUTES.forEach(route => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'fleet-item';
    button.dataset.id = route.id;
    button.setAttribute('aria-pressed', String(route.id === selected));
    button.innerHTML = `<span class="fi-icon">${truckIcon}</span><span class="fi-body"><span class="fi-id">${route.id}</span><span class="fi-route" style="display:block">${route.driver}</span><span class="fi-meta"><span class="status-chip status-${route.status}">${route.status === 'transit' ? 'In transit' : 'Loading'}</span><span>${route.product}</span></span></span>`;
    button.addEventListener('click', () => select(route.id, true));
    panel.append(button);
  });
  function select(id, focusMap = false) {
    selected = id;
    panel.querySelectorAll('button').forEach(button => {
      button.classList.toggle('active', button.dataset.id === id);
      button.setAttribute('aria-pressed', String(button.dataset.id === id));
    });
    trucks.forEach(truck => {
      const active = truck.route.id === id;
      truck.line.setStyle({ color: active ? '#b84d14' : '#3c7868', weight: active ? 3 : 2, opacity: active ? .9 : .5 });
      truck.marker.setZIndexOffset(active ? 1000 : 0);
      if (active && focusMap) {
        map.fitBounds(truck.line.getBounds(), { padding: [35,35], maxZoom: 8, animate: !reduced.matches });
        truck.marker.openPopup();
      }
    });
  }
  select(selected);
  function applyFilter(value) {
    filter = value;
    const visible = ROUTES.filter(route => value === 'all' || route.status === value);
    document.querySelectorAll('[data-filter]').forEach(button => {
      button.classList.toggle('active', button.dataset.filter === value);
      button.setAttribute('aria-pressed', String(button.dataset.filter === value));
    });
    panel.querySelectorAll('button').forEach(button => { button.hidden = !visible.some(route => route.id === button.dataset.id); });
    document.getElementById('fleetCount').textContent = `${visible.length} demonstration vehicle${visible.length === 1 ? '' : 's'}${value === 'all' ? '' : ' · ' + (value === 'transit' ? 'In transit' : 'Loading')}`;
    trucks.forEach(truck => {
      const show = visible.includes(truck.route);
      [truck.line, truck.marker].forEach(layer => { if (show) layer.addTo(map); else map.removeLayer(layer); });
    });
    if (!visible.some(route => route.id === selected)) select(visible[0]?.id || null);
    else select(selected);
    if (map) fitVisible();
  }
  document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => applyFilter(button.dataset.filter)));
  function fitVisible() {
    const points = ROUTES.filter(route => filter === 'all' || route.status === filter).flatMap(route => route.waypoints.map(w => [w.lat,w.lng]));
    if (points.length) map.fitBounds(points, { padding: [35,35], maxZoom: 8, animate: !reduced.matches });
  }
  fit.addEventListener('click', () => { applyFilter('all'); map.closePopup(); });
  function syncMotion() {
    pause.disabled = !map || reduced.matches;
    pause.textContent = reduced.matches ? 'Reduced motion enabled' : paused ? 'Resume simulation' : 'Pause simulation';
    pause.setAttribute('aria-pressed', String(paused || reduced.matches));
    cancelAnimationFrame(frame); frame = 0; last = 0;
    if (map && inView && !paused && !reduced.matches && !document.hidden) frame = requestAnimationFrame(tick);
  }
  pause.addEventListener('click', () => { paused = !paused; syncMotion(); });
  reduced.addEventListener('change', syncMotion);
  document.addEventListener('visibilitychange', syncMotion);
  function positionAlong(waypoints, t) {
    const scaled = t * (waypoints.length - 1);
    const leg = Math.min(Math.floor(scaled), waypoints.length - 2);
    const a = waypoints[leg], b = waypoints[leg+1], portion = scaled - leg;
    return [a.lat + (b.lat-a.lat)*portion, a.lng + (b.lng-a.lng)*portion];
  }
  function tick(now) {
    if (last) elapsed += now-last;
    last = now;
    if (now-lastPaint > 80) {
      trucks.forEach((truck, index) => {
        if (truck.route.status === 'loading' || !map.hasLayer(truck.marker)) return;
        const t = ((elapsed+index*900) % truck.route.duration) / truck.route.duration;
        truck.marker.setLatLng(positionAlong(truck.route.waypoints, t < .5 ? t*2 : 2-t*2));
      });
      lastPaint = now;
    }
    frame = requestAnimationFrame(tick);
  }
  function loadMap() {
    if (started) return;
    started = true;
    const script = document.createElement('script');
    script.src = 'assets/vendor/leaflet.js';
    script.onload = initialize;
    script.onerror = () => {
      mapElement.replaceChildren();
      const message = document.createElement('p');
      message.className = 'map-loading';
      message.textContent = 'The map could not load. You can still browse the demonstration routes alongside it.';
      mapElement.append(message);
      const retry = document.createElement('button');
      retry.type = 'button'; retry.textContent = 'Retry map'; retry.className = 'btn btn-primary';
      retry.addEventListener('click', () => { retry.remove(); started = false; loadMap(); });
      mapElement.append(retry);
    };
    document.head.append(script);
  }
  function initialize() {
    if (!window.L) return;
    mapElement.replaceChildren();
    map = L.map(mapElement, { scrollWheelZoom: false, attributionControl: true, zoomAnimation: !reduced.matches });
    tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 12,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    let tileError = false;
    tiles.on('loading', () => { tileError = false; });
    tiles.on('tileerror', () => {
      if (tileError) return;
      tileError = true;
      mapStatus.replaceChildren(document.createTextNode('Some map tiles are unavailable. Routes remain visible. '));
      const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Retry tiles';
      retry.addEventListener('click', () => { mapStatus.textContent = ''; tiles.redraw(); });
      mapStatus.append(retry);
    });
    tiles.on('load', () => { if (!tileError) mapStatus.textContent = ''; });
    L.marker([DEPOT.lat, DEPOT.lng], { title: DEPOT.name, icon: L.divIcon({ className: '', html: '<div class="depot-marker"></div>', iconSize: [16,16] }) })
      .addTo(map).bindPopup(`<b>${DEPOT.name}</b><br>Dispatch &amp; bulk storage`);
    Object.values(TOWNS).forEach(town => L.marker([town.lat,town.lng], { title: town.name, icon: L.divIcon({ className: '', html: '<div class="stop-marker"></div>', iconSize: [10,10] }) })
      .addTo(map).bindPopup(`<b>${town.name}</b><br>Delivery zone`));
    ROUTES.forEach((route,index) => {
      const points = route.waypoints.map(w => [w.lat,w.lng]);
      const line = L.polyline(points, { color: '#3c7868', weight: 2, opacity: .5, dashArray: '5,7' }).addTo(map);
      const marker = L.marker(route.status === 'loading' ? points[0] : positionAlong(route.waypoints, .22 + index*.12), {
        title: `${route.id}, simulated ${route.product}`, autoPanOnFocus: false,
        icon: L.divIcon({ className: '', html: `<div class="truck-marker">${route.id.slice(-2)}</div>`, iconSize: [27,27] })
      }).addTo(map).bindPopup(`<b>${route.id}</b><br>${route.product}<br>${route.driver}<br><small>Demonstration position</small>`);
      marker.on('click', () => select(route.id));
      trucks.push({ route, line, marker });
    });
    applyFilter(filter);
    fit.disabled = false;
    syncMotion();
    new ResizeObserver(() => map.invalidateSize({ pan: false })).observe(mapElement);
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) loadMap();
      syncMotion();
    }, { rootMargin: '200px' }).observe(document.getElementById('tracker'));
  } else { inView = true; loadMap(); }
})();
