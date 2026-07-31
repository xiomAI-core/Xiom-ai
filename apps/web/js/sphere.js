/**
 * XIOM Sphere Visualization
 * 3D node-edge world model centerpiece.
 */
(function () {
  'use strict';

  const THREE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  const CONTROLS_CDN = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js';

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === 'true') {
          resolve();
          return;
        }
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => {
        script.dataset.loaded = 'true';
        resolve();
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function ensureThree() {
    if (!window.THREE || String(window.THREE.REVISION) !== '128') {
      await loadScript(THREE_CDN);
    }
    if (!window.THREE) {
      throw new Error('Three.js failed to load');
    }
    if (!window.THREE.OrbitControls) {
      try {
        await loadScript(CONTROLS_CDN);
      } catch {
        // OrbitControls optional; fallback handled below.
      }
    }
  }

  function randomOnSphere(radius) {
    const u = Math.random() * 2 - 1;
    const theta = Math.random() * Math.PI * 2;
    const localRadius = radius + (Math.random() - 0.5) * 0.35;
    const s = Math.sqrt(1 - u * u);
    return new window.THREE.Vector3(
      localRadius * s * Math.cos(theta),
      localRadius * u,
      localRadius * s * Math.sin(theta)
    );
  }

  function createVisualization() {
    const canvas = document.getElementById('sphere-canvas');
    if (!canvas) return;

    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100vh';
    canvas.style.zIndex = '-1';
    canvas.style.pointerEvents = 'none';

    const isMobile = window.innerWidth < 768;
    const nodeCount = isMobile ? 80 : 180;
    const sphereRadius = isMobile ? 2.2 : 3.0;
    const pulseNodeCount = Math.max(10, Math.round(nodeCount * 0.12));
    const glowNodeCount = Math.max(10, Math.round(nodeCount * 0.08));

    const renderer = new window.THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);

    const scene = new window.THREE.Scene();
    const camera = new window.THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 0, 7);

    const rootGroup = new window.THREE.Group();
    scene.add(rootGroup);

    const nodes = [];
    const pulseNodes = [];
    const glowNodes = [];

    const nodeGeometry = new window.THREE.SphereGeometry(0.05, 8, 8);
    const nodeMaterialDim = new window.THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.6,
    });
    const nodeMaterialBright = new window.THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1.0,
    });
    const glowMaterialBase = new window.THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.28,
    });

    for (let i = 0; i < nodeCount; i += 1) {
      const position = randomOnSphere(sphereRadius);
      const isBright = Math.random() < 0.18;
      const node = new window.THREE.Mesh(
        nodeGeometry,
        isBright ? nodeMaterialBright : nodeMaterialDim
      );
      node.position.copy(position);
      rootGroup.add(node);
      nodes.push(node);
    }

    const pulseIndices = new Set();
    while (pulseIndices.size < pulseNodeCount) {
      pulseIndices.add(Math.floor(Math.random() * nodes.length));
    }
    pulseIndices.forEach((index) => {
      pulseNodes.push({
        mesh: nodes[index],
        phase: Math.random() * Math.PI * 2,
      });
    });

    const glowIndices = new Set();
    while (glowIndices.size < glowNodeCount) {
      glowIndices.add(Math.floor(Math.random() * nodes.length));
    }
    glowIndices.forEach((index) => {
      const glow = new window.THREE.Mesh(
        new window.THREE.SphereGeometry(0.09, 8, 8),
        glowMaterialBase.clone()
      );
      glow.position.copy(nodes[index].position);
      rootGroup.add(glow);
      glowNodes.push({
        mesh: glow,
        phase: Math.random() * Math.PI * 2,
      });
    });

    const threshold = isMobile ? 0.9 : 0.8;
    const edgePositions = [];
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i].position;
        const b = nodes[j].position;
        if (a.distanceToSquared(b) <= threshold * threshold) {
          edgePositions.push(a.x, a.y, a.z, b.x, b.y, b.z);
        }
      }
    }

    const edgesGeometry = new window.THREE.BufferGeometry();
    edgesGeometry.setAttribute(
      'position',
      new window.THREE.Float32BufferAttribute(edgePositions, 3)
    );
    const edgesMaterial = new window.THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.08,
    });
    const edgeLines = new window.THREE.LineSegments(edgesGeometry, edgesMaterial);
    rootGroup.add(edgeLines);

    let controls = null;
    if (window.THREE.OrbitControls) {
      controls = new window.THREE.OrbitControls(camera, renderer.domElement);
      controls.enableZoom = false;
      controls.enablePan = false;
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.3;
    }

    function resize() {
      const width = canvas.clientWidth || window.innerWidth;
      const height = window.innerHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    let lastFrame = performance.now();
    let pulseClock = 0;

    function animate(now) {
      requestAnimationFrame(animate);
      const delta = now - lastFrame;
      if (delta < 1000 / 60) return;
      lastFrame = now;
      pulseClock += delta / 1000;

      rootGroup.rotation.y += 0.001;
      rootGroup.rotation.x += 0.0003;

      for (let i = 0; i < pulseNodes.length; i += 1) {
        const item = pulseNodes[i];
        const wave = (Math.sin((pulseClock * Math.PI) + item.phase) + 1) * 0.5;
        const scale = 1 + 0.3 * wave;
        item.mesh.scale.setScalar(scale);
      }

      for (let i = 0; i < glowNodes.length; i += 1) {
        const item = glowNodes[i];
        const wave = (Math.sin((pulseClock * 1.4 * Math.PI) + item.phase) + 1) * 0.5;
        item.mesh.scale.setScalar(1 + wave * 0.35);
        item.mesh.material.opacity = 0.18 + wave * 0.25;
      }

      if (controls) {
        controls.update();
      }

      renderer.render(scene, camera);
    }

    requestAnimationFrame(animate);
  }

  ensureThree()
    .then(createVisualization)
    .catch(() => {
      // Keep page functional if 3D assets fail.
    });
})();
