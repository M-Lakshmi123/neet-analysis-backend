import React from 'react';

const VideoBackground = ({ is3DEnabled = true }) => {
    if (!is3DEnabled) return null;

    return (
        <div 
            className="ambient-video-wrapper" 
            aria-hidden="true"
            style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1, pointerEvents: 'none' }}
        >
            <video
                autoPlay
                loop
                muted
                playsInline
                className="ambient-video-element"
            >
                <source src="/product.mp4" type="video/mp4" />
            </video>
            <div className="ambient-video-overlay" />
        </div>
    );
};

export default VideoBackground;