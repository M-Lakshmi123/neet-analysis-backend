import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const ThreeSidebarModel = ({ is3DEnabled = true }) => {
    const containerRef = useRef(null);

    useEffect(() => {
        if (!is3DEnabled) return;

        const container = containerRef.current;
        if (!container) return;

        const width = 54;
        const height = 54;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
        camera.position.z = 4.2;

        const renderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: true
        });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        container.appendChild(renderer.domElement);

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
        scene.add(ambientLight);

        const pointLight1 = new THREE.PointLight(0x6366f1, 3.5, 20);
        pointLight1.position.set(4, 4, 4);
        scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0x38bdf8, 3.0, 20);
        pointLight2.position.set(-4, -3, 3);
        scene.add(pointLight2);

        // 3D Gemstone Geometry
        const geometry = new THREE.OctahedronGeometry(1.2, 0);
        const material = new THREE.MeshPhysicalMaterial({
            color: 0x4f46e5,
            emissive: 0x1e1b4b,
            roughness: 0.1,
            metalness: 0.3,
            transmission: 0.6,
            thickness: 1.2,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1,
            transparent: true,
            opacity: 0.95
        });

        const gemMesh = new THREE.Mesh(geometry, material);
        scene.add(gemMesh);

        // Outer wireframe halo
        const wireGeo = new THREE.OctahedronGeometry(1.35, 0);
        const wireMat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            wireframe: true,
            transparent: true,
            opacity: 0.45
        });
        const wireMesh = new THREE.Mesh(wireGeo, wireMat);
        scene.add(wireMesh);

        let isHovered = false;
        let mouseX = 0;
        let mouseY = 0;

        const handleMouseEnter = () => { isHovered = true; };
        const handleMouseLeave = () => { 
            isHovered = false; 
            mouseX = 0; 
            mouseY = 0; 
        };
        const handleMouseMove = (e) => {
            const rect = container.getBoundingClientRect();
            mouseX = ((e.clientX - rect.left) / width - 0.5) * 2;
            mouseY = -((e.clientY - rect.top) / height - 0.5) * 2;
        };

        container.addEventListener('mouseenter', handleMouseEnter);
        container.addEventListener('mouseleave', handleMouseLeave);
        container.addEventListener('mousemove', handleMouseMove);

        let animationFrameId;
        let clock = new THREE.Clock();

        const animate = () => {
            animationFrameId = requestAnimationFrame(animate);
            const delta = clock.getDelta();
            const spinMultiplier = isHovered ? 3.5 : 1.0;

            gemMesh.rotation.y += delta * 1.2 * spinMultiplier;
            gemMesh.rotation.x += delta * 0.6 * spinMultiplier;

            wireMesh.rotation.y -= delta * 0.8 * spinMultiplier;
            wireMesh.rotation.z += delta * 0.5 * spinMultiplier;

            if (isHovered) {
                gemMesh.position.x += (mouseX * 0.3 - gemMesh.position.x) * 0.15;
                gemMesh.position.y += (mouseY * 0.3 - gemMesh.position.y) * 0.15;
            } else {
                gemMesh.position.x += (0 - gemMesh.position.x) * 0.1;
                gemMesh.position.y += (0 - gemMesh.position.y) * 0.1;
            }
            wireMesh.position.copy(gemMesh.position);

            renderer.render(scene, camera);
        };

        animate();

        return () => {
            cancelAnimationFrame(animationFrameId);
            container.removeEventListener('mouseenter', handleMouseEnter);
            container.removeEventListener('mouseleave', handleMouseLeave);
            container.removeEventListener('mousemove', handleMouseMove);
            if (container.contains(renderer.domElement)) {
                container.removeChild(renderer.domElement);
            }
            geometry.dispose();
            wireGeo.dispose();
            material.dispose();
            wireMat.dispose();
            renderer.dispose();
        };
    }, [is3DEnabled]);

    if (!is3DEnabled) return null;

    return (
        <div
            ref={containerRef}
            className="sidebar-3d-model-wrapper"
            title="Interactive 3D Core"
            style={{
                width: 54,
                height: 54,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                filter: 'drop-shadow(0 4px 12px rgba(99, 102, 241, 0.45))',
                transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
        />
    );
};

export default ThreeSidebarModel;