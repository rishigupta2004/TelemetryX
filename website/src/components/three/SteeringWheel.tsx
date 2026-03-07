"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useState, useEffect } from "react";
import * as THREE from "three";
import { Html, Float, ContactShadows, PerspectiveCamera, Environment } from "@react-three/drei";
import { EffectComposer, Bloom, ChromaticAberration, Noise } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";

function RpmLeds({ rpm }: { rpm: number }) {
  // 15 LEDs: 5 Green, 5 Red, 5 Blue
  return (
    <group position={[0, 0.9, 0.2]}>
      {[...Array(15)].map((_, i) => {
        const threshold = (i / 14) * 13000; // max 13000 rpm
        const isActive = rpm > threshold;
        let color = "#00ff00"; // Green
        if (i >= 5) color = "#ff0000"; // Red
        if (i >= 10) color = "#0055ff"; // Blue

        return (
          <mesh key={i} position={[(i - 7) * 0.12, 0, 0]}>
            <boxGeometry args={[0.08, 0.04, 0.02]} />
            <meshStandardMaterial 
              color={isActive ? color : "#111"} 
              emissive={isActive ? color : "#000"} 
              emissiveIntensity={isActive ? 2 : 0} 
            />
          </mesh>
        );
      })}
    </group>
  );
}

function WheelModel() {
  const wheelRef = useRef<THREE.Group>(null);
  const [rpm, setRpm] = useState(4000);
  const [speed, setSpeed] = useState(120);
  const [gear, setGear] = useState(3);
  const [ers, setErs] = useState(85);

  useEffect(() => {
    const interval = setInterval(() => {
      setRpm(prev => {
        const newRpm = prev + (Math.random() * 1000 + 500);
        if (newRpm > 13000) {
          setGear(g => Math.min(8, g + 1));
          return 7000; // shift up drop
        }
        return newRpm;
      });
      setSpeed(prev => Math.min(350, prev + Math.random() * 5));
      setErs(prev => Math.max(0, prev - 0.5)); // Drain ERS
    }, 100);
    return () => clearInterval(interval);
  }, []);

  useFrame((state) => {
    if (!wheelRef.current) return;
    // Follow mouse for steering effect
    const targetX = (state.pointer.x * Math.PI) / 4; // Max 45 degree steer
    wheelRef.current.rotation.z = THREE.MathUtils.lerp(wheelRef.current.rotation.z, -targetX, 0.1);
    
    // Simulate aggressive vibration based on RPM
    const vibration = (rpm / 13000) * 0.02;
    wheelRef.current.position.x = (Math.random() - 0.5) * vibration;
    wheelRef.current.position.y = (Math.random() - 0.5) * vibration;
  });

  return (
    <group ref={wheelRef}>
      {/* Central Hub (Carbon Fiber look) */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[2.2, 1.6, 0.3]} />
        <meshStandardMaterial color="#111" roughness={0.8} metalness={0.5} />
      </mesh>

      {/* Handles */}
      <mesh position={[-1.2, 0, 0.1]} rotation={[0, 0, 0.2]}>
        <cylinderGeometry args={[0.15, 0.15, 1.4, 16]} />
        <meshStandardMaterial color="#050505" roughness={0.9} />
      </mesh>
      <mesh position={[1.2, 0, 0.1]} rotation={[0, 0, -0.2]}>
        <cylinderGeometry args={[0.15, 0.15, 1.4, 16]} />
        <meshStandardMaterial color="#050505" roughness={0.9} />
      </mesh>

      {/* Buttons & Dials */}
      <mesh position={[-0.8, 0.4, 0.2]}>
        <cylinderGeometry args={[0.08, 0.08, 0.05, 16]} />
        <meshStandardMaterial color="var(--telemetry-green)" />
      </mesh>
      <mesh position={[0.8, 0.4, 0.2]}>
        <cylinderGeometry args={[0.08, 0.08, 0.05, 16]} />
        <meshStandardMaterial color="var(--telemetry-red)" />
      </mesh>
      <mesh position={[-0.8, -0.4, 0.2]}>
        <cylinderGeometry args={[0.1, 0.1, 0.05, 16]} />
        <meshStandardMaterial color="var(--telemetry-blue)" />
      </mesh>
      <mesh position={[0.8, -0.4, 0.2]}>
        <cylinderGeometry args={[0.1, 0.1, 0.05, 16]} />
        <meshStandardMaterial color="var(--telemetry-yellow)" />
      </mesh>

      <RpmLeds rpm={rpm} />

      {/* Embedded LCD Screen */}
      <Html transform position={[0, 0, 0.16]} scale={0.1} occlude="blending">
        <div className="w-[1200px] h-[600px] bg-black border-4 border-zinc-800 rounded-lg p-6 font-mono flex flex-col justify-between shadow-[0_0_50px_rgba(0,229,255,0.2)_inset]">
          
          <div className="flex justify-between text-zinc-500 text-3xl font-bold uppercase tracking-widest border-b-2 border-zinc-800 pb-4">
            <span>STRAT <span className="text-[var(--telemetry-blue)]">MODE 4</span></span>
            <span className="text-[var(--telemetry-red)] animate-pulse">REC</span>
            <span>BAL <span className="text-white">56.0</span></span>
          </div>

          <div className="flex items-center justify-between px-10">
            <div className="text-center">
              <div className="text-[120px] font-black text-white leading-none">{Math.floor(speed)}</div>
              <div className="text-4xl text-zinc-500 mt-2">KPH</div>
            </div>

            <div className="text-center bg-zinc-900 border-4 border-zinc-700 px-12 py-6 rounded-2xl">
              <div className="text-[180px] font-black text-[var(--telemetry-green)] leading-none drop-shadow-[0_0_20px_rgba(0,255,0,0.8)]">{gear}</div>
              <div className="text-3xl text-zinc-400 mt-2">GEAR</div>
            </div>

            <div className="text-center">
              <div className="text-[80px] font-black text-[var(--telemetry-purple)] leading-none">{rpm.toFixed(0)}</div>
              <div className="text-4xl text-zinc-500 mt-2">RPM</div>
            </div>
          </div>

          <div className="flex justify-between items-end border-t-2 border-zinc-800 pt-6">
             <div className="w-1/3">
               <div className="text-2xl text-zinc-500 mb-2">MGU-K DEPLOY</div>
               <div className="h-6 bg-zinc-900 w-full border border-zinc-700">
                 <div className="h-full bg-[var(--telemetry-yellow)] transition-all duration-75" style={{ width: `${ers}%` }} />
               </div>
             </div>
             
             <div className="text-5xl font-black text-white">
               Δ <span className="text-[var(--telemetry-red)]">+0.142</span>
             </div>
          </div>

        </div>
      </Html>
    </group>
  );
}

