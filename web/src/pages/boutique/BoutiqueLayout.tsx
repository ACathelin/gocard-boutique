/**
 * Wraps every /boutique route in the scoped `.theme-boutique` class and loads
 * boutique-theme.css. The theme is strictly scoped — nothing leaks to the rest
 * of the app.
 */

import React from 'react';
import '@/styles/boutique-theme.css';

type BoutiqueLayoutProps = {
  children: React.ReactNode;
};

export default function BoutiqueLayout({ children }: BoutiqueLayoutProps) {
  return (
    <div className="theme-boutique" style={{ minHeight: '100vh' }}>
      {children}
    </div>
  );
}
