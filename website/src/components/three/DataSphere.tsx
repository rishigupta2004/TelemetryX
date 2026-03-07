"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom, Noise } from "@react-three/postprocessing";

function SpherePoints({ count = 20000 }) {
  const pointsRef = useRef<THREE.Points>(null);
  
  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      // Golden ratio spiraling for an even sphere distribution
      const phi = Math.acos(1 - 2 * (i + 0.5) / count);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      
      const r = 5 + (Math.random() - 0.5) * 0.5; // slight noise on surface
      
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);

      // Tire wear colors (Red to Green to Blue)
      const wear = Math.random();
      if(wear > 0.8) {
         col[i * 3] = 1; col[i * 3 + 1] = 0.1; col[i * 3 + 2] = 0.1; // Red
      } else if(wear > 0.4) {
         col[i * 3] = 0.8; col[i * 3 + 1] = 0.8; col[i * 3 + 2] = 0; // Yellow
      } else {
         col[i * 3] = 0; col[i * 3 + 1] = 1; col[i * 3 + 2] = 0; // Green
      }
    }
    
    return [pos, col];
  }, [count]);

  useFrame((state) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.y = state.clock.elapsedTime * 0.1;
    pointsRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.05) * 0.2;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" count={count} array={colors} itemSize={3} args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial 
        size={0.03} 
        vertexColors 
        transparent 
        opacity={0.8} 
        sizeAttenuation 
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

export function DataSphere() {
  return (
    <div className="absolute inset-0 z-0 bg-[#050505]">
      <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 12], fov: 45 }}>
        <fog attach="fog" args={['#050505', 10, 20]} />
        <SpherePoints />
        <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.5} />
        <EffectComposer>
          <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} intensity={2} />
          <Noise opacity={0.15} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
