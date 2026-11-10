import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Sparkles, Scan, Eye, RotateCw } from 'lucide-react';

interface Interactive3DShieldProps {
  className?: string;
}

export type ShieldRenderMode = 'core' | 'scan' | 'wireframe';

export function Interactive3DShield({ className = '' }: Interactive3DShieldProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<ShieldRenderMode>('core');
  const [pulseCount, setPulseCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // References shared with Three.js animation loop
  const modeRef = useRef<ShieldRenderMode>('core');
  modeRef.current = mode;

  const triggerPulseRef = useRef<() => void>(() => {});
  const resetRotationRef = useRef<() => void>(() => {});

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Detect software WebGL per Three.js skill
    const isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    const width = container.clientWidth || 540;
    const height = container.clientHeight || 420;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2('#040914', 0.04);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 0, 8.0);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);

    // Root shield master group
    const shieldGroup = new THREE.Group();
    scene.add(shieldGroup);

    // 1. Primary Outer Metallic Shield Geometry
    const shape = new THREE.Shape();
    shape.moveTo(0, 2.3);
    shape.bezierCurveTo(1.45, 2.2, 1.95, 1.6, 1.9, 0.45);
    shape.bezierCurveTo(1.8, -0.9, 0.85, -1.95, 0, -2.5);
    shape.bezierCurveTo(-0.85, -1.95, -1.8, -0.9, -1.9, 0.45);
    shape.bezierCurveTo(-1.95, 1.6, -1.45, 2.2, 0, 2.3);

    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: 0.3,
      bevelEnabled: true,
      bevelSegments: isSoftwareGl ? 3 : 5,
      steps: 1,
      bevelSize: 0.12,
      bevelThickness: 0.14,
    };

    const shieldGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    shieldGeo.center();

    // Outer Chrome & Deep Navy Metallic Shield Material
    const shieldMat = new THREE.MeshStandardMaterial({
      color: 0x09224f,
      metalness: 0.92,
      roughness: 0.18,
      wireframe: false,
    });
    const mainShield = new THREE.Mesh(shieldGeo, shieldMat);
    shieldGroup.add(mainShield);

    // 2. Translucent Inner Glass Facet
    const innerShape = new THREE.Shape();
    innerShape.moveTo(0, 1.9);
    innerShape.bezierCurveTo(1.2, 1.8, 1.55, 1.3, 1.5, 0.38);
    innerShape.bezierCurveTo(1.4, -0.7, 0.7, -1.55, 0, -2.05);
    innerShape.bezierCurveTo(-0.7, -1.55, -1.4, -0.7, -1.5, 0.38);
    innerShape.bezierCurveTo(-1.55, 1.3, -1.2, 1.8, 0, 1.9);

    const innerExtrude: THREE.ExtrudeGeometryOptions = {
      depth: 0.18,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.06,
      bevelThickness: 0.06,
    };
    const innerGeo = new THREE.ExtrudeGeometry(innerShape, innerExtrude);
    innerGeo.center();
    const innerMat = new THREE.MeshStandardMaterial({
      color: 0x0070e0,
      metalness: 0.85,
      roughness: 0.12,
      transparent: true,
      opacity: 0.88,
    });
    const innerShield = new THREE.Mesh(innerGeo, innerMat);
    innerShield.position.z = 0.14;
    shieldGroup.add(innerShield);

    // 3. Central AI Node / Core Crystal (Octahedron with bevel)
    const coreGeo = new THREE.OctahedronGeometry(0.58, 0);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.55,
      metalness: 0.95,
      roughness: 0.1,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.z = 0.38;
    shieldGroup.add(coreMesh);

    // 4. Orbiting Cyber Torus Ring 1
    const ring1Geo = new THREE.TorusGeometry(1.7, 0.04, 12, 64);
    const ring1Mat = new THREE.MeshStandardMaterial({
      color: 0x60a5fa,
      metalness: 0.85,
      roughness: 0.2,
      transparent: true,
      opacity: 0.8,
    });
    const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
    ring1.rotation.x = Math.PI / 3.4;
    shieldGroup.add(ring1);

    // 5. Orbiting Cyber Torus Ring 2
    const ring2Geo = new THREE.TorusGeometry(2.05, 0.03, 12, 64);
    const ring2Mat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      metalness: 0.75,
      roughness: 0.25,
      transparent: true,
      opacity: 0.65,
    });
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.rotation.y = Math.PI / 4.2;
    shieldGroup.add(ring2);

    // 6. Orbital Satellite Nodes (4 defense engines)
    const satelliteGroup = new THREE.Group();
    shieldGroup.add(satelliteGroup);

    const satelliteNodes: THREE.Mesh[] = [];
    const satColors = [0x38bdf8, 0x34d399, 0x818cf8, 0x38bdf8];
    for (let i = 0; i < 4; i++) {
      const satGeo = new THREE.IcosahedronGeometry(0.12, 0);
      const satMat = new THREE.MeshStandardMaterial({
        color: satColors[i],
        emissive: satColors[i],
        emissiveIntensity: 0.6,
        metalness: 0.9,
      });
      const satMesh = new THREE.Mesh(satGeo, satMat);
      satelliteGroup.add(satMesh);
      satelliteNodes.push(satMesh);
    }

    // 7. Laser Scanner Plane (active in 'scan' mode)
    const scanPlaneGeo = new THREE.PlaneGeometry(3.6, 0.05);
    const scanPlaneMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    const scanPlane = new THREE.Mesh(scanPlaneGeo, scanPlaneMat);
    scanPlane.position.z = 0.42;
    shieldGroup.add(scanPlane);

    // 8. Expanding Shockwave Energy Ring (triggered on click)
    const pulseRingGeo = new THREE.TorusGeometry(0.2, 0.05, 8, 48);
    const pulseRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0,
    });
    const pulseRing = new THREE.Mesh(pulseRingGeo, pulseRingMat);
    pulseRing.position.z = 0.35;
    shieldGroup.add(pulseRing);

    let pulseActive = false;
    let pulseScale = 0.2;
    let pulseOpacity = 1;

    triggerPulseRef.current = () => {
      pulseActive = true;
      pulseScale = 0.3;
      pulseOpacity = 0.95;
      pulseRing.scale.set(pulseScale, pulseScale, pulseScale);
      pulseRingMat.opacity = pulseOpacity;

      // Temporary rotation speed surge
      spinImpulse = 0.8;

      // Soft cyber audio feedback via Web Audio API
      try {
        const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.14);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
      } catch {
        // Audio optional / graceful fallback
      }
    };

    // 9. Floating Ambient Cyber Sparkles
    const particleCount = isSoftwareGl ? 40 : 85;
    const particleGeo = new THREE.SphereGeometry(0.045, 6, 6);
    const particleMat = new THREE.MeshBasicMaterial({
      color: 0x93c5fd,
      transparent: true,
      opacity: 0.85,
    });
    const particles = new THREE.InstancedMesh(particleGeo, particleMat, particleCount);
    const dummy = new THREE.Object3D();
    const particleCoords: Array<{ x: number; y: number; z: number; speed: number; phase: number }> = [];

    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const rad = 2.4 + Math.random() * 2.2;
      const x = rad * Math.sin(phi) * Math.cos(theta);
      const y = rad * Math.sin(phi) * Math.sin(theta);
      const z = rad * Math.cos(phi);
      particleCoords.push({ x, y, z, speed: 0.35 + Math.random() * 0.8, phase: Math.random() * Math.PI });
      dummy.position.set(x, y, z);
      dummy.updateMatrix();
      particles.setMatrixAt(i, dummy.matrix);
    }
    particles.instanceMatrix.needsUpdate = true;
    shieldGroup.add(particles);

    // Dynamic 4-Point Studio Lighting Rig with Mouse-Follower Point Light
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
    keyLight.position.set(5, 6, 7);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x0070e0, 2.0);
    fillLight.position.set(-6, -3, 5);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 2.4);
    rimLight.position.set(0, -6, -5);
    scene.add(rimLight);

    const mouseLight = new THREE.PointLight(0x38bdf8, 3.2, 12);
    mouseLight.position.set(0, 0, 4);
    scene.add(mouseLight);

    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x020617, 1.4);
    scene.add(hemiLight);

    // Interactive pointer drag + move kinematics
    let isPointerDown = false;
    let lastPointerX = 0;
    let lastPointerY = 0;
    let dragRotX = 0;
    let dragRotY = 0;
    let targetTiltX = 0;
    let targetTiltY = 0;
    let spinImpulse = 0;

    resetRotationRef.current = () => {
      dragRotX = 0;
      dragRotY = 0;
      targetTiltX = 0;
      targetTiltY = 0;
    };

    const handlePointerDown = (e: MouseEvent) => {
      isPointerDown = true;
      setIsDragging(true);
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
    };

    const handlePointerUp = () => {
      isPointerDown = false;
      setIsDragging(false);
    };

    const handlePointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

      // Move specular point light to follow cursor
      mouseLight.position.x = nx * 3.5;
      mouseLight.position.y = ny * 3.0;

      if (isPointerDown) {
        const deltaX = e.clientX - lastPointerX;
        const deltaY = e.clientY - lastPointerY;
        dragRotY += deltaX * 0.008;
        dragRotX += deltaY * 0.008;
        lastPointerX = e.clientX;
        lastPointerY = e.clientY;
      } else {
        targetTiltY = nx * 0.45;
        targetTiltX = -ny * 0.35;
      }
    };

    const canvasElem = renderer.domElement;
    canvasElem.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('mousemove', handlePointerMove);

    // Software WebGL pacing helper
    let frameId = 0;
    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 6);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 60);
        }
      };
      frameId = window.setTimeout(poll, 6);
    }

    let currentTiltX = 0;
    let currentTiltY = 0;
    const startTime = performance.now();

    function tick() {
      const elapsed = (performance.now() - startTime) / 1000;

      // Damped spring kinematics
      currentTiltX += (targetTiltX - currentTiltX) * 0.08;
      currentTiltY += (targetTiltY - currentTiltY) * 0.08;

      // Decay impulse
      if (spinImpulse > 0.01) {
        spinImpulse *= 0.95;
      } else {
        spinImpulse = 0;
      }

      // Mode switching visual effects
      const activeMode = modeRef.current;
      if (activeMode === 'wireframe') {
        shieldMat.wireframe = true;
        shieldMat.color.setHex(0x38bdf8);
        innerMat.wireframe = true;
        scanPlaneMat.opacity = 0;
      } else if (activeMode === 'scan') {
        shieldMat.wireframe = false;
        shieldMat.color.setHex(0x061e40);
        innerMat.wireframe = false;
        // Scanning laser animation: sweeps Y between -2.2 and +2.2
        const scanY = Math.sin(elapsed * 2.5) * 2.2;
        scanPlane.position.y = scanY;
        scanPlaneMat.opacity = 0.85;
      } else {
        // Standard Core mode
        shieldMat.wireframe = false;
        shieldMat.color.setHex(0x09224f);
        innerMat.wireframe = false;
        scanPlaneMat.opacity = 0;
      }

      // Shockwave ring expansion on pulse
      if (pulseActive) {
        pulseScale += 0.09;
        pulseOpacity -= 0.022;
        if (pulseOpacity <= 0) {
          pulseActive = false;
          pulseOpacity = 0;
        }
        pulseRing.scale.set(pulseScale, pulseScale, pulseScale);
        pulseRingMat.opacity = Math.max(0, pulseOpacity);
      }

      // Composite rotation (drag + pointer tilt + ambient float + impulse)
      shieldGroup.rotation.x = dragRotX + currentTiltX + Math.sin(elapsed * 0.8) * 0.07;
      shieldGroup.rotation.y = dragRotY + currentTiltY + Math.cos(elapsed * 0.6) * 0.1 + spinImpulse;
      shieldGroup.position.y = Math.sin(elapsed * 1.3) * 0.1;

      // Sub-component continuous animations
      coreMesh.rotation.x = elapsed * 0.9;
      coreMesh.rotation.y = elapsed * 1.3;
      ring1.rotation.z = elapsed * 0.45;
      ring2.rotation.z = -elapsed * 0.38;

      // 4 Orbital Satellite Nodes moving along elliptical orbits
      for (let i = 0; i < satelliteNodes.length; i++) {
        const sat = satelliteNodes[i];
        const angle = elapsed * (0.8 + i * 0.25) + (i * Math.PI) / 2;
        const radius = 2.4 + (i % 2) * 0.4;
        sat.position.x = Math.cos(angle) * radius;
        sat.position.y = Math.sin(angle * 0.7) * 0.9;
        sat.position.z = Math.sin(angle) * radius * 0.6 + 0.3;
        sat.rotation.x = elapsed * 2;
        sat.rotation.y = elapsed * 1.5;
      }

      // Ambient floating particles
      for (let i = 0; i < particleCount; i++) {
        const p = particleCoords[i];
        const angle = elapsed * p.speed + p.phase;
        dummy.position.set(
          p.x + Math.sin(angle) * 0.25,
          p.y + Math.cos(angle * 0.8) * 0.25,
          p.z + Math.sin(angle * 0.6) * 0.2
        );
        dummy.updateMatrix();
        particles.setMatrixAt(i, dummy.matrix);
      }
      particles.instanceMatrix.needsUpdate = true;

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 540;
      const h = container.clientHeight || 420;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('mousemove', handlePointerMove);
      canvasElem.removeEventListener('mousedown', handlePointerDown);
      if (isSoftwareGl) {
        clearTimeout(frameId);
      } else {
        cancelAnimationFrame(frameId);
      }
      renderer.dispose();
      shieldGeo.dispose();
      shieldMat.dispose();
      innerGeo.dispose();
      innerMat.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      ring1Geo.dispose();
      ring1Mat.dispose();
      ring2Geo.dispose();
      ring2Mat.dispose();
      pulseRingGeo.dispose();
      pulseRingMat.dispose();
      scanPlaneGeo.dispose();
      scanPlaneMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const handleShieldClick = () => {
    setPulseCount((c) => c + 1);
    triggerPulseRef.current();
  };

  return (
    <div className={`relative w-full h-full flex flex-col justify-between ${className}`}>
      {/* Interactive 3D Canvas Box */}
      <div
        ref={mountRef}
        onClick={handleShieldClick}
        title="Click shield to emit defense pulse, or drag to rotate 360°"
        className={`w-full h-full rounded-2xl cursor-grab active:cursor-grabbing select-none relative overflow-hidden transition-all ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      />

      {/* Floating 3D Telemetry HUD Overlay */}
      <div className="absolute top-3 left-4 pointer-events-none flex items-center gap-2 text-[11px] font-mono text-slate-300/90 z-10 backdrop-blur-md px-2.5 py-1 rounded-full bg-slate-950/60 border border-white/10">
        <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse shadow-[0_0_8px_#38bdf8]" />
        <span>3D Security Core · Click to Pulse ({pulseCount}) · Drag to Orbit</span>
      </div>

      {/* Mode Controls Bar */}
      <div className="absolute bottom-3 inset-x-3 flex items-center justify-between gap-2 z-10 pointer-events-auto">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950/80 border border-white/15 backdrop-blur-xl shadow-xl">
          <button
            type="button"
            onClick={() => setMode('core')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all ${
              mode === 'core'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span>Core</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('scan')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all ${
              mode === 'scan'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <Scan className="w-3 h-3" />
            <span>Laser Scan</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('wireframe')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all ${
              mode === 'wireframe'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <Eye className="w-3 h-3" />
            <span>Wireframe</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => resetRotationRef.current()}
          title="Reset 3D camera rotation"
          className="p-1.5 rounded-xl bg-slate-950/80 hover:bg-white/10 border border-white/15 text-slate-300 hover:text-white backdrop-blur-xl transition-all shadow-xl"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
