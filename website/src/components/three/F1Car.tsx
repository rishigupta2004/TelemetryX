"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useRef, useMemo, useEffect, useState } from "react";
import * as THREE from "three";
import { OrbitControls, Environment, ContactShadows, Float } from "@react-three/drei";
import { EffectComposer, Bloom, ChromaticAberration, DepthOfField } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Procedural wireframe F1 Car concept (since we don't have an external GLTF asset yet)
function WireframeCar({ scrollProgress, prefersReducedMotion = false }: { scrollProgress: number; prefersReducedMotion?: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
    
  useFrame((state) => {
    if(!groupRef.current) return;
    // Simulate slight suspension vibration (disabled for reduced motion)
    if (!prefersReducedMotion) {
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 20) * 0.02 + 0.5;
    }
  });

  const wireframeMaterial = useMemo(() => new THREE.MeshStandardMaterial({ 
    color: "#00e5ff", 
    wireframe: true, 
    emissive: "#00e5ff", 
    emissiveIntensity: 2,
    transparent: true,
    opacity: 0.8
  }), []);

  const tireMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#111",
    roughness: 0.9,
    metalness: 0.1
  }), []);

  const redTireRing = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ff2a2a" }), []);

  // Update wireframe opacity based on scroll progress
  useFrame(() => {
    if (wireframeMaterial) {
      // Fade out wireframe as we scroll down (more visible at top)
      wireframeMaterial.opacity = 0.8 * (1 - scrollProgress);
    }
  });

  return (
    <group ref={groupRef} scale={1.5}>
      {/* Chassis / Monocoque */}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.3, 0.5, 4, 8]} />
        <meshStandardMaterial color="#050505" roughness={0.2} metalness={0.9} />
      </mesh>

      {/* Wireframe overlay for tech-vibe */}
      <mesh position={[0, 0.21, 0]}>
        <cylinderGeometry args={[0.31, 0.51, 4, 8]} />
        <primitive object={wireframeMaterial} />
      </mesh>

      {/* Front Wing */}
      <mesh position={[0, 0, -1.8]}>
        <boxGeometry args={[1.8, 0.1, 0.4]} />
        <meshStandardMaterial color="#111" metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* Rear Wing */}
      <mesh position={[0, 0.5, 1.8]}>
        <boxGeometry args={[1.5, 0.1, 0.5]} />
        <meshStandardMaterial color="#111" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Halo */}
      <mesh position={[0, 0.7, -0.2]} rotation={[0.2, 0, 0]}>
        <torusGeometry args={[0.4, 0.05, 8, 24, Math.PI]} />
        <meshStandardMaterial color="#222" metalness={0.8} />
      </mesh>

      {/* Tires */}
      {/* Front Left */}
      <group position={[-0.9, 0.2, -1.2]} rotation={[0, 0, Math.PI / 2]}>
        <mesh material={tireMaterial}>
          <cylinderGeometry args={[0.35, 0.35, 0.3, 32]} />
        </mesh>
        <mesh material={redTireRing} position={[0, 0.16, 0]}>
          <ringGeometry args={[0.25, 0.28, 32]} />
        </mesh>
      </group>

      {/* Front Right */}
      <group position={[0.9, 0.2, -1.2]} rotation={[0, 0, Math.PI / 2]}>
        <mesh material={tireMaterial}>
          <cylinderGeometry args={[0.35, 0.35, 0.3, 32]} />
        </mesh>
        <mesh material={redTireRing} position={[0, -0.16, 0]}>
          <ringGeometry args={[0.25, 0.28, 32]} />
        </mesh>
      </group>

      {/* Rear Left */}
      <group position={[-0.9, 0.2, 1.5]} rotation={[0, 0, Math.PI / 2]}>
        <mesh material={tireMaterial}>
          <cylinderGeometry args={[0.4, 0.4, 0.4, 32]} />
        </mesh>
        <mesh material={redTireRing} position={[0, 0.21, 0]}>
          <ringGeometry args={[0.3, 0.33, 32]} />
        </mesh>
      </group>

      {/* Rear Right */}
      <group position={[0.9, 0.2, 1.5]} rotation={[0, 0, Math.PI / 2]}>
        <mesh material={tireMaterial}>
          <cylinderGeometry args={[0.4, 0.4, 0.4, 32]} />
        </mesh>
        <mesh material={redTireRing} position={[0, -0.21, 0]}>
          <ringGeometry args={[0.3, 0.33, 32]} />
        </mesh>
      </group>
    </group>
  );
}