export function SteeringWheel() {
  return (
    <div className="absolute inset-0 z-0 bg-[#020202] overflow-hidden cursor-crosshair">
      <Canvas dpr={[1, 2]} camera={{ position: [0, 1.5, 4], fov: 50 }}>
        <fog attach="fog" args={['#020202', 2, 10]} />
        <ambientLight intensity={0.5} />
        <spotLight position={[0, 5, 0]} intensity={10} color="#ffffff" angle={0.5} penumbra={1} castShadow />
        <spotLight position={[0, -2, 5]} intensity={20} color="#00e5ff" angle={0.8} penumbra={1} />
        
        <Float speed={2} rotationIntensity={0.05} floatIntensity={0.05}>
          <WheelModel />
        </Float>

        <Environment preset="city" />
        
        <EffectComposer>
          <Bloom luminanceThreshold={0.4} luminanceSmoothing={0.9} intensity={1.5} />
          <ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={new THREE.Vector2(0.003, 0.003)} />
          <Noise opacity={0.2} />
        </EffectComposer>
      </Canvas>
      
      {/* HUD Overlays */}
      <div className="absolute top-6 left-6 font-mono text-[10px] text-[var(--telemetry-blue)] uppercase tracking-widest bg-black/80 px-3 py-1.5 border border-[var(--telemetry-blue)]/50 panel-border backdrop-blur-md">
        DRIVER_EYE_VIEW // SIMULATION_ACTIVE
      </div>
      <div className="absolute bottom-6 right-6 font-mono text-[10px] text-zinc-500 uppercase tracking-widest text-right">
        [MOVE MOUSE TO STEER]<br/>
        <span className="text-[var(--telemetry-green)]">1000HZ TELEMETRY LINK</span>
      </div>
      
      <div className="absolute inset-0 bg-dot-grid opacity-10 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,#000_100%)] pointer-events-none" />
    </div>
  );
}
