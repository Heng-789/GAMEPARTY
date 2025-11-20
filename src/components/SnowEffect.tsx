import React from 'react';
import '../styles/snow.css';

const SnowEffect: React.FC = () => {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 99, overflow: 'hidden' }}>
      <div className="snow"></div>
      <div className="snow2"></div>
    </div>
  );
};

export default SnowEffect;

