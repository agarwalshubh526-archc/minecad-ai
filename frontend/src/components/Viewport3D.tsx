'use client';

import React, { useMemo, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport } from '@react-three/drei';
import * as THREE from 'three';
import type { GeometryData, MeshData } from '@/types';

interface Viewport3DProps {
  geometry: GeometryData | null;
  viewMode: 'solid' | 'wireframe';
  showSectionView: boolean;
  sectionHeight: number;
}

// Single mesh component
function CadMesh({ mesh, wireframe, clipPlanes }: { mesh: MeshData; wireframe: boolean; clipPlanes: THREE.Plane[] | null }) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const verts: number[] = [];
    const indices: number[] = [];

    for (const v of mesh.vertices) {
      verts.push(v[0], v[2], -v[1]); // Swap Y/Z and negate for Three.js coord system
    }
    for (const face of mesh.indices) {
      indices.push(face[0], face[1], face[2]);
    }

    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }, [mesh]);

  // Dispose GPU buffers when the geometry is replaced or unmounted
  useEffect(() => {
    return () => geom.dispose();
  }, [geom]);

  return (
    <mesh geometry={geom}>
      {wireframe ? (
        <meshBasicMaterial color={mesh.color} wireframe transparent opacity={0.6} clippingPlanes={clipPlanes} />
      ) : (
        <meshStandardMaterial
          color={mesh.color}
          metalness={0.1}
          roughness={0.7}
          side={THREE.DoubleSide}
          clippingPlanes={clipPlanes}
        />
      )}
    </mesh>
  );
}

// Clipping plane for section view
function SectionPlane({ height }: { height: number }) {
  return (
    <mesh position={[0, height, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[2000, 2000]} />
      <meshBasicMaterial color="#ff660033" transparent opacity={0.15} side={THREE.DoubleSide} />
    </mesh>
  );
}

// Animated camera helper
function CameraRig() {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      // Subtle floating animation
      ref.current.position.y = Math.sin(clock.elapsedTime * 0.5) * 0.5;
    }
  });
  return <group ref={ref} />;
}

// Recenter the camera when the model's center/radius change (new project,
// parameter edits) instead of only applying camera props at mount
function CameraRecenter({ center, radius }: { center: [number, number, number]; radius: number }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as { target: THREE.Vector3; update: () => void } | null;

  useEffect(() => {
    camera.position.set(
      center[0] + radius * 1.2,
      center[1] + radius * 0.8,
      center[2] + radius * 1.2,
    );
    if (controls) {
      controls.target.set(center[0], center[1], center[2]);
      controls.update();
    } else {
      camera.lookAt(center[0], center[1], center[2]);
    }
  }, [center, radius, camera, controls]);

  return null;
}

export default function Viewport3D({ geometry, viewMode, showSectionView, sectionHeight }: Viewport3DProps) {
  const meshes = useMemo(() => geometry?.meshes ?? [], [geometry]);

  // Calculate center for camera
  const center = useMemo(() => {
    if (meshes.length === 0) return [0, 0, 0] as [number, number, number];
    let cx = 0, cy = 0, cz = 0, count = 0;
    for (const m of meshes) {
      for (const v of m.vertices) {
        cx += v[0]; cy += v[2]; cz += -v[1];
        count++;
      }
    }
    return [cx / count, cy / count, cz / count] as [number, number, number];
  }, [meshes]);

  // Bounding sphere radius for camera distance
  const radius = useMemo(() => {
    let maxDist = 0;
    for (const m of meshes) {
      for (const v of m.vertices) {
        const d = Math.sqrt(
          (v[0] - center[0]) ** 2 + (v[2] - center[1]) ** 2 + (-v[1] - center[2]) ** 2
        );
        maxDist = Math.max(maxDist, d);
      }
    }
    return Math.max(maxDist, 50);
  }, [meshes, center]);

  // Real clipping plane for section view (world Y = geometry Z)
  const clipPlane = useMemo(() => {
    if (!showSectionView) return null;
    return [new THREE.Plane(new THREE.Vector3(0, 1, 0), -sectionHeight)];
  }, [showSectionView, sectionHeight]);

  if (!geometry || meshes.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#0d1117]">
        <div className="text-center">
          <div className="text-[#484f58] text-4xl mb-4">🏔️</div>
          <p className="text-[#484f58] font-mono text-sm">Generate geometry to view 3D model</p>
          <p className="text-[#30363d] font-mono text-xs mt-2">Orbit • Pan • Zoom</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[280px] touch-none">
      <Canvas
        camera={{
          position: [center[0] + radius * 1.2, center[1] + radius * 0.8, center[2] + radius * 1.2],
          fov: 50,
          near: 0.1,
          far: 10000,
        }}
        shadows
        gl={{ antialias: true, alpha: false, localClippingEnabled: true }}
        style={{ background: '#0d1117' }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[radius, radius * 2, radius]}
          intensity={1}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
        <directionalLight position={[-radius, radius, -radius]} intensity={0.3} />
        <pointLight position={center} intensity={0.2} />

        {/* Environment */}
        <fog attach="fog" args={['#0d1117', radius * 3, radius * 6]} />

        {/* Grid */}
        <Grid
          args={[2000, 2000]}
          cellSize={10}
          cellThickness={0.5}
          cellColor="#1a2332"
          sectionSize={50}
          sectionThickness={1}
          sectionColor="#1f3044"
          fadeDistance={radius * 4}
          fadeStrength={1}
          followCamera={false}
          position={[center[0], 0, center[2]]}
        />

        {/* Meshes */}
        {meshes.map((mesh, i) => (
          <CadMesh
            key={i}
            mesh={mesh}
            wireframe={viewMode === 'wireframe'}
            clipPlanes={clipPlane}
          />
        ))}

        {/* Section plane visualization */}
        {showSectionView && <SectionPlane height={sectionHeight} />}

        {/* Controls */}
        <OrbitControls
          makeDefault
          target={center}
          enableDamping
          dampingFactor={0.1}
          minDistance={10}
          maxDistance={radius * 5}
        />

        {/* Recenter camera when the model changes */}
        <CameraRecenter center={center} radius={radius} />

        {/* Gizmo */}
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport labelColor="white" axisHeadScale={1} />
        </GizmoHelper>

        <CameraRig />
      </Canvas>
    </div>
  );
}
