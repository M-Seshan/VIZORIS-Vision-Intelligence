// src/components/RootCauseView.jsx
import React, { useState, useEffect } from 'react';
import { 
  GitFork, 
  AlertTriangle, 
  Info, 
  Cpu, 
  Layers, 
  CheckCircle2
} from 'lucide-react';

export function RootCauseView({ currentInspection }) {
  const [rootData, setRootData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const defectType = currentInspection?.defects?.[0]?.type || '';
    fetch(`/api/root-cause?defectType=${encodeURIComponent(defectType)}`)
      .then(res => res.json())
      .then(data => {
        setRootData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load root-cause data:', err);
        setLoading(false);
      });
  }, [currentInspection]);

  const hotspot = rootData?.primaryHotspot;
  const hasData = rootData?.sufficientData && hotspot;

  return (
    <div className="root-cause-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Mandatory Probability Disclaimer Notice */}
      <div className="glass-panel" style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 18px', borderLeft: '3px solid var(--cyan-accent)' }}>
        <Info size={18} className="text-cyan" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          <strong className="mono text-cyan">PROBABILITY NOTICE:</strong> Root-cause findings displayed below are computed via statistical correlation over actual detected defect types and inspection history. They represent <strong>probable contributing processes</strong> rather than a confirmed physical mechanical failure. Physical verification by plant technicians is required.
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Computing real root-cause correlations from inspection database...
        </div>
      ) : !hasData ? (
        <div className="empty-state-banner">
          <GitFork size={32} className="text-cyan" style={{ margin: '0 auto 12px' }} />
          <div className="empty-state-title">No Defect Root-Cause Correlated Yet</div>
          <p className="empty-state-sub">
            {rootData?.message || 'Inspect a notebook specimen with a visible defect to establish real root-cause process correlations.'}
          </p>
        </div>
      ) : (
        /* Real Correlated Hotspot Card */
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
            <span className="badge badge-warn mono">
              <AlertTriangle size={13} /> CONTRIBUTING PROCESS CORRELATION
            </span>
            <span className="badge badge-cyan mono">
              SAMPLE: {hotspot.totalInspections} REAL SCANS
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '24px' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>
                DETECTED DEFECT FOCUS
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--status-defect)' }}>
                {hotspot.defectType}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Occurrences: {hotspot.defectCount} recorded ({hotspot.defectRate})
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>
                POSSIBLE CONTRIBUTING PROCESS
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--blue-slate)' }}>
                {hotspot.process}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Confidence: <span className="mono">{hotspot.confidence}</span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>
                RECOMMENDED PREVENTIVE ACTION
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                {hotspot.recommendedAction}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '20px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
            <div>HYPOTHESIS: {hotspot.probableCause}</div>
            <div className="mono text-muted">{hotspot.disclaimer}</div>
          </div>
        </div>
      )}
    </div>
  );
}
