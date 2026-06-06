import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, OrbitControls, Sparkles, Stars } from '@react-three/drei';
import * as THREE from 'three';

function NebulaField() {
  const { positions, colors } = useMemo(() => {
    const count = 950;
    const positionArray = new Float32Array(count * 3);
    const colorArray = new Float32Array(count * 3);
    const palette = ['#6ea8ff', '#d39aff', '#5fe7bf', '#ffad6b', '#f4f7ff'];

    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 34 + Math.random() * 72;
      const haze = Math.random() ** 2;
      positionArray[index * 3] = Math.cos(angle) * radius * (0.8 + haze * 0.7);
      positionArray[index * 3 + 1] = (Math.random() - 0.5) * 28;
      positionArray[index * 3 + 2] = Math.sin(angle) * radius * (0.8 + haze * 0.7);

      const color = new THREE.Color(palette[index % palette.length]);
      colorArray[index * 3] = color.r;
      colorArray[index * 3 + 1] = color.g;
      colorArray[index * 3 + 2] = color.b;
    }

    return { positions: positionArray, colors: colorArray };
  }, []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={colors.length / 3}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.42}
        vertexColors
        transparent
        opacity={0.24}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function CosmicBackground() {
  return (
    <>
      <Stars radius={140} depth={80} count={5200} factor={4.8} saturation={0.35} fade speed={0.26} />
      <NebulaField />
      <Sparkles
        count={180}
        scale={[86, 24, 86]}
        size={1.2}
        speed={0.12}
        opacity={0.34}
        color="#eaf2ff"
      />
    </>
  );
}

