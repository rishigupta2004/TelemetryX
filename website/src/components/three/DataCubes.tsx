"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useMemo } from "react";
import * as THREE from "three";
import { EffectComposer, Bloom } from "@react-three/postprocessing";

const COUNT = 1500;

function InstancedCubes() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Store original positions, target position (center funnel), and speed
  const particles = useMemo(() => {
    const arr = [];
    for (let i = 0; i < COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const radius = 10 + Math.random() * 20;
      const height = (Math.random() - 0.5) * 40;
      
      arr.push({
        x: Math.cos(theta) * radius,
        y: height + 30, // Start high
        z: Math.sin(theta) * radius,
        speed: 0.1 + Math.random() * 0.3,
        rotSpeed: Math.random() * 0.1,
        delay: Math.random() * 10,
        color: new THREE.Color().setHSL(0.5 + Math.random() * 0.1, 0.8, 0.5) // Blue-ish
      });
    }
    return arr;
  }, []);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    
    const time = state.clock.elapsedTime;

    particles.forEach((p, i) => {
      if (time < p.delay) return; // wait to drop

      // Fall down to funnel
      p.y -= p.speed * delta * 50;

      // Pull into center (funnel effect)
      if (p.y < 10) {
        p.x *= 0.95;
        p.z *= 0.95;
      }

      // Reset when they hit bottom
      if (p.y < -10) {
        const theta = Math.random() * Math.PI * 2;
        const radius = 10 + Math.random() * 20;
        p.x = Math.cos(theta) * radius;
        p.y = 30 + Math.random() * 20;
        p.z = Math.sin(theta) * radius;
        p.delay = time + Math.random() * 2; // delay next drop
      }

      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.x += p.rotSpeed;
      dummy.rotation.y += p.rotSpeed;
      dummy.updateMatrix();
      
      meshRef.current!.setMatrixAt(i, dummy.matrix);
      meshRef.current!.setColorAt(i, p.color);
    });
    
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[null as any, null as any, COUNT]} castShadow receiveShadow>
      <boxGeometry args={[0.3, 0.3, 0.3]} />
      <meshStandardMaterial roughness={0.2} metalness={0.8} />
    </instancedMesh>
  );
}

export function DataCubes() {
  return (
    <div className="absolute inset-0 z-0 bg-black">
      <Canvas dpr={[1, 2]} camera={{ position: [0, 5, 25], fov: 60 }}>
        <fog attach="fog" args={['#000', 10, 50]} />
        <ambientLight intensity={0.5} />
        <spotLight position={[0, 20, 0]} intensity={5} color="#00e5ff" penumbra={1} castShadow />
        <pointLight position={[0, -5, 0]} intensity={10} color="#ff2a2a" distance={20} />
        
        <InstancedCubes />
        
        {/* The DuckDB "Core" funnel */}
        <mesh position={[0, -5, 0]}>
          <cylinderGeometry args={[2, 0.5, 10, 32]} />
          <meshStandardMaterial color="#ff2a2a" emissive="#ff2a2a" emissiveIntensity={0.5} wireframe />
        </mesh>
        
        <EffectComposer>
          <Bloom luminanceThreshold={0.5} intensity={2.5} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
