import React from 'react';
import { Link } from 'react-router-dom';

export default function BoutiqueFooter() {
  return (
    <footer
      id="about"
      className="boutique-gutter boutique-section"
      style={{
        borderTop: '1px solid hsl(var(--boutique-border))',
        paddingBlock: '4rem',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '3rem',
        color: 'hsl(var(--boutique-text-muted))',
        fontSize: '0.88rem',
        lineHeight: 1.7,
      }}
    >
      <div>
        <div className="serif" style={{ fontSize: '1.25rem', color: 'hsl(var(--boutique-text))', marginBottom: '0.75rem' }}>
          GoCard
        </div>
        <p>
          A private membership for access to exclusive experiences, private dining, and travel.
          A lifestyle manager, a single message away.
        </p>
      </div>

      <div>
        <div className="eyebrow" style={{ marginBottom: '0.75rem' }}>The agent</div>
        <p>
          This page is designed to host a future Worldline GoPay Direct MCP — a protocol that lets AI concierges
          discover the collection, arrange experiences, and authorise payment via Visa Intelligent Commerce,
          Mastercard Agent Pay, and the emerging Trusted Agent standards.
        </p>
      </div>

      <div>
        <div className="eyebrow" style={{ marginBottom: '0.75rem' }}>Legal</div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          <li><Link to="/privacy" className="boutique-link">Privacy</Link></li>
          <li style={{ marginTop: '0.5rem' }}><Link to="/terms" className="boutique-link">Terms</Link></li>
          <li style={{ marginTop: '0.5rem' }}><Link to="/welcome" className="boutique-link">Worldline Demo</Link></li>
        </ul>
      </div>

      <div>
        <div className="eyebrow" style={{ marginBottom: '0.75rem' }}>Transport</div>
        <p style={{ fontFamily: 'var(--boutique-font-mono)', fontSize: '0.78rem' }}>
          wl-gopay-direct / v0 · visa_intelligent_commerce · mastercard_agentpay
        </p>
      </div>
    </footer>
  );
}