function OrbitRing({ radius, color, tilt = 0 }) {
  return (
    <mesh rotation={[Math.PI / 2 + tilt, 0, 0]}>
      <ringGeometry args={[radius - 0.018, radius + 0.018, 160]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.18}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

function HoverLabel({ body }) {
  return (
    <Html center position={[0, body.size + 0.72, 0]} distanceFactor={12} occlude>
      <div className="repo-tooltip">{body.repo.name}</div>
    </Html>
  );
}

function SelectionHalo({ size, color }) {
  return (
    <mesh>
      <sphereGeometry args={[size * 1.35, 40, 40]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.18}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

function PlanetMoon({ color, parentSize }) {
  const moonRef = useRef();

  useFrame((_, delta) => {
    if (moonRef.current) moonRef.current.rotation.y += delta * 0.62;
  });

  return (
    <group ref={moonRef}>
      <mesh position={[parentSize * 2.1, parentSize * 0.35, 0]}>
        <sphereGeometry args={[Math.max(0.08, parentSize * 0.16), 16, 16]} />
        <meshStandardMaterial
          color="#f7fbff"
          emissive={color}
          emissiveIntensity={0.32}
          roughness={0.4}
        />
      </mesh>
    </group>
  );
}

function RepoBody({ body, selected, onSelect }) {
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef();
  const lightRef = useRef();
  const color = useMemo(() => new THREE.Color(body.color), [body.color]);
  const isStar = body.kind === 'star';
  const hasRing = !isStar && body.normalisedCommits > 0.54;
  const hasMoon = !isStar && body.normalisedCommits > 0.78;

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : 'default';
    return () => {
      document.body.style.cursor = 'default';
    };
  }, [hovered]);

  useFrame(({ clock }, delta) => {
    const elapsed = clock.getElapsedTime();
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * (isStar ? 0.08 : 0.16);
      if (isStar) {
        const pulse = 1 + Math.sin(elapsed * 1.7 + body.size) * 0.035;
        meshRef.current.scale.setScalar(pulse);
      }
    }

    if (lightRef.current) {
      lightRef.current.intensity = body.brightness + Math.sin(elapsed * 1.2) * 0.16;
    }
  });

  return (
    <group>
      {selected && <SelectionHalo size={body.size} color={body.color} />}
      {isStar && (
        <>
          <pointLight ref={lightRef} color={color} intensity={body.brightness} distance={34} />
          <mesh scale={2.35}>
            <sphereGeometry args={[body.size, 42, 42]} />
            <meshBasicMaterial
              color={body.color}
              transparent
              opacity={0.11}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          <Sparkles
            count={34}
            scale={[body.size * 2.8, body.size * 2.8, body.size * 2.8]}
            size={body.size * 2.4}
            speed={0.23}
            opacity={0.68}
            color={body.color}
          />
        </>
      )}
      <mesh
        ref={meshRef}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(body);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[body.size, isStar ? 64 : 40, isStar ? 64 : 40]} />
        <meshStandardMaterial
          color={body.color}
          emissive={body.color}
          emissiveIntensity={isStar ? body.brightness : body.brightness * 0.62}
          roughness={isStar ? 0.26 : 0.46}
          metalness={isStar ? 0.02 : 0.12}
        />
      </mesh>
      {!isStar && (
        <mesh scale={1.28}>
          <sphereGeometry args={[body.size, 32, 32]} />
          <meshBasicMaterial
            color={body.color}
            transparent
            opacity={0.08 + body.normalisedCommits * 0.07}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}
      {hasRing && (
        <mesh rotation={[Math.PI / 2.4, 0.25, 0]}>
          <ringGeometry args={[body.size * 1.42, body.size * 1.7, 80]} />
          <meshBasicMaterial
            color="#f7fbff"
            transparent
            opacity={0.26}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}
      {hasMoon && <PlanetMoon color={body.color} parentSize={body.size} />}
      {hovered && <HoverLabel body={body} />}
    </group>
  );
}

function OrbitingPlanet({ body, selectedId, onSelect }) {
  const orbitRef = useRef();

  useFrame((_, delta) => {
    if (orbitRef.current) orbitRef.current.rotation.y += body.speed * delta;
  });

  return (
    <group rotation={[body.tilt, 0, body.phase]}>
      <OrbitRing radius={body.orbitRadius} color={body.color} tilt={body.tilt * 0.3} />
      <group ref={orbitRef} rotation={[0, body.initialAngle, 0]}>
        <group position={[body.orbitRadius, 0, 0]}>
          <RepoBody body={body} selected={selectedId === body.repo.id} onSelect={onSelect} />
        </group>
      </group>
    </group>
  );
}

function SolarSystem({ system, selectedId, onSelect }) {
  return (
    <group position={system.position}>
      <RepoBody body={system.star} selected={selectedId === system.star.repo.id} onSelect={onSelect} />
      {system.planets.map((planet) => (
        <OrbitingPlanet
          key={planet.id}
          body={planet}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
      <Html position={[0, -3.8, 0]} center distanceFactor={18} occlude>
        <div className="system-label">{system.language}</div>
      </Html>
    </group>
  );
}

function CameraController({ focus }) {
  const controls = useRef();
  const target = useMemo(() => new THREE.Vector3(), []);
  const desired = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    if (!controls.current) return;

    desired.set(focus?.[0] ?? 0, focus?.[1] ?? 0, focus?.[2] ?? 0);
    target.copy(controls.current.target).lerp(desired, focus ? 0.045 : 0.018);
    controls.current.target.copy(target);
    controls.current.update();
  });

  return (
    <OrbitControls
      ref={controls}
      enableDamping
      dampingFactor={0.055}
      enablePan
      panSpeed={0.42}
      rotateSpeed={0.44}
      zoomSpeed={0.56}
      minDistance={7}
      maxDistance={96}
      autoRotate={!focus}
      autoRotateSpeed={0.13}
    />
  );
}

export default function GalaxyScene({ layout, selectedRepoId, onSelect }) {
  const focus = useMemo(() => {
    const body = layout.bodies.find((candidate) => candidate.repo.id === selectedRepoId);
    return body?.systemPosition;
  }, [layout.bodies, selectedRepoId]);

  return (
    <Canvas
      camera={{ position: [0, 18, 48], fov: 54, near: 0.1, far: 240 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false }}
    >
      <color attach="background" args={['#02030b']} />
      <fog attach="fog" args={['#050817', 42, 138]} />
      <ambientLight intensity={0.26} color="#90a8ff" />
      <hemisphereLight args={['#bcd4ff', '#100614', 0.28]} />
      <CosmicBackground />
      {layout.systems.map((system) => (
        <SolarSystem
          key={system.id}
          system={system}
          selectedId={selectedRepoId}
          onSelect={onSelect}
        />
      ))}
      <CameraController focus={focus} />
    </Canvas>
  );
}
