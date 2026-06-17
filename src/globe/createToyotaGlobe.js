import * as THREE from 'three';

const EARTH_RADIUS = 2.35;
const MARKER_RADIUS = EARTH_RADIUS * 1.045;
const TEXTURE_PATHS = {
  earth: 'textures/earth-blue-marble.jpg',
  bump: 'textures/earth-topology.png',
  clouds: 'textures/earth-clouds.png',
  sky: 'textures/night-sky.png',
};

function latLngToVector3(lat, lng, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function makeArcCurve(arc) {
  const start = latLngToVector3(arc.startLat, arc.startLng, MARKER_RADIUS);
  const end = latLngToVector3(arc.endLat, arc.endLng, MARKER_RADIUS);
  const mid = start.clone().add(end).normalize().multiplyScalar(3.18);
  return new THREE.QuadraticBezierCurve3(start, mid, end);
}

function configureTexture(texture, renderer, color = true) {
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

function growthToColor(growth) {
  if (growth == null) return '#adb5bd';
  if (growth < 0) return '#e63946';
  if (growth < 3) return '#adb5bd';
  if (growth < 7) return '#f2994a';
  return '#2a9d8f';
}

function markerFacingCamera(object, camera) {
  const worldPoint = object.getWorldPosition(new THREE.Vector3());
  const normal = worldPoint.clone().normalize();
  const cameraDirection = camera.position.clone().sub(worldPoint).normalize();
  return normal.dot(cameraDirection);
}

function makeFactoryPinTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 168;
  const ctx = canvas.getContext('2d');

  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 7;

  const gradient = ctx.createLinearGradient(0, 8, 0, 128);
  gradient.addColorStop(0, '#ff5858');
  gradient.addColorStop(1, '#c1121f');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(64, 158);
  ctx.bezierCurveTo(50, 132, 18, 102, 18, 59);
  ctx.bezierCurveTo(18, 28, 39, 8, 64, 8);
  ctx.bezierCurveTo(89, 8, 110, 28, 110, 59);
  ctx.bezierCurveTo(110, 102, 78, 132, 64, 158);
  ctx.closePath();
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(64, 60, 31, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#c1121f';
  ctx.fillRect(43, 62, 42, 19);
  ctx.fillRect(48, 51, 7, 12);
  ctx.fillRect(61, 45, 7, 18);
  ctx.fillRect(73, 55, 7, 8);
  ctx.beginPath();
  ctx.moveTo(43, 62);
  ctx.lineTo(55, 52);
  ctx.lineTo(65, 62);
  ctx.lineTo(76, 53);
  ctx.lineTo(85, 62);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  [48, 60, 72].forEach((x) => ctx.fillRect(x, 68, 7, 8));

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeMarketBadgeTexture(site) {
  const canvas = document.createElement('canvas');
  canvas.width = 144;
  canvas.height = 144;
  const ctx = canvas.getContext('2d');
  const ringColor = growthToColor(site.growth);
  const share = THREE.MathUtils.clamp(site.share ?? 20, 0, 60) / 60;
  const center = 72;

  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = 'rgba(12, 18, 32, 0.84)';
  ctx.beginPath();
  ctx.arc(center, center, 55, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = 'transparent';

  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(center, center, 55, -Math.PI / 2, Math.PI * 1.5);
  ctx.stroke();
  ctx.strokeStyle = ringColor;
  ctx.beginPath();
  ctx.arc(center, center, 55, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * share);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.arc(center, center, 38, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 31px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((site.code ?? site.country ?? '').slice(0, 2).toUpperCase(), center, center - 2);

  ctx.font = '700 12px system-ui, sans-serif';
  ctx.fillStyle = ringColor;
  const growth = site.growth == null ? '' : `${site.growth > 0 ? '+' : ''}${site.growth}%`;
  ctx.fillText(growth, center, 110);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createToyotaGlobe(container, { onSelect }) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x03060d, 10, 18);

  const camera = new THREE.PerspectiveCamera(44, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(0, 0.18, 8.35);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  const textureLoader = new THREE.TextureLoader();
  const earthMap = configureTexture(textureLoader.load(TEXTURE_PATHS.earth), renderer);
  const bumpMap = configureTexture(textureLoader.load(TEXTURE_PATHS.bump), renderer, false);
  const cloudMap = configureTexture(textureLoader.load(TEXTURE_PATHS.clouds), renderer);
  const skyMap = configureTexture(textureLoader.load(TEXTURE_PATHS.sky), renderer);

  const globeGroup = new THREE.Group();
  scene.add(globeGroup);

  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_RADIUS, 128, 128),
    new THREE.MeshStandardMaterial({
      map: earthMap,
      bumpMap,
      bumpScale: 0.075,
      roughness: 0.78,
      metalness: 0.02,
    }),
  );
  globeGroup.add(earth);

  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_RADIUS * 1.012, 128, 128),
    new THREE.MeshPhongMaterial({
      map: cloudMap,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      blending: THREE.NormalBlending,
    }),
  );
  globeGroup.add(clouds);

  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_RADIUS * 1.038, 128, 128),
    new THREE.MeshBasicMaterial({
      color: 0x9fd6ff,
      transparent: true,
      opacity: 0.085,
      side: THREE.BackSide,
    }),
  );
  globeGroup.add(atmosphere);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(34, 48, 48),
    new THREE.MeshBasicMaterial({
      map: skyMap,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    }),
  );
  scene.add(sky);

  const markerGroup = new THREE.Group();
  const arcGroup = new THREE.Group();
  globeGroup.add(arcGroup, markerGroup);

  scene.add(new THREE.AmbientLight(0xffffff, 0.72));
  const key = new THREE.DirectionalLight(0xffffff, 2.25);
  key.position.set(-4.8, 2.4, 5.8);
  scene.add(key);
  const rim = new THREE.PointLight(0x9fd6ff, 7.5, 14);
  rim.position.set(4, 1.8, -4);
  scene.add(rim);

  const stars = new THREE.Points(
    new THREE.BufferGeometry().setAttribute(
      'position',
      new THREE.Float32BufferAttribute(Array.from({ length: 450 }, () => (Math.random() - 0.5) * 25), 3),
    ),
    new THREE.PointsMaterial({ color: 0xffffff, size: 0.012, transparent: true, opacity: 0.25 }),
  );
  scene.add(stars);

  const factoryPinTexture = makeFactoryPinTexture();
  const badgeTextureCache = new Map();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let selectedId = null;

  function clearGroup(group) {
    group.children.forEach((child) => {
      child.geometry?.dispose();
      child.material?.dispose();
    });
    group.clear();
  }

  function badgeTextureFor(site) {
    const key = `${site.id}-${site.growth}-${site.share}-${site.code}`;
    if (!badgeTextureCache.has(key)) badgeTextureCache.set(key, makeMarketBadgeTexture(site));
    return badgeTextureCache.get(key);
  }

  function setData(sites, arcs, activeId) {
    selectedId = activeId;
    clearGroup(markerGroup);
    clearGroup(arcGroup);

    arcs.forEach((arc) => {
      const siteSelected = arc.siteId === selectedId || arc.recommended;
      const line = new THREE.Mesh(
        new THREE.TubeGeometry(makeArcCurve(arc), 42, siteSelected ? 0.007 : 0.0042, 8, false),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(arc.color[1]),
          transparent: true,
          opacity: siteSelected ? 0.56 : 0.16,
          depthWrite: false,
        }),
      );
      line.userData = { id: arc.siteId, recommended: arc.recommended };
      arcGroup.add(line);
    });

    sites.forEach((site, index) => {
      const point = latLngToVector3(site.lat, site.lng, MARKER_RADIUS);
      const color = new THREE.Color(site.color);
      const isFactory = site.kind === 'factory';
      const texture = isFactory ? factoryPinTexture : badgeTextureFor(site);
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
      const marker = new THREE.Sprite(material);
      marker.position.copy(point);
      const badgeSize = 0.26 + (site.signal / 100) * 0.2;
      const width = isFactory ? 0.32 : badgeSize;
      const height = isFactory ? 0.43 : badgeSize;
      marker.scale.set(width * 0.1, height * 0.1, 1);
      marker.userData = {
        id: site.id,
        marker: true,
        baseScale: new THREE.Vector3(width, height, 1),
        delay: index * 2.2,
      };

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.1, 0.13, 48),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      ring.position.copy(point.clone().multiplyScalar(1.006));
      ring.lookAt(new THREE.Vector3(0, 0, 0));
      ring.userData = { id: site.id, ring: true, highGrowth: site.highGrowth };

      markerGroup.add(ring, marker);
    });
  }

  function focus(site) {
    if (!site) return;
    const target = latLngToVector3(site.lat, site.lng, 1);
    globeGroup.rotation.y = Math.atan2(target.x, target.z);
    globeGroup.rotation.x = THREE.MathUtils.clamp(Math.asin(target.y) * -0.52, -0.9, 0.9);
  }

  function resize(width = container.clientWidth) {
    camera.aspect = width / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(width, container.clientHeight);
  }

  function projectSite(site) {
    if (!site) return null;
    globeGroup.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);

    const worldPoint = latLngToVector3(site.lat, site.lng, MARKER_RADIUS)
      .applyMatrix4(globeGroup.matrixWorld);
    const normal = worldPoint.clone().normalize();
    const cameraDirection = camera.position.clone().sub(worldPoint).normalize();
    const facing = normal.dot(cameraDirection);
    const projected = worldPoint.clone().project(camera);
    const visible = facing > 0.1 && projected.z > -1 && projected.z < 1;

    return {
      x: ((projected.x + 1) / 2) * container.clientWidth,
      y: ((-projected.y + 1) / 2) * container.clientHeight,
      visible,
    };
  }

  function setPointer(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  renderer.domElement.addEventListener('pointerdown', (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    renderer.domElement.setPointerCapture(event.pointerId);
  });

  renderer.domElement.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    globeGroup.rotation.y += dx * 0.006;
    globeGroup.rotation.x = THREE.MathUtils.clamp(globeGroup.rotation.x + dy * 0.004, -0.9, 0.9);
    lastX = event.clientX;
    lastY = event.clientY;
  });

  renderer.domElement.addEventListener('pointerup', (event) => {
    dragging = false;
    try {
      renderer.domElement.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
  });

  renderer.domElement.addEventListener('wheel', (event) => {
    event.preventDefault();
    camera.position.z = THREE.MathUtils.clamp(camera.position.z + event.deltaY * 0.004, 4.15, 9.5);
  }, { passive: false });

  renderer.domElement.addEventListener('click', (event) => {
    setPointer(event);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster
      .intersectObjects(markerGroup.children, false)
      .find((item) => item.object.userData.marker);
    if (hit) onSelect(hit.object.userData.id);
  });

  let frame = 0;
  function animate() {
    frame += 1;

    markerGroup.children.forEach((child) => {
      if (child.userData.marker) {
        const facing = markerFacingCamera(child, camera);
        const visibility = THREE.MathUtils.clamp((facing - 0.1) / 0.22, 0, 1);
        child.visible = visibility > 0.02;
        child.material.opacity = visibility;
        const delay = child.userData.delay ?? 0;
        if (frame > delay) child.scale.lerp(child.userData.baseScale, 0.11);
      }

      if (child.userData.ring) {
        const facing = markerFacingCamera(child, camera);
        const visibility = THREE.MathUtils.clamp((facing - 0.1) / 0.22, 0, 1);
        const active = child.userData.id === selectedId;
        const highGrowth = child.userData.highGrowth;
        child.visible = visibility > 0.02 && (active || highGrowth);
        const pulse = Math.sin(frame * (active ? 0.075 : 0.052));
        child.scale.setScalar(active ? 1.34 + pulse * 0.14 : 1.08 + pulse * 0.18);
        child.material.opacity = visibility * (active ? 0.6 : 0.18 + (pulse + 1) * 0.05);
      }
    });

    arcGroup.children.forEach((child) => {
      const active = child.userData.id === selectedId || child.userData.recommended;
      child.material.opacity = active ? 0.56 : 0.14 + Math.sin(frame * 0.025) * 0.035;
    });

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  window.addEventListener('resize', () => resize());
  requestAnimationFrame(animate);

  return {
    setData,
    focus,
    projectSite,
    resize,
    width: resize,
  };
}

export function updateGlobeData(globe, sites, arcs, selectedId) {
  const selected = sites.find((site) => site.id === selectedId);
  globe.setData(sites, arcs, selectedId);
  globe.focus(selected);
}
