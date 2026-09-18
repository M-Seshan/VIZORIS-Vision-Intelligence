// src/components/InspectionHistoryView.jsx
import React, { useState, useMemo } from 'react';
import { 
  Search, 
  RotateCcw,
  FileCheck,
  Layers
} from 'lucide-react';

export function InspectionHistoryView({ inspections = [], onSelectInspection, onOpenPassport }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');

  const filtered = useMemo(() => {
    return inspections.filter(item => {
      // Search by ID or defect
      if (search) {
        const q = search.toLowerCase();
        const matchesId = item.id?.toLowerCase().includes(q) || item.productId?.toLowerCase().includes(q);
        const matchesDefect = item.defects?.some(d => 
          d.type?.toLowerCase().includes(q) || 
          d.label?.toLowerCase().includes(q)
        );
        if (!matchesId && !matchesDefect) return false;
      }

      // Status filter
      if (statusFilter !== 'ALL' && item.status !== statusFilter) {
        return false;
      }

      // Severity filter
      if (severityFilter !== 'ALL') {
        const itemSev = item.defects?.[0]?.severity || (item.status === 'PASSED' ? 'NOMINAL' : 'UNKNOWN');
        if (itemSev.toUpperCase() !== severityFilter.toUpperCase()) return false;
      }

      return true;
    });
  }, [inspections, search, statusFilter, severityFilter]);

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setSeverityFilter('ALL');
  };

  return (
    <div className="history-container">
      {/* Top Filter Bar */}
      <div className="history-filter-bar">
        <div className="search-box-wrapper">
          <Search size={15} className="text-muted" />
          <input 
            type="text" 
            className="search-input mono" 
            placeholder="Search by Inspection ID (e.g. VIZ-2026-0001) or defect type..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-controls-group mono">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label className="text-muted">STATUS:</label>
            <select 
              value={statusFilter} 
              onChange={e => setStatusFilter(e.target.value)}
              className="filter-select"
            >
              <option value="ALL">All Records</option>
              <option value="PASSED">Passed (✓)</option>
              <option value="DEFECT DETECTED">Defect (⚠)</option>
              <option value="LOW CONFIDENCE">Low Confidence (?)</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label className="text-muted">SEVERITY:</label>
            <select 
              value={severityFilter} 
              onChange={e => setSeverityFilter(e.target.value)}
              className="filter-select"
            >
              <option value="ALL">All Severities</option>
              <option value="NOMINAL">Nominal (Pass)</option>
              <option value="MINOR">Minor</option>
              <option value="MODERATE">Moderate</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>

          <button className="btn btn-secondary btn-sm" onClick={resetFilters} title="Reset filters">
            <RotateCcw size={13} /> Reset
          </button>
        </div>
      </div>

      {/* History Table */}
      <div className="data-table-card">
        {inspections.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Layers size={32} className="text-cyan" style={{ marginBottom: '12px' }} />
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
              No Real Inspections Recorded
            </div>
            <div style={{ fontSize: '12px' }}>
              Captured scans from your mobile notebook scanner will appear here automatically.
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '36px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No inspection records match the current search filters.
          </div>
        ) : (
          <table className="history-table">
            <thead>
              <tr>
                <th>IMAGE</th>
                <th>INSPECTION ID</th>
                <th>PRODUCT</th>
                <th>SCAN TIME</th>
                <th>STATUS</th>
                <th>DEFECT TYPE</th>
                <th>SEVERITY</th>
                <th>QUALITY SCORE</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const isDef = item.status === 'DEFECT DETECTED';
                const isPass = item.status === 'PASSED';
                const primaryDef = item.defects?.[0] || null;

                return (
                  <tr 
                    key={item.id}
                    onClick={() => onSelectInspection(item)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <img 
                        src={item.image} 
                        alt={item.id} 
                        className="table-thumbnail" 
                      />
                    </td>
                    <td className="mono text-cyan font-bold">
                      {item.id}
                    </td>
                    <td>{item.productType || 'Notebook'}</td>
                    <td className="mono">
                      {new Date(item.timestamp).toLocaleString()}
                    </td>
                    <td>
                      <span className={`badge ${isPass ? 'badge-pass' : (isDef ? 'badge-defect' : 'badge-warn')}`}>
                        {item.status}
                      </span>
                    </td>
                    <td>
                      {isDef ? (primaryDef?.label || primaryDef?.type) : (isPass ? 'Zero Defect (Clean)' : 'Indeterminate')}
                    </td>
                    <td>
                      {isDef ? (
                        <span className={`badge badge-${primaryDef?.severity === 'CRITICAL' ? 'defect' : 'warn'}`}>
                          {primaryDef?.severity || 'MINOR'}
                        </span>
                      ) : (
                        <span className="badge badge-pass">NOMINAL</span>
                      )}
                    </td>
                    <td className="mono font-bold">
                      {item.qualityScore !== null ? `${item.qualityScore}%` : 'N/A'}
                    </td>
                    <td>
                      <button 
                        className="btn btn-secondary btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenPassport(item);
                        }}
                        title="View Digital Passport Certificate"
                      >
                        <FileCheck size={13} /> Passport
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
