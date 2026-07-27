"use client";
import { useRef, useState, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import * as THREE from "three";

const pillars = [
  { x: -1.3, z: -0.7, h: 0.87 }, // Front Left
  { x: -0.3, z: -0.7, h: 0.87 }, // Front Center

  { x: -1.3, z: 0.7, h: 0.35 }, // Back Left
  { x: -0.3, z: 0.7, h: 0.35 }, // Back Center
];

function MainHouse() {
  return (
    <group position={[0, 0, 0]}>
      {/* Foundation Base */}
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[4.1, 0.3, 3.3]} />
        <meshStandardMaterial color="#64748B" roughness={0.7} />
      </mesh>

      {/* Main Concrete Walls */}
      <mesh position={[0, 1.15, 0]}>
        <boxGeometry args={[4.0, 1.7, 3.2]} />
        <meshStandardMaterial color="#E2E8F0" roughness={0.65} />
      </mesh>

      {/* Flat roof coping overhang */}
      <mesh position={[0, 2.05, 0]}>
        <boxGeometry args={[4.3, 0.12, 3.5]} />
        <meshStandardMaterial color="#CBD5E1" roughness={0.6} />
      </mesh>

      {/* Porch Visor Roof */}
      <mesh position={[0.2, 1.72, 1.68]}>
        <boxGeometry args={[1.5, 0.08, 0.5]} />
        <meshStandardMaterial color="#CBD5E1" roughness={0.6} />
      </mesh>

      {/* Front Entrance Wooden Door */}
      <group position={[0.1, 0.85, 1.61]}>
        <mesh>
          <boxGeometry args={[0.65, 1.25, 0.04]} />
          <meshStandardMaterial color="#3F2314" roughness={0.5} />
        </mesh>
        <mesh position={[-0.24, 0, 0.03]}>
          <boxGeometry args={[0.03, 0.25, 0.04]} />
          <meshStandardMaterial color="#E2E8F0" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>

      {/* Concrete Entrance Steps */}
      <group position={[0.1, 0.15, 1.95]}>
        <mesh position={[0, -0.05, 0]}>
          <boxGeometry args={[1.1, 0.1, 0.6]} />
          <meshStandardMaterial color="#94A3B8" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.03, -0.08]}>
          <boxGeometry args={[0.95, 0.1, 0.44]} />
          <meshStandardMaterial color="#A0AEC0" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.11, -0.16]}>
          <boxGeometry args={[0.8, 0.1, 0.28]} />
          <meshStandardMaterial color="#CBD5E1" roughness={0.7} />
        </mesh>
      </group>

      {/* Main Front Window */}
      <group position={[-1.1, 1.05, 1.61]}>
        <mesh>
          <boxGeometry args={[1.1, 0.95, 0.05]} />
          <meshStandardMaterial color="#1E293B" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, 0.02]}>
          <boxGeometry args={[0.98, 0.83, 0.02]} />
          <meshStandardMaterial color="#38BDF8" metalness={0.3} roughness={0.1} transparent opacity={0.55} />
        </mesh>
        <mesh position={[0, 0, 0.03]}>
          <boxGeometry args={[0.03, 0.83, 0.02]} />
          <meshStandardMaterial color="#1E293B" roughness={0.4} />
        </mesh>
      </group>

      {/* Side Window */}
      <group position={[2.01, 1.1, 0.4]} rotation={[0, Math.PI / 2, 0]}>
        <mesh position={[0, 0.58, 0.15]}>
          <boxGeometry args={[0.9, 0.06, 0.35]} />
          <meshStandardMaterial color="#CBD5E1" roughness={0.6} />
        </mesh>
        <mesh>
          <boxGeometry args={[0.75, 0.75, 0.05]} />
          <meshStandardMaterial color="#1E293B" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, 0.02]}>
          <boxGeometry args={[0.65, 0.65, 0.02]} />
          <meshStandardMaterial color="#38BDF8" metalness={0.3} roughness={0.1} transparent opacity={0.55} />
        </mesh>
      </group>

      {/* Rooftop Stairhouse */}
      <group position={[1.1, 2.45, -0.6]}>
        <mesh>
          <boxGeometry args={[1.4, 0.7, 1.5]} />
          <meshStandardMaterial color="#E2E8F0" roughness={0.65} />
        </mesh>
        <mesh position={[0, 0.38, 0]}>
          <boxGeometry args={[1.5, 0.06, 1.6]} />
          <meshStandardMaterial color="#CBD5E1" roughness={0.6} />
        </mesh>
        <mesh position={[0.71, 0.05, 0.2]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[0.4, 0.28, 0.02]} />
          <meshStandardMaterial color="#334155" roughness={0.8} />
        </mesh>
      </group>
    </group>
  );
}

