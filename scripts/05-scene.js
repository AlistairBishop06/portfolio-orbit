import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const TAU = Math.PI * 2;

function makeGlowTexture(color) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.28, `${color}cc`);
  gradient.addColorStop(1, `${color}00`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

function createPointField(count, radius, palette, size, opacity) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * TAU;
    const distance = Math.random() ** 0.62 * radius;
    const height = (Math.random() - 0.5) * radius * 0.32;
    const color = new THREE.Color(palette[index % palette.length]);

    positions[index * 3] = Math.cos(angle) * distance;
    positions[index * 3 + 1] = height;
    positions[index * 3 + 2] = Math.sin(angle) * distance;
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size,
    vertexColors: true,
    transparent: true,
    opacity,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  return new THREE.Points(geometry, material);
}

function createOrbitRing(radius, color, tilt) {
  const points = [];
  for (let index = 0; index <= 192; index += 1) {
    const angle = (index / 192) * TAU;
    points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.14,
    blending: THREE.AdditiveBlending,
  });
  const ring = new THREE.LineLoop(geometry, material);
  ring.rotation.x = tilt;
  return ring;
}

function createBodyGroup(body, clickableMeshes, animatables, glowCache) {
  const group = new THREE.Group();
  group.position.set(...(body.position ?? [0, 0, 0]));
  group.userData.body = body;
  const color = new THREE.Color(body.color);
  const isStar = body.kind === 'star';

  if (isStar) {
    const light = new THREE.PointLight(color, body.brightness, 56);
    group.add(light);
    animatables.push({ type: 'pulseLight', light, body });
  }

  const geometry = new THREE.SphereGeometry(body.size, isStar ? 64 : 40, isStar ? 64 : 40);
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: isStar ? body.brightness : body.brightness * 0.62,
    roughness: isStar ? 0.26 : 0.46,
    metalness: isStar ? 0.02 : 0.12,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.body = body;
  group.add(mesh);
  clickableMeshes.push(mesh);
  animatables.push({ type: isStar ? 'star' : 'planet', mesh, body });

  if (!glowCache.has(body.color)) {
    glowCache.set(body.color, makeGlowTexture(body.color));
  }

  const glowSize = body.size * (isStar ? 4.2 : 2.1);
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowCache.get(body.color),
      color,
      transparent: true,
      opacity: isStar ? 0.56 : 0.28,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  glow.scale.set(glowSize, glowSize, 1);
  group.add(glow);

  if (!isStar && body.normalisedCommits > 0.54) {
    const ringGeometry = new THREE.RingGeometry(body.size * 1.42, body.size * 1.7, 80);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: '#f7fbff',
      transparent: true,
      opacity: 0.26,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.set(Math.PI / 2.4, 0.25, 0);
    group.add(ring);
  }

  if (!isStar && body.normalisedCommits > 0.78) {
    const moonPivot = new THREE.Group();
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(0.08, body.size * 0.16), 16, 16),
      new THREE.MeshStandardMaterial({
        color: '#f7fbff',
        emissive: color,
        emissiveIntensity: 0.32,
        roughness: 0.4,
      }),
    );
    moon.position.set(body.size * 2.35, body.size * 0.35, 0);
    moonPivot.add(moon);
    group.add(moonPivot);
    animatables.push({ type: 'moon', mesh: moonPivot });
  }

  return group;
}

function disposeTree(root) {
  root.traverse((object) => {
    object.geometry?.dispose?.();
    if (Array.isArray(object.material)) {
      object.material.forEach((material) => material.dispose?.());
    } else {
      object.material?.dispose?.();
    }
  });
}

