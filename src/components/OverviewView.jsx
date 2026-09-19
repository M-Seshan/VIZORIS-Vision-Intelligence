// src/components/OverviewView.jsx
import React, { useState, useEffect } from 'react';
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
  Clock,
  Filter
} from 'lucide-react';

export function OverviewView({ metrics, scannerState, recentInspections = [], onSelectInspection, onNavigate }) {
  const [selectedRange, setSelectedRange] = useState('ALL');
  const [rangeStats, setRangeStats] = useState(null);
  const [loadingRange, setLoadingRange] = useState(false);

  // If a time-range filter is applied, query the backend stats endpoint for that exact range
  useEffect(() => {
    if (selectedRange === 'ALL') {
      setRangeStats(null);
      return;
    }
    setLoadingRange(true);
    fetch(`/api/inspections/stats?range=${selectedRange.toLowerCase()}`)
      .then(res => res.json())
      .then(data => {
        setRangeStats(data);
        setLoadingRange(false);
      })
      .catch(err => {
        console.error('Failed to fetch range stats:', err);
        setLoadingRange(false);
      });
  }, [selectedRange, metrics]);

  const activeStats = rangeStats || metrics;

  const totalInspections = activeStats?.totalInspections ?? activeStats?.totalInspected ?? 0;
  const passedSpecimens = activeStats?.passedSpecimens ?? activeStats?.passed ?? 0;
  const defectsDetected = activeStats?.defectsDetected ?? activeStats?.defective ?? 0;
  const hasData = totalInspections > 0;

  const firstPassYield = hasData 
    ? `${activeStats?.firstPassYield !== undefined ? activeStats.firstPassYield : ((passedSpecimens / totalInspections) * 100).toFixed(1)}%` 
    : '0%';

  const defectRate = hasData 
    ? `${activeStats?.defectRate !== undefined ? activeStats.defectRate : ((defectsDetected / totalInspections) * 100).toFixed(1)}%` 
    : '0%';

  const avgQualityScore = hasData 
    ? `${activeStats?.averageQualityScore ?? activeStats?.avgQualityScore ?? 0}%` 
    : '0%';

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

        <div className="hero-stats-ring">
          <div className="ring-val mono">
            {firstPassYield}
          </div>
          <div className="ring-lbl">FIRST-PASS YIELD</div>
        </div>
      </div>

      {/* Real Data & Date Filter Bar */}
      <div className="history-filter-bar" style={{ marginBottom: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-cyan mono">
            SOURCE: REAL NOTEBOOK SCANS ONLY
          </span>
          <span className="mono text-muted" style={{ fontSize: '11px' }}>
            {hasData ? `${totalInspections} persisted physical scans in database` : 'Zero synthetic / demo records'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={14} className="text-muted" />
          <span className="mono text-muted" style={{ fontSize: '11px' }}>TIME RANGE:</span>
          <select 
            value={selectedRange} 
            onChange={(e) => setSelectedRange(e.target.value)}
            className="filter-select mono"
            style={{ padding: '4px 10px', fontSize: '12px' }}
          >
            <option value="ALL">All-Time Scans</option>
            <option value="TODAY">Today Only</option>
            <option value="WEEK">Past 7 Days</option>
            <option value="MONTH">Past 30 Days</option>
          </select>
        </div>
      </div>

      {/* Primary KPI Grid — Strictly from Real Completed Inspections */}
      <div className="kpi-grid">
        {/* 1. Total Real Inspections */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">TOTAL REAL INSPECTIONS</span>
            <Layers size={18} className="text-cyan" />
          </div>
          <div className="kpi-value mono">
            {totalInspections}
          </div>
          <div className="kpi-subtext">
            {hasData ? 'Verified physical notebook scans' : 'Awaiting mobile scanner ingest'}
          </div>
        </div>

        {/* 2. Passed Specimens */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">PASSED SPECIMENS</span>
            <CheckCircle2 size={18} className="text-emerald" />
          </div>
          <div className="kpi-value mono text-emerald">
            {passedSpecimens}
          </div>
          <div className="kpi-subtext">
            {hasData ? `${firstPassYield} pass yield` : 'No passes recorded yet'}
          </div>
        </div>

        {/* 3. Defects Detected */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">DEFECTS DETECTED</span>
            <AlertOctagon size={18} className="text-rose" />
          </div>
          <div className="kpi-value mono text-rose">
            {defectsDetected}
          </div>
          <div className="kpi-subtext">
            {hasData ? `Defect rate: ${defectRate}` : 'No defects recorded yet'}
          </div>
        </div>

        {/* 4. First-Pass Yield */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">FIRST-PASS YIELD</span>
            <Percent size={18} className="text-emerald" />
          </div>
          <div className="kpi-value mono text-emerald">
            {firstPassYield}
          </div>
          <div className="kpi-subtext">
            {hasData ? `${passedSpecimens} of ${totalInspections} passed` : 'Calculated from completed scans'}
          </div>
        </div>

        {/* 5. Defect Rate */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">DEFECT RATE</span>
            <AlertOctagon size={18} className="text-rose" />
          </div>
          <div className="kpi-value mono text-rose">
            {defectRate}
          </div>
          <div className="kpi-subtext">
            {hasData ? `${defectsDetected} of ${totalInspections} defective` : 'Calculated from completed scans'}
          </div>
        </div>

        {/* 6. Average Quality Score */}
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
          <div className="empty-state-title">No Real Inspection Data Available Yet</div>
          <p className="empty-state-sub">
            The dashboard displays metrics strictly derived from real completed notebook scans. Zero synthetic or dummy records are used. Connect your phone via USB or upload a notebook image in Live Inspection to begin.
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
