import React from 'react';

const LogoIcon = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
    <rect width="40" height="40" rx="10" fill="#111" />
    {/* Stylized process nodes */}
    <rect x="10" y="10" width="8" height="6" rx="2" fill="#fff" opacity="0.95" />
    <rect x="22" y="10" width="8" height="6" rx="2" fill="#fff" opacity="0.7" />
    <rect x="10" y="20" width="8" height="6" rx="2" fill="#fff" opacity="0.7" />
    <rect x="22" y="20" width="8" height="6" rx="2" fill="#fff" opacity="0.95" />
    {/* Status dot on active node */}
    <circle cx="26" cy="13" r="1.5" fill="#10b981" />
    <circle cx="26" cy="23" r="1.5" fill="#10b981" />
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
