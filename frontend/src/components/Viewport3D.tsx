'use client';

import React, { useMemo, useRef, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport } from '@react-three/drei';
import * as THREE from 'three';
import type { GeometryData, MeshData, LayerInfo } from '@/types';

interface Viewport3DProps {
  geometry: GeometryData | null;
  layers: LayerInfo[];
  viewMode: 'solid' | 'wireframe';
  showSectionView: boolean;
  sectionHeight: number;
}

// Layers that render translucent in solid mode (underground workings visible).
const TRANSLUCENT_LAYERS = new Set(['ROOF']);

// Single CAD mesh: flat-shaded solid, or x-ray wireframe (faint fill + crisp
// edges instead of triangle-soup wireframe).
function CadMesh({ mesh, wireframe, clipPlanes }: { mesh: MeshData; wireframe: boolean; clipPlanes: THREE.Plane[] | null }) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const verts: number[] = [];
    const indices: number[] = [];

    for (const v of mesh.vertices) {
      verts.push(v[0], v[2], -v[1]); // plan (x, y) → world (x, -y), height z → world y
    }
    for (const face of mesh.indices) {
      indices.push(face[0], face[1], face[2]);
    }

    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }, [mesh]);

  // CAD wireframe: real edges (slope breaks + outlines) over a ghost fill
  const edges = useMemo(() => {
    if (!wireframe) return null;
    return new THREE.EdgesGeometry(geom, 20);
  }, [wireframe, geom]);

  // Dispose GPU buffers when the geometry is replaced or unmounted
  useEffect(() => {
    return () => {
      geom.dispose();
      edges?.dispose();
    };
  }, [geom, edges]);

  const translucent = !wireframe && mesh.layer !== undefined && TRANSLUCENT_LAYERS.has(mesh.layer);
  const clips = clipPlanes ?? undefined;

  return (
    <group>
      <mesh geometry={geom} castShadow receiveShadow>
        {wireframe ? (
          <meshBasicMaterial
            color={mesh.color}
            transparent
            opacity={0.1}
            depthWrite={false}
            side={THREE.DoubleSide}
            clippingPlanes={clips}
          />
        ) : (
          <meshStandardMaterial
            color={mesh.color}
            metalness={0}
            roughness={0.9}
            side={THREE.DoubleSide}
            clippingPlanes={clips}
            transparent={translucent}
            opacity={translucent ? 0.35 : 1}
            depthWrite={!translucent}
          />
        )}
      </mesh>
      {edges && (
        <lineSegments geometry={edges}>
          <lineBasicMaterial color={mesh.color} transparent opacity={0.85} clippingPlanes={clips} />
        </lineSegments>
      )}
    </group>
  );
}

// Clipping plane for section view — also applied to the ground catcher/grid.
function SectionPlane({ height }: { height: number }) {
  return (
    <mesh position={[0, height, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[2000, 2000]} />
      <meshBasicMaterial color="#ff660033" transparent opacity={0.15} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

// Three-point-style rig: hemisphere ambient, shadow-casting key light aimed at
// the model center (models are not necessarily near the origin), weak fill.
function LightingRig({ center, radius }: { center: [number, number, number]; radius: number }) {
  const key = useRef<THREE.DirectionalLight>(null);

  useEffect(() => {
    const l = key.current;
    if (!l) return;
    l.position.set(center[0] + radius * 0.9, center[1] + radius * 1.9, center[2] + radius * 0.6);
    l.target.position.set(center[0], center[1], center[2]);
    l.target.updateMatrixWorld();
    const cam = l.shadow.camera;
    cam.updateProjectionMatrix();
  }, [center, radius]);

  return (
    <>
      <hemisphereLight args={['#cdd8e4', '#4a4238', 0.8]} />
      <directionalLight
        ref={key}
        castShadow
        intensity={1.9}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-camera-near={radius * 0.05}
        shadow-camera-far={radius * 6}
        shadow-camera-left={-radius * 1.6}
        shadow-camera-right={radius * 1.6}
        shadow-camera-top={radius * 1.6}
        shadow-camera-bottom={-radius * 1.6}
      />
      <directionalLight position={[center[0] - radius, center[1] + radius * 0.7, center[2] - radius]} intensity={0.55} />
    </>
  );
}

// Recenter the camera when the model's center/radius change (new project,
// parameter edits) instead of only applying camera props at mount
function CameraRecenter({ center, radius }: { center: [number, number, number]; radius: number }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as { target: THREE.Vector3; update: () => void } | null;
  // demand frameloop: imperative camera moves must request a frame explicitly
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    camera.position.set(
      center[0] + radius * 1.1,
      center[1] + radius * 0.75,
      center[2] + radius * 1.1,
    );
    if (controls) {
      controls.target.set(center[0], center[1], center[2]);
      controls.update();
    } else {
      camera.lookAt(center[0], center[1], center[2]);
    }
    invalidate();
  }, [center, radius, camera, controls, invalidate]);

  return null;
}

export default function Viewport3D({ geometry, layers, viewMode, showSectionView, sectionHeight }: Viewport3DProps) {
  const meshes = useMemo(() => {
    const hidden = new Set(layers.filter(l => !l.visible).map(l => l.name));
    return (geometry?.meshes ?? []).filter(m => !m.layer || !hidden.has(m.layer));
  }, [geometry, layers]);

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

  // Bounding sphere radius for camera distance and light bounds
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
          position: [center[0] + radius * 1.1, center[1] + radius * 0.75, center[2] + radius * 1.1],
          fov: 45,
          near: 0.5,
          far: 20000,
        }}
        // Demand frameloop: render only on interaction/state change instead
        // of redrawing the full scene (shadow pass included) 60×/s forever —
        // this was the source of the "lagging" heat/fan load. drei controls
        // and gizmo invalidate on interaction; damping keeps invalidating
        // while it settles.
        frameloop="demand"
        shadows
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false, localClippingEnabled: true }}
        style={{ background: '#0d1117' }}
      >
        <color attach="background" args={['#0d1117']} />

        {/* Lighting rig */}
        <LightingRig center={center} radius={radius} />

        {/* Depth cue */}
        <fog attach="fog" args={['#0d1117', radius * 3, radius * 7]} />

        {/* Reference grid */}
        <Grid
          args={[2000, 2000]}
          cellSize={10}
          cellThickness={0.5}
          cellColor="#1a2332"
          sectionSize={50}
          sectionThickness={1}
          sectionColor="#1f3044"
          fadeDistance={radius * 5}
          fadeStrength={1}
          followCamera={false}
          position={[center[0], -0.01, center[2]]}
        />

        {/* Ground shadow catcher so objects sit in space, not a void */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[center[0], -0.05, center[2]]}
          receiveShadow
        >
          <planeGeometry args={[radius * 14, radius * 14]} />
          <shadowMaterial transparent opacity={0.45} clippingPlanes={clipPlane ?? undefined} />
        </mesh>

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
          dampingFactor={0.08}
          minDistance={5}
          maxDistance={radius * 6}
        />

        {/* Recenter camera when the model changes */}
        <CameraRecenter center={center} radius={radius} />

        {/* Gizmo */}
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport labelColor="white" axisHeadScale={1} />
        </GizmoHelper>
      </Canvas>
    </div>
  );
}
