import { useEffect, useRef } from 'react';

/**
 * Custom React Hook for realistic 3D perspective tilt & light reflection.
 * @param {Object} options Configuration options
 * @param {number} options.maxTilt Maximum tilt angle in degrees (default: 8)
 * @param {number} options.perspective Perspective depth in px (default: 1000)
 * @param {number} options.scale Scale on hover (default: 1.02)
 * @param {boolean} options.enabled Whether the effect is active
 */
export const use3DTilt = ({
    maxTilt = 8,
    perspective = 1000,
    scale = 1.015,
    enabled = true
} = {}) => {
    const elementRef = useRef(null);

    useEffect(() => {
        const el = elementRef.current;
        if (!el || !enabled) return;

        let frameId = null;

        const handleMouseMove = (e) => {
            if (frameId) cancelAnimationFrame(frameId);

            frameId = requestAnimationFrame(() => {
                const rect = el.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                const centerX = rect.width / 2;
                const centerY = rect.height / 2;

                const percentX = (x - centerX) / centerX;
                const percentY = (y - centerY) / centerY;

                const rotateY = percentX * maxTilt;
                const rotateX = -percentY * maxTilt;

                el.style.transform = `perspective(${perspective}px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(${scale}, ${scale}, ${scale})`;
                el.style.transition = 'transform 0.08s ease-out';
            });
        };

        const handleMouseLeave = () => {
            if (frameId) cancelAnimationFrame(frameId);
            el.style.transform = `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
            el.style.transition = 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)';
        };

        el.addEventListener('mousemove', handleMouseMove);
        el.addEventListener('mouseleave', handleMouseLeave);

        return () => {
            if (frameId) cancelAnimationFrame(frameId);
            el.removeEventListener('mousemove', handleMouseMove);
            el.removeEventListener('mouseleave', handleMouseLeave);
            if (el) {
                el.style.transform = '';
                el.style.transition = '';
            }
        };
    }, [maxTilt, perspective, scale, enabled]);

    return elementRef;
};

export default use3DTilt;