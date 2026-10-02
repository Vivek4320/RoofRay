"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { LuMove } from "react-icons/lu";

const pillars = [
  { x: -1.3, z: -0.7, h: 0.87 },
  { x: -0.3, z: -0.7, h: 0.87 },
  { x: -1.3, z: 0.7, h: 0.35 },
  { x: -0.3, z: 0.7, h: 0.35 },
];

function MainHouse() {
  return (
    <group>
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[4.1, 0.3, 3.3]} />
        <meshStandardMaterial color="#64748B" roughness={0.7} />
      </mesh>

      <mesh position={[0, 1.15, 0]}>
        <boxGeometry args={[4, 1.7, 3.2]} />
        <meshStandardMaterial color="#E2E8F0" roughness={0.65} />
      </mesh>

      <mesh position={[0, 2.05, 0]}>
        <boxGeometry args={[4.3, 0.12, 3.5]} />
        <meshStandardMaterial color="#CBD5E1" roughness={0.6} />
      </mesh>

      <mesh position={[0.2, 1.72, 1.68]}>
        <boxGeometry args={[1.5, 0.08, 0.5]} />
        <meshStandardMaterial color="#CBD5E1" roughness={0.6} />
      </mesh>

      <group position={[0.1, 0.85, 1.61]}>
        <mesh>
          <boxGeometry args={[0.65, 1.25, 0.04]} />
          <meshStandardMaterial color="#3F2314" roughness={0.5} />
        </mesh>
        <mesh position={[-0.24, 0, 0.03]}>
          <boxGeometry args={[0.03, 0.25, 0.04]} />
          <meshStandardMaterial
            color="#E2E8F0"
            metalness={0.9}
            roughness={0.2}
          />
        </mesh>
      </group>

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

      <group position={[-1.1, 1.05, 1.61]}>
        <mesh>
          <boxGeometry args={[1.1, 0.95, 0.05]} />
          <meshStandardMaterial color="#1E293B" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, 0.02]}>
          <boxGeometry args={[0.98, 0.83, 0.02]} />
          <meshStandardMaterial
            color="#38BDF8"
            metalness={0.3}
            roughness={0.1}
            transparent
            opacity={0.55}
          />
        </mesh>
        <mesh position={[0, 0, 0.03]}>
          <boxGeometry args={[0.03, 0.83, 0.02]} />
          <meshStandardMaterial color="#1E293B" roughness={0.4} />
        </mesh>
      </group>

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
          <meshStandardMaterial
            color="#38BDF8"
            metalness={0.3}
            roughness={0.1}
            transparent
            opacity={0.55}
          />
        </mesh>
      </group>

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
      {pillars.map((pillar, index) => (
        <group key={index} position={[pillar.x, 0.25, pillar.z]}>
          <mesh position={[0, -0.2, 0]}>
            <boxGeometry args={[0.2, 0.1, 0.2]} />
            <meshStandardMaterial color="#64748B" />
          </mesh>
          <mesh position={[0, pillar.h / 2 - 0.2, 0]}>
            <cylinderGeometry args={[0.035, 0.035, pillar.h, 8]} />
            <meshStandardMaterial color="#94A3B8" />
          </mesh>
        </group>
      ))}

      <group position={[0.1, 0.65, 0]} rotation={[0.33, -3.15, 0]}>
        {[0.35, 1, 0.45, 1.45].map((panelX, column) => (
          <group key={`column-${column}`} position={[panelX, 0, 0]}>
            {[-0.46, 0.46].map((panelZ, row) => (
              <group key={`panel-${row}`} position={[0, 0.02, panelZ]}>
                <mesh>
                  <boxGeometry args={[0.84, 0.03, 0.88]} />
                  <meshStandardMaterial
                    color="#CBD5E1"
                    metalness={0.9}
                    roughness={0.2}
                  />
                </mesh>
                <mesh position={[0, 0.016, 0]}>
                  <boxGeometry args={[0.8, 0.005, 0.84]} />
                  <meshStandardMaterial
                    color="#004CBD"
                    metalness={0.75}
                    roughness={0.15}
                  />
                </mesh>

                {[-0.26, 0, 0.26].map((lineZ, index) => (
                  <mesh
                    key={`horizontal-${index}`}
                    position={[0, 0.02, lineZ]}
                  >
                    <boxGeometry args={[0.78, 0.002, 0.005]} />
                    <meshStandardMaterial
                      color="#0091FF"
                      metalness={0.8}
                      roughness={0.3}
                    />
                  </mesh>
                ))}

                {[-0.26, 0, 0.26].map((lineX, index) => (
                  <mesh
                    key={`vertical-${index}`}
                    position={[lineX, 0.02, 0]}
                    rotation={[0, Math.PI / 2, 0]}
                  >
                    <boxGeometry args={[0.82, 0.002, 0.005]} />
                    <meshStandardMaterial
                      color="#0091FF"
                      metalness={0.8}
                      roughness={0.3}
                    />
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
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
      <planeGeometry args={[16, 16]} />
      <meshStandardMaterial color="#0B132A" roughness={1} />
    </mesh>
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

  return (
    <group ref={ref}>
      <SolarHouseScene />
    </group>
  );
}

export default function House3D() {
  const [auto, setAuto] = useState(true);
  const controlsRef = useRef<any>(null);

  // Vertical swipes scroll the page, horizontal drags rotate the house.
  useEffect(() => {
    const el = controlsRef.current?.domElement as HTMLElement | undefined;
    if (el) el.style.touchAction = "pan-y";
  });

  return (
    <div
      className="relative h-[360px] w-full overflow-hidden rounded-2xl border border-[var(--border)] shadow-[0_20px_50px_rgba(0,0,0,0.6)] md:h-[480px]"
      style={{ background: "#070C18" }}
      // Pointer events work for both mouse and touch
      onPointerEnter={() => setAuto(false)}
      onPointerLeave={() => setAuto(true)}
      onPointerDown={() => setAuto(false)}
      onPointerUp={() => setAuto(true)}
      onPointerCancel={() => setAuto(true)}
    >
      <Canvas
        camera={{ position: [5.5, 3.8, 5.5], fov: 38 }}
        dpr={[1, 1.25]}
        gl={{ antialias: false, powerPreference: "default" }}
        style={{ background: "#070C18" }}
        fallback={
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/solar-house-flat.png"
            alt="A house fitted with rooftop solar panels"
            className="h-full w-full object-contain"
          />
        }
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.75} color="#E2E8F0" />
          <directionalLight
            position={[8, 12, 6]}
            intensity={1.5}
            color="#FFFFFF"
          />
          <directionalLight
            position={[-6, 6, -4]}
            intensity={0.4}
            color="#38BDF8"
          />

          {auto ? <AutoRotateHouse /> : <SolarHouseScene />}

          <ContactShadows
            position={[0, -0.81, 0]}
            opacity={0.4}
            scale={8}
            blur={1.2}
            far={3}
            resolution={256}
          />

          <OrbitControls
            ref={controlsRef}
            target={[0, 0.6, 0]}
            enablePan={false}
            enableZoom
            minDistance={4}
            maxDistance={12}
            minPolarAngle={0.2}
            maxPolarAngle={Math.PI / 2.1}
            touches={{
              ONE: THREE.TOUCH.ROTATE,
              TWO: THREE.TOUCH.DOLLY_ROTATE,
            }}
          />
        </Suspense>
      </Canvas>

      <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-[var(--border)] bg-[#0F172A] px-3 py-2 text-[11px] text-[var(--white)] shadow-lg md:px-4 md:text-[12px]">
        <LuMove
          className="h-3.5 w-3.5"
          style={{ color: "var(--accent)" }}
          aria-hidden="true"
        />
        <span>3D Solar House | Drag to rotate 360°</span>
      </div>
    </div>
  );
}