function WindTunnelLines({ prefersReducedMotion = false }: { prefersReducedMotion?: boolean }) {
  const linesRef = useRef<THREE.Group>(null);
   
  useFrame((state, delta) => {
    if(!linesRef.current) return;
    // Skip animation for reduced motion
    if (prefersReducedMotion) return;
    
    linesRef.current.children.forEach(child => {
      child.position.z += delta * 20; // Move lines backward fast
      if (child.position.z > 5) {
        child.position.z = -15; // reset to front
      }
    });
  });

  return (
    <group ref={linesRef}>
      {[...Array(60)].map((_, i) => (
        <mesh 
          key={i} 
          position={[
            (Math.random() - 0.5) * 6, 
            Math.random() * 3, 
            (Math.random() - 0.5) * 20
          ]}
        >
          <boxGeometry args={[0.02, 0.02, Math.random() * 4 + 1]} />
          <meshBasicMaterial color="#00e5ff" transparent opacity={0.4} />
        </mesh>
      ))}
    </group>
  );
}

function CameraRig({ scrollProgress }: { scrollProgress: number }) {
  const { camera } = useThree();

  useFrame(() => {
    camera.position.y = 3 + scrollProgress * 4;
    camera.position.z = -6 - scrollProgress * 3;
    camera.position.x = 5 + Math.sin(scrollProgress * Math.PI) * 1;
  });

  return null;
}

export function F1CarModel({ className }: { className?: string }) {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Create a ScrollTrigger that updates scrollProgress from 0 to 1
    const scrollTrigger = ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: (self) => {
        setScrollProgress(self.progress);
      }
    });
    
    return () => {
      scrollTrigger.kill();
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);
    updatePreference();

    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  return (
    <div className={`absolute inset-0 z-0 bg-[#020202] ${className || ''}`}>
      <Canvas dpr={[1, 2]} camera={{ position: [5, 3, -6], fov: 45 }}>
        <CameraRig scrollProgress={scrollProgress} />
        <fog attach="fog" args={['#020202', 5, 15]} />
        <ambientLight intensity={1} />
        <directionalLight position={[10, 10, 5]} intensity={2} color="#ffffff" />
        <spotLight position={[0, 10, 0]} intensity={50} angle={0.6} penumbra={1} color="#00e5ff" castShadow />
        
        {!prefersReducedMotion && (
          <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.2}>
            <WireframeCar scrollProgress={scrollProgress} prefersReducedMotion={prefersReducedMotion} />
          </Float>
        )}
        
        {prefersReducedMotion && (
          <WireframeCar scrollProgress={scrollProgress} prefersReducedMotion={prefersReducedMotion} />
        )}
        
        <WindTunnelLines prefersReducedMotion={prefersReducedMotion} />
        
        <ContactShadows position={[0, -0.1, 0]} opacity={0.8} scale={10} blur={2} far={4} color="#000" />
        
        <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={-1} maxPolarAngle={Math.PI / 2 - 0.1} />
        
        <EffectComposer>
          <Bloom luminanceThreshold={0.5} luminanceSmoothing={0.9} intensity={2} />
          <ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={new THREE.Vector2(0.002, 0.002)} />
          <DepthOfField focusDistance={0} focalLength={0.02} bokehScale={2} height={480} />
        </EffectComposer>
      </Canvas>
      <div className="absolute inset-0 bg-dot-grid opacity-20 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,#000_100%)] pointer-events-none" />
    </div>
  );
}
