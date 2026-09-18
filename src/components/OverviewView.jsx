// src/components/OverviewView.jsx
import React from 'react';
import { 
  CheckCircle2, 
  AlertOctagon, 
  Layers, 
  Percent, 
  Award, 
  Smartphone, 
  ArrowUpRight, 
  Sparkles, 
  UploadCloud,
  HelpCircle,
  Clock
} from 'lucide-react';

export function OverviewView({ metrics, scannerState, recentInspections = [], onSelectInspection, onNavigate }) {
  const hasData = metrics && metrics.totalInspected > 0;
  const totalInspected = metrics?.totalInspected || 0;
  const passed = metrics?.passed || 0;
  const defective = metrics?.defective || 0;
  const defectRate = metrics?.defectRate !== undefined ? `${metrics.defectRate}%` : '0%';
  const avgQualityScore = metrics?.avgQualityScore !== null && metrics?.avgQualityScore !== undefined 
    ? `${metrics.avgQualityScore}%` 
    : (hasData ? '100%' : 'N/A');

  const latestInspection = recentInspections[0] || null;

  return (
    <div className="overview-container">
      {/* Top Banner / Title Header */}
      <div className="overview-hero-card">
        <div className="hero-content">
          <div className="hero-tag">
            <Sparkles size={14} className="text-cyan" /> VISION INTELLIGENCE FOR ZERO-DEFECT MANUFACTURING
          </div>
          <h1 className="hero-title">
            VIZORIS — Notebook Quality Inspection System
          </h1>
          <p className="hero-desc">
            Computer vision quality monitoring for physical notebook production. Images captured from the mobile scanner app are analyzed for visible surface anomalies, pen marks, ink stains, torn pages, and binding alignment.
          </p>
          <div className="hero-actions">
            <button 
              className="btn btn-primary"
              onClick={() => onNavigate('live')}
            >
              Open Live Inspection Workspace <ArrowUpRight size={15} />
            </button>
            <button 
              className="btn btn-secondary"
              onClick={() => onNavigate('history')}
            >
              View Inspection History
            </button>
          </div>
        </div>

        {hasData && (
          <div className="hero-stats-ring">
            <div className="ring-val mono">
              {totalInspected > 0 ? `${((passed / totalInspected) * 100).toFixed(1)}%` : '—'}
            </div>
            <div className="ring-lbl">FIRST-PASS YIELD</div>
          </div>
        )}
      </div>

      {/* Primary KPI Grid — Strictly from Real Database */}
      <div className="kpi-grid">
        {/* Total Real Inspections */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">TOTAL REAL INSPECTIONS</span>
            <Layers size={18} className="text-cyan" />
          </div>
          <div className="kpi-value mono">
            {hasData ? totalInspected : 'No inspections yet'}
          </div>
          <div className="kpi-subtext">
            {hasData ? 'Verified physical notebook scans' : 'Awaiting mobile scanner ingest'}
          </div>
        </div>

        {/* Passed */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">PASSED SPECIMENS</span>
            <CheckCircle2 size={18} className="text-emerald" />
          </div>
          <div className="kpi-value mono text-emerald">
            {hasData ? passed : '—'}
          </div>
          <div className="kpi-subtext">
            {hasData ? `${((passed / totalInspected) * 100).toFixed(1)}% conformance rate` : 'No data recorded yet'}
          </div>
        </div>

        {/* Defects Detected */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">DEFECTS DETECTED</span>
            <AlertOctagon size={18} className="text-rose" />
          </div>
          <div className="kpi-value mono text-rose">
            {hasData ? defective : '—'}
          </div>
          <div className="kpi-subtext">
            {hasData ? `Defect rate: ${defectRate}` : 'No defects recorded yet'}
          </div>
        </div>

        {/* Average Quality Score */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">AVERAGE QUALITY SCORE</span>
            <Award size={18} className="text-cyan" />
          </div>
          <div className="kpi-value mono">
            {avgQualityScore}
          </div>
          <div className="kpi-subtext">
            {hasData ? 'Derived from actual CV results' : 'No scored inspections yet'}
          </div>
        </div>
      </div>

      {/* Empty State Banner if no real inspections exist */}
      {!hasData ? (
        <div className="empty-state-banner">
          <Smartphone size={36} className="text-cyan" />
          <div className="empty-state-title">No Notebook Inspections Recorded Yet</div>
          <p className="empty-state-sub">
            The live dashboard only displays real inspection data captured from your mobile scanner. Connect your Android phone via USB and take a notebook photo, or upload an image to begin.
          </p>
          <button 
            className="btn btn-primary"
            onClick={() => onNavigate('live')}
          >
            <UploadCloud size={15} /> Go to Live Inspection to Upload
          </button>
        </div>
      ) : (
        /* Actual Latest Inspection Card */
        latestInspection && (
          <div className="latest-inspection-card">
            <div className="latest-img-frame">
              <img src={latestInspection.image} alt={latestInspection.id} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span className="badge badge-cyan mono">LATEST INSPECTION</span>
                  <span className={`badge ${latestInspection.status === 'PASSED' ? 'badge-pass' : 'badge-defect'}`}>
                    {latestInspection.status}
                  </span>
                  <span className="mono text-muted" style={{ fontSize: '11px' }}>
                    <Clock size={12} style={{ display: 'inline', marginRight: '4px' }} />
                    {new Date(latestInspection.timestamp).toLocaleString()}
                  </span>
                </div>

                <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Product ID: <span className="mono text-cyan">{latestInspection.id}</span>
                </div>

                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Defect: <strong>{latestInspection.defects?.[0]?.label || (latestInspection.status === 'PASSED' ? 'None (Clean Notebook)' : 'None Flagged')}</strong>
                  {latestInspection.defects?.[0]?.severity && (
                    <span style={{ marginLeft: '12px' }}>
                      Severity: <span className="mono">{latestInspection.defects[0].severity}</span>
                    </span>
                  )}
                  <span style={{ marginLeft: '12px' }}>
                    Quality Score: <strong className="mono text-cyan">{latestInspection.qualityScore}%</strong>
                  </span>
                </div>
              </div>

              <div style={{ marginTop: '12px' }}>
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    onSelectInspection(latestInspection);
                    onNavigate('live');
                  }}
                >
                  View in Live Inspection Workspace <ArrowUpRight size={13} />
                </button>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}
