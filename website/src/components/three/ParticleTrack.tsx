"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Float, PointMaterial, Points, PerspectiveCamera } from "@react-three/drei";

function TrackParticles({ count = 3000 }) {
  const pointsRef = useRef<THREE.Points>(null);
  
  // Curve defining track shape
  const curve = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(-15, 0, 5),
    new THREE.Vector3(-8, 0, -8),
    new THREE.Vector3(5, 0, -10),
    new THREE.Vector3(15, 0, -2),
    new THREE.Vector3(10, 0, 8),
    new THREE.Vector3(0, 0, 10),
    new THREE.Vector3(-15, 0, 5)
  ], true), []);
  
  // Initialize particles
  const [positions, phases, scatter] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const p = new Float32Array(count);
    const s = new Float32Array(count * 3); // scatter per particle
    
    for (let i = 0; i < count; i++) {
      p[i] = Math.random();
      
      const pointOnCurve = curve.getPoint(p[i]);
      
      // Calculate random offset (tubular shape)
      const r = Math.random() * 1.5;
      const theta = Math.random() * 2 * Math.PI;
      const sx = r * Math.cos(theta);
      const sy = (Math.random() - 0.5) * 0.5; // flatten y
      const sz = r * Math.sin(theta);
      
      s[i * 3] = sx;
      s[i * 3 + 1] = sy;
      s[i * 3 + 2] = sz;

      pos[i * 3] = pointOnCurve.x + sx;
      pos[i * 3 + 1] = pointOnCurve.y + sy;
      pos[i * 3 + 2] = pointOnCurve.z + sz;
    }
    
    return [pos, p, s];
  }, [count, curve]);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    
    const positionsAttribute = pointsRef.current.geometry.attributes.position;
    const array = positionsAttribute.array as Float32Array;

    for (let i = 0; i < count; i++) {
      // Speed variation based on their offset
      phases[i] += delta * 0.1 * (1 + scatter[i * 3 + 1]); 
      if (phases[i] > 1) phases[i] -= 1;
      
      const pt = curve.getPoint(phases[i]);

      array[i * 3] = pt.x + scatter[i * 3];
      array[i * 3 + 1] = pt.y + scatter[i * 3 + 1];
      array[i * 3 + 2] = pt.z + scatter[i * 3 + 2];
    }
    
    positionsAttribute.needsUpdate = true;
    pointsRef.current.rotation.y = state.clock.elapsedTime * -0.05;
  });

  return (
    <Points ref={pointsRef} positions={positions} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color="#00e5ff"
        size={0.06}
        sizeAttenuation={true}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        opacity={0.6}
      />
    </Points>
  );
}

export function ParticleTrack() {
  return (
    <div className="absolute inset-0 pointer-events-none z-0">
      <Canvas dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[0, 10, 20]} fov={50} />
        <fog attach="fog" args={['#000', 10, 30]} />
        <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
          <TrackParticles count={5000} />
        </Float>
      </Canvas>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,#000_100%)] pointer-events-none z-10" />
    </div>
  );
}
