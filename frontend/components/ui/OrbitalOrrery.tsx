'use client';

import { memo, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { Asteroid } from '@/lib/data';

// ── Orbit geometry ────────────────────────────────────────────────────────────

/**
 * Generates points along a Keplerian ellipse.
 * The Sun sits at the origin; the ellipse is shifted by -c (focus offset).
 */
function makeOrbitPoints(a: number, e: number, segments = 256): THREE.Vector3[] {
  const b = a * Math.sqrt(1 - e * e);   // semi-minor axis
  const c = a * e;                       // focus offset (center → focus distance)
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k <= segments; k++) {
    const theta = (k / segments) * Math.PI * 2;
    // Shift -c so the origin (Sun) sits at the focal point
    pts.push(new THREE.Vector3(Math.cos(theta) * a - c, 0, Math.sin(theta) * b));
  }
  return pts;
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** Thin line ring for an orbit path. */
const OrbitRing = memo(function OrbitRing({
  a, e, inclinationDeg, color,
}: {
  a: number; e: number; inclinationDeg: number; color: string;
}) {
  const points = useMemo(() => makeOrbitPoints(a, e), [a, e]);
  const inclRad = (inclinationDeg * Math.PI) / 180;

  return (
    <group rotation={[inclRad, 0, 0]}>
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array(points.flatMap((p) => [p.x, p.y, p.z])), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color={color} transparent opacity={0.7} />
      </line>
    </group>
  );
});
OrbitRing.displayName = 'OrbitRing';

/** Small body (planet / asteroid) that orbits its ellipse over time. */
const OrbitingBody = memo(function OrbitingBody({
  a, e, inclinationDeg, color, radius, speed,
}: {
  a: number; e: number; inclinationDeg: number;
  color: string; radius: number; speed: number;
}) {
  const ref = useRef<THREE.Mesh>(null!);
  const inclRad = (inclinationDeg * Math.PI) / 180;
  const b = a * Math.sqrt(1 - e * e);
  const c = a * e;

  useFrame(({ clock }) => {
    const theta = clock.getElapsedTime() * speed;
    const x = Math.cos(theta) * a - c;
    const z = Math.sin(theta) * b;
    // Apply inclination manually so the body tracks its inclined orbit ring
    ref.current.position.set(
      x,
      z * Math.sin(inclRad),
      z * Math.cos(inclRad),
    );
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[radius, 12, 12]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
});
OrbitingBody.displayName = 'OrbitingBody';

/** Glowing Sun at the origin. */
const Sun = memo(function Sun() {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    // Gentle pulse
    const s = 1 + Math.sin(clock.getElapsedTime() * 2) * 0.04;
    ref.current.scale.setScalar(s);
  });

  return (
    <>
      <pointLight position={[0, 0, 0]} intensity={3} color="#FFB800" distance={30} decay={1.5} />
      <mesh ref={ref} position={[0, 0, 0]}>
        <sphereGeometry args={[0.12, 32, 32]} />
        <meshBasicMaterial color="#FFB800" />
      </mesh>
    </>
  );
});
Sun.displayName = 'Sun';

// ── Scene ─────────────────────────────────────────────────────────────────────

const Scene = memo(function Scene({ asteroid }: { asteroid: Asteroid }) {
  const { semi_major_axis_au: a, eccentricity: e, inclination } = asteroid;
  const clampedE = Math.min(e, 0.98); // prevent degenerate parabola

  return (
    <>
      <ambientLight intensity={0.05} />
      <Stars radius={80} depth={50} count={2000} factor={3} fade speed={0.4} />

      {/* Sun */}
      <Sun />

      {/* Earth reference orbit — 1 AU circle */}
      <OrbitRing a={1} e={0} inclinationDeg={0} color="#334455" />
      <OrbitingBody a={1} e={0} inclinationDeg={0} color="#3b82f6" radius={0.035} speed={0.25} />

      {/* Target asteroid orbit */}
      <OrbitRing a={a} e={clampedE} inclinationDeg={inclination} color="#FF3831" />
      <OrbitingBody
        a={a} e={clampedE} inclinationDeg={inclination}
        color="#FF3831" radius={0.028}
        speed={0.25 / Math.pow(a, 1.5)} // Kepler: P = a^1.5 → angular speed ∝ 1/a^1.5
      />

      <OrbitControls
        enablePan={false}
        minDistance={0.5}
        maxDistance={10}
        autoRotate
        autoRotateSpeed={0.4}
        target={[0, 0, 0]}
      />
    </>
  );
});
Scene.displayName = 'Scene';

// ── Public component ──────────────────────────────────────────────────────────

interface Props {
  asteroid: Asteroid;
}

function OrbitalOrreryComponent({ asteroid }: Props) {
  return (
    <Canvas
      camera={{ position: [0, 3.5, 5], fov: 50 }}
      style={{ background: '#050505' }}
    >
      <Scene asteroid={asteroid} />
    </Canvas>
  );
}

export const OrbitalOrrery = memo(OrbitalOrreryComponent);
OrbitalOrrery.displayName = 'OrbitalOrrery';