export function createGalaxyScene(container, callbacks = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor('#02030b');
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#050817', 130, 420);

  const camera = new THREE.PerspectiveCamera(
    54,
    container.clientWidth / container.clientHeight,
    0.1,
    680,
  );
  camera.position.set(0, 54, 172);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.enablePan = true;
  controls.panSpeed = 0.42;
  controls.rotateSpeed = 0.44;
  controls.zoomSpeed = 0.56;
  controls.minDistance = 12;
  controls.maxDistance = 360;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.13;

  scene.add(new THREE.AmbientLight('#90a8ff', 0.26));
  scene.add(new THREE.HemisphereLight('#bcd4ff', '#100614', 0.28));
  scene.add(createPointField(6500, 440, ['#f7fbff', '#7ddcff', '#ffc98a', '#d39aff'], 0.9, 0.46));
  scene.add(createPointField(1300, 330, ['#6ea8ff', '#d39aff', '#5fe7bf', '#ffad6b'], 1.45, 0.16));

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(99, 99);
  const clock = new THREE.Clock();
  const tooltip = document.querySelector('#repo-tooltip');
  const clickableMeshes = [];
  const animatables = [];
  const glowCache = new Map();
  const focusTarget = new THREE.Vector3(0, 0, 0);

  let systemRoot = new THREE.Group();
  let hoveredMesh = null;
  let selectedRepoId = null;
  scene.add(systemRoot);

  function setTooltip(mesh) {
    if (!mesh) {
      tooltip.classList.add('hidden');
      return;
    }

    const body = mesh.userData.body;
    const worldPosition = new THREE.Vector3();
    mesh.getWorldPosition(worldPosition);
    worldPosition.y += body.size + 0.8;
    worldPosition.project(camera);

    const rect = renderer.domElement.getBoundingClientRect();
    const x = rect.left + (worldPosition.x * 0.5 + 0.5) * rect.width;
    const y = rect.top + (-worldPosition.y * 0.5 + 0.5) * rect.height;

    tooltip.textContent = body.repo.name;
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
    tooltip.style.transform = 'translate(-50%, -100%)';
    tooltip.classList.toggle('hidden', worldPosition.z < -1 || worldPosition.z > 1);
  }

  function updateHover(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);

    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(clickableMeshes, false)[0]?.object ?? null;

    if (hoveredMesh !== hit) {
      hoveredMesh = hit;
      renderer.domElement.style.cursor = hoveredMesh ? 'pointer' : 'grab';
      setTooltip(hoveredMesh);
    }
  }

  renderer.domElement.addEventListener('pointermove', updateHover);
  renderer.domElement.addEventListener('pointerleave', () => {
    hoveredMesh = null;
    renderer.domElement.style.cursor = 'grab';
    setTooltip(null);
  });
  renderer.domElement.addEventListener('click', () => {
    if (!hoveredMesh) return;
    const body = hoveredMesh.userData.body;
    selectedRepoId = body.repo.id;
    focusTarget.set(...body.systemPosition);
    controls.autoRotate = false;
    callbacks.onSelect?.(body);
  });

  function resize() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  window.addEventListener('resize', resize);

  function render() {
    const delta = clock.getDelta();
    const elapsed = clock.elapsedTime;

    for (const item of animatables) {
      if (item.type === 'orbit') {
        item.pivot.rotation.y += item.speed * delta;
      } else if (item.type === 'star') {
        item.mesh.rotation.y += delta * 0.08;
        const pulse = 1 + Math.sin(elapsed * 1.7 + item.body.size) * 0.035;
        item.mesh.scale.setScalar(pulse);
      } else if (item.type === 'planet') {
        item.mesh.rotation.y += delta * 0.16;
      } else if (item.type === 'moon') {
        item.mesh.rotation.y += delta * 0.62;
      } else if (item.type === 'pulseLight') {
        item.light.intensity = item.body.brightness + Math.sin(elapsed * 1.2) * 0.16;
      }
    }

    controls.target.lerp(focusTarget, selectedRepoId ? 0.045 : 0.018);
    controls.update();
    setTooltip(hoveredMesh);
    renderer.render(scene, camera);
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);

  return {
    setLayout(layout) {
      scene.remove(systemRoot);
      disposeTree(systemRoot);
      clickableMeshes.length = 0;
      animatables.length = 0;
      hoveredMesh = null;
      selectedRepoId = null;
      focusTarget.set(0, 0, 0);
      controls.autoRotate = true;
      setTooltip(null);

      systemRoot = new THREE.Group();

      for (const system of layout.systems) {
        const systemGroup = new THREE.Group();
        systemGroup.position.set(...system.position);

        const star = createBodyGroup(system.star, clickableMeshes, animatables, glowCache);
        systemGroup.add(star);

        for (const planet of system.planets) {
          const orbitPlane = new THREE.Group();
          orbitPlane.rotation.set(planet.tilt, 0, planet.phase);
          orbitPlane.add(createOrbitRing(planet.orbitRadius, planet.color, planet.tilt * 0.3));

          const pivot = new THREE.Group();
          pivot.rotation.y = planet.initialAngle;
          const planetGroup = createBodyGroup(planet, clickableMeshes, animatables, glowCache);
          planetGroup.position.set(planet.orbitRadius, 0, 0);
          pivot.add(planetGroup);
          orbitPlane.add(pivot);
          animatables.push({ type: 'orbit', pivot, speed: planet.speed });

          systemGroup.add(orbitPlane);
        }

        systemRoot.add(systemGroup);
      }

      scene.add(systemRoot);
    },
    clearSelection() {
      selectedRepoId = null;
      focusTarget.set(0, 0, 0);
      controls.autoRotate = true;
    },
  };
}
