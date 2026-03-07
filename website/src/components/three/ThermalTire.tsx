"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls, Environment } from "@react-three/drei";
import { EffectComposer, Bloom, Noise } from "@react-three/postprocessing";
import { useControls } from "leva";

function TireMesh() {
  const tireRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  const { tireTemp, wearLevel, spinSpeed } = useControls("TIRE DYNAMICS", {
    tireTemp: { value: 110, min: 60, max: 150, step: 1 },
    wearLevel: { value: 45, min: 0, max: 100, step: 1 },
    spinSpeed: { value: 15, min: 0, max: 50, step: 1 }
  });

  useFrame((state, delta) => {
    if (tireRef.current) {
      tireRef.current.rotation.x -= spinSpeed * delta;
    }
    
    if (materialRef.current) {
      // Calculate emissive color based on temp (60 = cold/black, 150 = blistering hot/orange-red)
      const heatRatio = Math.max(0, (tireTemp - 80) / 70);
      const color = new THREE.Color();
      
      if (heatRatio < 0.3) {
        color.setHex(0x000000); // cold
      } else if (heatRatio < 0.7) {
        color.lerpColors(new THREE.Color(0x000000), new THREE.Color(0xff2a2a), (heatRatio - 0.3) / 0.4); // heating up to red
      } else {
        color.lerpColors(new THREE.Color(0xff2a2a), new THREE.Color(0xffaa00), (heatRatio - 0.7) / 0.3); // red to yellow/orange blister
      }
      
      materialRef.current.emissive = color;
      materialRef.current.emissiveIntensity = heatRatio * 4;
      
      // Affect roughness/metalness based on wear
      materialRef.current.roughness = 0.5 + (wearLevel / 100) * 0.5; // smoother when worn
    }
  });

  return (
    <group ref={tireRef}>
      {/* Main Tire Carcass */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[2, 2, 1.8, 64]} />
        <meshStandardMaterial 
          ref={materialRef}
          color="#111" 
          roughness={0.9} 
          metalness={0.1}
          emissive="#000"
        />
      </mesh>

      {/* Sidewall compound stripes (Soft Red) */}
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0.91, 0, 0]}>
        <ringGeometry args={[1.5, 1.7, 64]} />
        <meshBasicMaterial color="#ff2a2a" side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]} position={[-0.91, 0, 0]}>
        <ringGeometry args={[1.5, 1.7, 64]} />
        <meshBasicMaterial color="#ff2a2a" side={THREE.DoubleSide} />
      </mesh>
      
      {/* Rim/Hub */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[1.1, 1.1, 1.9, 32]} />
        <meshStandardMaterial color="#050505" roughness={0.3} metalness={0.8} />
      </mesh>
    </group>
  );
}

export function ThermalTire() {
  return (
    <div className="absolute inset-0 z-0 bg-[#000]">
      <Canvas dpr={[1, 2]} camera={{ position: [4, 3, 5], fov: 45 }}>
        <fog attach="fog" args={['#000', 5, 15]} />
        <ambientLight intensity={0.2} />
        <spotLight position={[5, 5, 5]} intensity={5} color="#ffffff" angle={0.5} penumbra={1} />
        
        <TireMesh />

        <Environment preset="city" />
        <OrbitControls enablePan={false} autoRotate autoRotateSpeed={0.5} />
        
        <EffectComposer>
          <Bloom luminanceThreshold={0.4} luminanceSmoothing={0.9} intensity={2.5} />
          <Noise opacity={0.15} />
        </EffectComposer>
      </Canvas>
      <div className="absolute inset-0 bg-dot-grid opacity-20 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,#000_100%)] pointer-events-none" />
    </div>
  );
}
