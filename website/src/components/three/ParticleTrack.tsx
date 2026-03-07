"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Float, PointMaterial, Points, PerspectiveCamera } from "@react-three/drei";
import { EffectComposer, Bloom, ChromaticAberration, Noise, Vignette } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { useControls } from "leva";

function TrackParticles({ count = 10000, speed = 0.15, scatterAmount = 1.5 }) {
  const pointsRef = useRef<THREE.Points>(null);
  
  const curve = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(-15, 0, 5),
    new THREE.Vector3(-8, 0, -8),
    new THREE.Vector3(5, 0, -10),
    new THREE.Vector3(15, 0, -2),
    new THREE.Vector3(10, 0, 8),
    new THREE.Vector3(0, 0, 10),
    new THREE.Vector3(-15, 0, 5)
  ], true), []);
  
  const [positions, phases, scatter, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const p = new Float32Array(count);
    const s = new Float32Array(count * 3); 
    const c = new Float32Array(count * 3); 
    
    for (let i = 0; i < count; i++) {
      p[i] = Math.random();
      const pointOnCurve = curve.getPoint(p[i]);
      
      const r = Math.random() * scatterAmount;
      const theta = Math.random() * 2 * Math.PI;
      const sx = r * Math.cos(theta);
      const sy = (Math.random() - 0.5) * 0.8;
      const sz = r * Math.sin(theta);
      
      s[i * 3] = sx;
      s[i * 3 + 1] = sy;
      s[i * 3 + 2] = sz;

      pos[i * 3] = pointOnCurve.x + sx;
      pos[i * 3 + 1] = pointOnCurve.y + sy;
      pos[i * 3 + 2] = pointOnCurve.z + sz;

      const rand = Math.random();
      if(rand > 0.9) {
        c[i * 3] = 1; c[i * 3 + 1] = 0.16; c[i * 3 + 2] = 0.16; 
      } else if (rand > 0.7) {
        c[i * 3] = 0.69; c[i * 3 + 1] = 0.15; c[i * 3 + 2] = 1; 
      } else {
        c[i * 3] = 0; c[i * 3 + 1] = 0.9; c[i * 3 + 2] = 1; 
      }
    }
    
    return [pos, p, s, c];
  }, [count, curve, scatterAmount]);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    
    const positionsAttribute = pointsRef.current.geometry.attributes.position;
    const array = positionsAttribute.array as Float32Array;

    for (let i = 0; i < count; i++) {
      phases[i] += delta * speed * (1 + scatter[i * 3 + 1]); 
      if (phases[i] > 1) phases[i] -= 1;
      
      const pt = curve.getPoint(phases[i]);

      array[i * 3] = pt.x + scatter[i * 3];
      array[i * 3 + 1] = pt.y + scatter[i * 3 + 1];
      array[i * 3 + 2] = pt.z + scatter[i * 3 + 2];
    }
    
    positionsAttribute.needsUpdate = true;
    pointsRef.current.rotation.y = state.clock.elapsedTime * -0.03;
    pointsRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.1) * 0.1;
  });

  return (
    <Points ref={pointsRef} positions={positions} colors={colors} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        vertexColors
        size={0.08}
        sizeAttenuation={true}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        opacity={0.8}
      />
    </Points>
  );
}

export function ParticleTrack() {
  const { particles, speed, bloom, aberration, noise } = useControls("E10 OVERRIDES", {
    particles: { value: 12000, min: 1000, max: 50000, step: 1000 },
    speed: { value: 0.2, min: 0.01, max: 1, step: 0.01 },
    bloom: { value: 2.5, min: 0, max: 10, step: 0.1 },
    aberration: { value: 0.003, min: 0, max: 0.02, step: 0.001 },
    noise: { value: 0.15, min: 0, max: 1, step: 0.01 },
  });

  return (
    <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
      <Canvas dpr={[1, 2]} gl={{ antialias: false }}>
        <PerspectiveCamera makeDefault position={[0, 15, 25]} fov={50} />
        <fog attach="fog" args={['#000', 10, 40]} />
        <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
          <TrackParticles count={particles} speed={speed} />
        </Float>
        <EffectComposer>
          <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} intensity={bloom} />
          <ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={new THREE.Vector2(aberration, aberration)} />
          <Noise opacity={noise} />
          <Vignette eskil={false} offset={0.1} darkness={1.1} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