function ElevatedSolarRack() {
  return (
    <group position={[-0.1, 2.1, -0.1]}>
      {/* 6 Vertical Pillars */}
      {pillars.map((p, i) => (
        <group key={i} position={[p.x, 0.25, p.z]}>
          <mesh position={[0, -0.2, 0]}>
            <boxGeometry args={[0.2, 0.1, 0.2]} />
            <meshStandardMaterial color="#64748B" />
          </mesh>

          <mesh position={[0, p.h / 2 - 0.2, 0]}>
            <cylinderGeometry args={[0.035, 0.035, p.h, 8]} />
            <meshStandardMaterial color="#94A3B8" />
          </mesh>
        </group>
      ))}

      {/* Tilted Solar Panel Mounting Frame */}
      <group position={[0.10, 0.65, 0]} rotation={[0.33, -3.15, 0]}>

        {/* 4x2 Solar Panels */}
        {[0.35, 1, 0.45, 1.45].map((px, col) => (
          <group key={`col${col}`} position={[px, 0, 0]}>
            {[-0.46, 0.46].map((pz, row) => (
              <group key={`panel${row}`} position={[0, 0.02, pz]}>
                <mesh>
                  <boxGeometry args={[0.84, 0.03, 0.88]} />
                  <meshStandardMaterial color="#CBD5E1" metalness={0.9} roughness={0.2} />
                </mesh>

                <mesh position={[0, 0.016, 0]}>
                  <boxGeometry args={[0.8, 0.005, 0.84]} />
                  <meshStandardMaterial color="#004CBD" metalness={0.75} roughness={0.15} />
                </mesh>

                {[-0.26, 0, 0.26].map((gz, k) => (
                  <mesh key={`hz${k}`} position={[0, 0.02, gz]}>
                    <boxGeometry args={[0.78, 0.002, 0.005]} />
                    <meshStandardMaterial color="#0091FF" metalness={0.8} roughness={0.3} />
                  </mesh>
                ))}
                {[-0.26, 0, 0.26].map((gx, k) => (
                  <mesh key={`vt${k}`} position={[gx, 0.02, 0]} rotation={[0, Math.PI / 2, 0]}>
                    <boxGeometry args={[0.82, 0.002, 0.005]} />
                    <meshStandardMaterial color="#0091FF" metalness={0.8} roughness={0.3} />
                  </mesh>
                ))}
              </group>
            ))}
          </group>
        ))}
      </group>
    </group>
  );
}

function Ground() {
  return (
    <group position={[0, 0, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[16, 16]} />
        <meshStandardMaterial color="#0B132A" roughness={1} />
      </mesh>
    </group>
  );
}

function SolarHouseScene() {
  return (
    <group position={[0, -0.8, 0]} rotation={[0, -0.4, 0]}>
      <MainHouse />
      <ElevatedSolarRack />
      <Ground />
    </group>
  );
}

function AutoRotateHouse() {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.18;
    }
  });
  return <group ref={ref}><SolarHouseScene /></group>;
}

export default function House3D() {
  const [auto, setAuto] = useState(true);

  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden border border-[var(--border)] shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
      style={{ background: "#070C18", height: "480px" }}
      onMouseEnter={() => setAuto(false)}
      onMouseLeave={() => setAuto(true)}
    >
      <Canvas
        camera={{ position: [5.5, 3.8, 5.5], fov: 38 }}
        dpr={[1, 1.25]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        style={{ background: "#070C18" }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.75} color="#E2E8F0" />
          <directionalLight position={[8, 12, 6]} intensity={1.5} color="#FFFFFF" />
          <directionalLight position={[-6, 6, -4]} intensity={0.4} color="#38BDF8" />

          {auto ? <AutoRotateHouse /> : <SolarHouseScene />}

          <ContactShadows position={[0, -0.81, 0]} opacity={0.4} scale={8} blur={1.2} far={3} />

          <OrbitControls
            enablePan={false}
            enableZoom
            minDistance={4}
            maxDistance={12}
            minPolarAngle={0.2}
            maxPolarAngle={Math.PI / 2.1}
          />
        </Suspense>
      </Canvas>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-[#0F172A] border border-[var(--border)] text-[12px] text-[var(--white)] pointer-events-none flex items-center gap-2 shadow-lg">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
          <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l3 3-3-3M19 9l3 3-3 3" />
        </svg>
        <span>3D Solar House | Drag to rotate 360°</span>
      </div>
    </div>
  );
}