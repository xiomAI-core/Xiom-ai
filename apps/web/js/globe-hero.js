/**
 * XIOM Hero Globe — matches launch app WorldModelSphereInner
 */
(function () {
  'use strict';

  function initGlobe() {
    const container = document.getElementById('hero-globe');
    if (!container || !window.THREE) return;

    const THREE = window.THREE;
    const width = container.clientWidth || 400;
    const height = container.clientHeight || 320;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
    camera.position.z = 2.5;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const NODE_COUNT = 200;
    const SPHERE_RADIUS = 1.0;
    const nodePositions = [];
    const nodeVerts = [];

    for (let i = 0; i < NODE_COUNT; i += 1) {
      const theta = Math.acos(2 * Math.random() - 1);
      const phi = 2 * Math.PI * Math.random();
      const x = SPHERE_RADIUS * Math.sin(theta) * Math.cos(phi);
      const y = SPHERE_RADIUS * Math.sin(theta) * Math.sin(phi);
      const z = SPHERE_RADIUS * Math.cos(theta);
      nodePositions.push(new THREE.Vector3(x, y, z));
      nodeVerts.push(x, y, z);
    }

    const nodeGeo = new THREE.BufferGeometry();
    nodeGeo.setAttribute('position', new THREE.Float32BufferAttribute(nodeVerts, 3));
    const nodeMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.018,
      transparent: true,
      opacity: 0.7,
    });
    const nodes = new THREE.Points(nodeGeo, nodeMat);
    scene.add(nodes);

    const linePositions = [];
    const CONNECTION_DIST = 0.4;
    for (let i = 0; i < NODE_COUNT; i += 1) {
      for (let j = i + 1; j < NODE_COUNT; j += 1) {
        const pi = nodePositions[i];
        const pj = nodePositions[j];
        if (pi && pj && pi.distanceTo(pj) < CONNECTION_DIST) {
          linePositions.push(pi.x, pi.y, pi.z, pj.x, pj.y, pj.z);
        }
      }
    }

    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.18,
    });
    const lines = new THREE.LineSegments(lineGeo, lineMat);
    scene.add(lines);

    const sphereGeo = new THREE.SphereGeometry(SPHERE_RADIUS, 24, 16);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
      transparent: true,
      opacity: 0.04,
    });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    scene.add(sphere);

    let frameId = 0;
    let tick = 0;
    const group = [nodes, lines, sphere];

    function animate() {
      frameId = requestAnimationFrame(animate);
      tick += 0.002;
      group.forEach((obj) => {
        obj.rotation.y = tick;
        obj.rotation.x = Math.sin(tick * 0.3) * 0.15;
      });
      nodeMat.opacity = 0.6 + 0.15 * Math.sin(tick * 2);
      renderer.render(scene, camera);
    }
    animate();

    function resize() {
      const w = container.clientWidth || width;
      const h = container.clientHeight || height;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(resize);
      ro.observe(container);
    } else {
      window.addEventListener('resize', resize, { passive: true });
    }
    resize();

    return function cleanup() {
      cancelAnimationFrame(frameId);
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }

  function boot() {
    if (!window.THREE) return;
    initGlobe();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
