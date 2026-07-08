import React from 'react';

const LogoIcon = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
    <circle cx="20" cy="20" r="19" stroke="#111" strokeWidth="2" fill="#111" />
    <text x="20" y="27" textAnchor="middle" fill="#fff" fontSize="22" fontWeight="700" fontFamily="Inter, sans-serif">S</text>
  </svg>
);

const Logo = ({ size = 32, collapsed, showText = true }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: (collapsed || !showText) ? 0 : 10 }}>
    <LogoIcon size={size} />
    {!collapsed && showText && (
      <span style={{ fontWeight: 700, fontSize: 18, color: '#0f172a', letterSpacing: '-.3px', whiteSpace: 'nowrap' }}>
        Supervisor
      </span>
    )}
  </div>
);

export default Logo;
