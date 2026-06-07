'use client';

import React, { useState, useEffect } from 'react';

// ── Types ──
interface PlaybookData {
  markets: string[];
  timeframes: string[];
  trading_style: string;
  market_environment: string;
  best_session: string;
  macro_invalidation: string;
  entry_trigger: string;
  entry_confirmation: string;
  entry_filters: string;
  entry_type: string;
  stop_placement: string;
  stop_type: string;
  stop_invalidation: string;
  target_1: string;
  target_2: string;
  min_rr: string;
  scale_out: string;
  trailing_stop: string;
  early_exit_rule: string;
  risk_percent: number;
  grade: string;
  grade_a_plus: string;
  grade_b: string;
  ideal_chart: string;
  failure_conditions: string;
  psychology_notes: string;
  common_mistakes: string;
}

interface Playbook {
  id: string;
  name: string;
  data: PlaybookData;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// ── Constants ──
const MAX_PLAYBOOKS = 8;

const MARKETS = ['Stocks', 'Indices', 'Options', 'Futures'];
const TIMEFRAMES = ['5m', '15m', '1h', '4h', 'daily'];
const ENTRY_TYPES = ['limit', 'market', 'stop'];
const STOP_TYPES = ['fixed', 'ATR', 'structure'];
const GRADES = ['A+', 'B'];
const ENVIRONMENTS = ['trending', 'ranging', 'volatile', 'low volatility'];

const EMPTY_DATA: PlaybookData = {
  markets: [],
  timeframes: [],
  trading_style: '',
  market_environment: '',
  best_session: '',
  macro_invalidation: '',
  entry_trigger: '',
  entry_confirmation: '',
  entry_filters: '',
  entry_type: '',
  stop_placement: '',
  stop_type: '',
  stop_invalidation: '',
  target_1: '',
  target_2: '',
  min_rr: '',
  scale_out: '',
  trailing_stop: '',
  early_exit_rule: '',
  risk_percent: 0,
  grade: '',
  grade_a_plus: '',
  grade_b: '',
  ideal_chart: '',
  failure_conditions: '',
  psychology_notes: '',
  common_mistakes: '',
};

const FORM_TABS = [
  { key: 'identity', label: '🏷 Identity', fields: ['name', 'markets', 'timeframes', 'trading_style'] },
  { key: 'conditions', label: '📊 Market Conditions', fields: ['market_environment', 'best_session', 'macro_invalidation'] },
  { key: 'entry', label: '🎯 Entry Rules', fields: ['entry_trigger', 'entry_confirmation', 'entry_filters', 'entry_type'] },
  { key: 'stop', label: '🛑 Stop Loss', fields: ['stop_placement', 'stop_type', 'stop_invalidation'] },
  { key: 'targets', label: '💰 Targets & Exit', fields: ['target_1', 'target_2', 'min_rr', 'scale_out', 'trailing_stop', 'early_exit_rule'] },
  { key: 'sizing', label: '⚖️ Position Sizing', fields: ['risk_percent', 'grade'] },
  { key: 'grading', label: '⭐ Grading', fields: ['grade_a_plus', 'grade_b', 'ideal_chart'] },
  { key: 'notes', label: '📝 Notes', fields: ['psychology_notes', 'common_mistakes', 'failure_conditions'] },
];

const LABELS: Record<string, string> = {
  name: 'Name',
  markets: 'Markets',
  timeframes: 'Timeframes',
  trading_style: 'Trading Style',
  market_environment: 'Market Environment',
  best_session: 'Best Session',
  macro_invalidation: 'Macro Invalidation',
  entry_trigger: 'Entry Trigger',
  entry_confirmation: 'Entry Confirmation',
  entry_filters: 'Entry Filters',
  entry_type: 'Entry Type',
  stop_placement: 'Stop Placement',
  stop_type: 'Stop Type',
  stop_invalidation: 'Stop Invalidation',
  target_1: 'Target 1',
  target_2: 'Target 2',
  min_rr: 'Minimum R:R',
  scale_out: 'Scale Out',
  trailing_stop: 'Trailing Stop',
  early_exit_rule: 'Early Exit Rule',
  risk_percent: 'Risk %',
  grade: 'Grade',
  grade_a_plus: 'A+ Criteria',
  grade_b: 'B Criteria',
  ideal_chart: 'Ideal Chart',
  failure_conditions: 'Failure Conditions',
  psychology_notes: 'Psychology Notes',
  common_mistakes: 'Common Mistakes',
};

const TEXTAREA_FIELDS = new Set([
  'macro_invalidation', 'entry_trigger', 'entry_confirmation', 'entry_filters',
  'stop_placement', 'stop_invalidation', 'target_1', 'target_2', 'scale_out',
  'trailing_stop', 'early_exit_rule', 'grade_a_plus', 'grade_b',
  'failure_conditions', 'psychology_notes', 'common_mistakes',
]);

const NUMBER_FIELDS = new Set(['risk_percent']);

const TAG_FIELDS: Record<string, string[]> = {
  markets: MARKETS,
  timeframes: TIMEFRAMES,
};

const SELECT_FIELDS: Record<string, string[]> = {
  entry_type: ENTRY_TYPES,
  stop_type: STOP_TYPES,
  grade: GRADES,
  market_environment: ENVIRONMENTS,
};

// ── Component ──
export default function Playbooks() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [stats, setStats] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('identity');
  const [formName, setFormName] = useState('');
  const [formData, setFormData] = useState<PlaybookData>({ ...EMPTY_DATA });
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Playbook | null>(null);

  // ── Fetch playbooks ──
  const fetchPlaybooks = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/playbooks');
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (Array.isArray(data)) setPlaybooks(data);
      else setPlaybooks([]);
    } catch (err: any) {
      setError(err.message || 'Failed to load playbooks');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/playbooks/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data || {});
      }
    } catch {
      // Stats are non-critical; silently ignore
    }
  };

  useEffect(() => {
    fetchPlaybooks().then(() => fetchStats());
  }, []);

  const showToast = (msg: string, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Form helpers ──
  const openCreateForm = () => {
    if (playbooks.length >= MAX_PLAYBOOKS) return;
    setEditingId(null);
    setFormName('');
    setFormData({ ...EMPTY_DATA });
    setActiveTab('identity');
    setFormOpen(true);
  };

  const openEditForm = (pb: Playbook) => {
    setEditingId(pb.id);
    setFormName(pb.name);
    setFormData({ ...EMPTY_DATA, ...pb.data });
    setActiveTab('identity');
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setFormName('');
    setFormData({ ...EMPTY_DATA });
  };

  const updateFormField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleTag = (field: string, tag: string) => {
    setFormData(prev => {
      const current = (prev as any)[field] as string[];
      const next = current.includes(tag)
        ? current.filter((t: string) => t !== tag)
        : [...current, tag];
      return { ...prev, [field]: next };
    });
  };

  // ── Save ──
  const handleSave = async () => {
    if (!formName.trim()) {
      showToast('Please enter a playbook name', 'error');
      return;
    }

    setSaving(true);
    try {
      const body: any = { name: formName.trim(), data: formData };

      if (editingId) {
        body.id = editingId;
        const res = await fetch('/api/playbooks', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(await res.text());
        showToast('Playbook updated', 'success');
      } else {
        const res = await fetch('/api/playbooks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(await res.text());
        showToast('Playbook created', 'success');
      }

      await fetchPlaybooks();
      closeForm();
    } catch (err: any) {
      showToast(err.message || 'Failed to save playbook', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──
  const confirmDelete = (pb: Playbook) => {
    setDeleteTarget(pb);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/playbooks?id=${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      showToast(`"${deleteTarget.name}" deleted`, 'success');
      setPlaybooks(prev => prev.filter(p => p.id !== deleteTarget.id));
      if (editingId === deleteTarget.id) closeForm();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete playbook', 'error');
    } finally {
      setDeleteTarget(null);
    }
  };

  const isAtLimit = playbooks.length >= MAX_PLAYBOOKS;

  // ── Render form field ──
  const renderField = (field: string) => {
    const label = LABELS[field] || field;
    const value = (formData as any)[field];

    // Tag multi-select
    if (TAG_FIELDS[field]) {
      const options = TAG_FIELDS[field];
      const selected = value as string[];
      return (
        <div className="pb-field" key={field}>
          <label className="pb-field-label">{label}</label>
          <div className="pb-chips">
            {options.map(opt => (
              <button
                key={opt}
                className={`pb-chip ${selected.includes(opt) ? 'active' : ''}`}
                onClick={() => toggleTag(field, opt)}
                type="button"
              >
                {selected.includes(opt) && <span className="pb-chip-check">✓</span>}
                {opt}
              </button>
            ))}
          </div>
        </div>
      );
    }

    // Select dropdown
    if (SELECT_FIELDS[field]) {
      const options = SELECT_FIELDS[field];
      return (
        <div className="pb-field" key={field}>
          <label className="pb-field-label">{label}</label>
          <select
            className="pb-input pb-select"
            value={value}
            onChange={e => updateFormField(field, e.target.value)}
          >
            <option value="">— Select —</option>
            {options.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      );
    }

    // Number field
    if (NUMBER_FIELDS.has(field)) {
      return (
        <div className="pb-field" key={field}>
          <label className="pb-field-label">{label}</label>
          <input
            type="number"
            className="pb-input"
            value={value || ''}
            onChange={e => updateFormField(field, e.target.value === '' ? '' : Number(e.target.value))}
            placeholder={`Enter ${label.toLowerCase()}`}
            step="any"
          />
        </div>
      );
    }

    // Textarea
    if (TEXTAREA_FIELDS.has(field)) {
      return (
        <div className="pb-field" key={field}>
          <label className="pb-field-label">{label}</label>
          <textarea
            className="pb-input pb-textarea"
            value={value || ''}
            onChange={e => updateFormField(field, e.target.value)}
            placeholder={`Enter ${label.toLowerCase()}`}
            rows={3}
          />
        </div>
      );
    }

    // Default: text input
    return (
      <div className="pb-field" key={field}>
        <label className="pb-field-label">{label}</label>
        <input
          type="text"
          className="pb-input"
          value={value || ''}
          onChange={e => updateFormField(field, e.target.value)}
          placeholder={`Enter ${label.toLowerCase()}`}
        />
      </div>
    );
  };

  // ── Render a playbook card ──
  const renderCard = (pb: Playbook) => {
    const d: PlaybookData = pb.data || EMPTY_DATA;
    const grade = d.grade || '';
    const isAPlus = grade === 'A+';
    const isB = grade === 'B';
    const style = d.trading_style || '';
    const markets = d.markets || [];

    const computedStats = stats[pb.id];
    const hasStats = computedStats && computedStats.total_trades > 0;
    const winRate = hasStats ? computedStats.win_rate : null;
    const avgRr = hasStats ? computedStats.avg_rr : null;
    const tradeCount = hasStats ? computedStats.total_trades : null;

    const gradeBorder = isAPlus ? 'pb-card-grade-a' : isB ? 'pb-card-grade-b' : '';

    // Excerpt from entry_trigger (first ~80 chars)
    const excerpt = d.entry_trigger
      ? d.entry_trigger.length > 80 ? d.entry_trigger.slice(0, 80) + '…' : d.entry_trigger
      : '';

    return (
      <div key={pb.id} className={`section ${gradeBorder}`} style={{padding:'0',overflow:'hidden',marginBottom:'16px'}}>
        <div style={{padding:'18px 20px'}}>
          {/* Top row: name + actions */}
          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'10px',marginBottom:'10px'}}>
            <h3 style={{fontSize:'15px',fontWeight:700,color:'var(--text)',letterSpacing:'-0.3px',lineHeight:1.3,wordBreak:'break-word'}}>{pb.name}</h3>
            <div className="pb-card-actions">
              <button
                className="pb-card-action-btn"
                onClick={() => openEditForm(pb)}
                title="Edit"
              >
                ✎
              </button>
              <button
                className="pb-card-action-btn pb-card-action-delete"
                onClick={() => confirmDelete(pb)}
                title="Delete"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Description excerpt */}
          {excerpt && (
            <p style={{fontSize:'12px',color:'var(--text-secondary)',lineHeight:1.5,margin:'0 0 10px 0',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{excerpt}</p>
          )}

          {/* Style badge + Grade badge */}
          <div style={{display:'flex',flexWrap:'wrap',gap:'6px',marginBottom:'8px'}}>
            {style && (
              <span className="badge" style={{background:'var(--brand-light)',color:'var(--brand)'}}>{style}</span>
            )}
            {grade && (
              <span className={`badge ${isAPlus ? 'win' : ''}`} style={isAPlus ? {} : {background:'var(--surface)',color:'var(--text-secondary)',border:'1px solid var(--border)'}}>{grade}</span>
            )}
          </div>

          {/* Markets */}
          {markets.length > 0 && (
            <div style={{display:'flex',flexWrap:'wrap',gap:'4px',marginBottom:'10px'}}>
              {markets.map((m: string) => (
                <span key={m} className="pb-card-tag">{m}</span>
              ))}
            </div>
          )}

          {/* Stats: two stat-pills side by side */}
          <div style={{display:'flex',gap:'10px',marginBottom:'10px'}}>
            <div className="stat-pill" style={{flex:1}}>
              <span className="label">Win Rate</span>
              <span className="value" style={hasStats && winRate! >= 50 ? {color:'var(--green)'} : {}}>{hasStats ? `${winRate}%` : '\u2014'}</span>
            </div>
            <div className="stat-pill" style={{flex:1}}>
              <span className="label">Avg R:R</span>
              <span className="value">{hasStats ? avgRr : '\u2014'}</span>
            </div>
          </div>

          {/* Trade count + live indicator */}
          {hasStats && (
            <div style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'11px',marginBottom:'8px'}}>
              <span style={{color:'var(--text-secondary)',fontWeight:500}}>{tradeCount} trade{tradeCount !== 1 ? 's' : ''}</span>
              <span className="pb-live-badge" title="Computed from tagged trades">● live</span>
            </div>
          )}

          {/* Footer: updated date + default badge */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',paddingTop:'4px'}}>
            <span style={{fontSize:'11px',color:'var(--text-secondary)'}}>
              Updated {new Date(pb.updated_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            {pb.is_default && <span className="pb-card-default-badge">Default</span>}
          </div>
        </div>
      </div>
    );
  };

  // ── Main render ──
  return (
    <div>
      <style>{PB_STYLES}</style>

      {/* Header */}
      <div className="section" style={{marginBottom:'20px'}}>
        <div className="section-header">
          <div>
            <div className="section-title">Playbooks</div>
            <div className="section-subtitle">{loading ? 'Loading\u2026' : `Tracking ${playbooks.length} setup${playbooks.length !== 1 ? 's' : ''}`}</div>
          </div>
          <button className="import-btn" onClick={openCreateForm} disabled={isAtLimit}
            title={isAtLimit ? 'Maximum 8 playbooks reached' : 'Create a new playbook'}>
            + New Setup
          </button>
        </div>
        {isAtLimit && <div style={{fontSize:'12px',color:'var(--text-secondary)',padding:'8px 12px',background:'var(--surface)',borderRadius:'var(--radius-sm)',marginTop:'8px',border:'1px solid var(--border)'}}>8/8 setups — maximum reached. Delete a playbook to create a new one.</div>}
      </div>

      {/* Create/Edit Form */}
      {formOpen && (
        <div className="premarket-card" style={{marginBottom:'20px',animation:'pbSlideDown 0.25s ease'}}>
          <div className="premarket-header">
            <div>
              <div style={{fontSize:'15px',fontWeight:700,color:'var(--brand)'}}>
                {editingId ? `Edit: ${formName}` : 'New Playbook Setup'}
              </div>
              <div style={{fontSize:'12px',color:'var(--text-secondary)',marginTop:'2px'}}>Fill out each section to define your setup</div>
            </div>
            <button onClick={closeForm} style={{width:'30px',height:'30px',border:'none',background:'transparent',color:'var(--text-secondary)',cursor:'pointer',fontSize:'18px',borderRadius:'var(--radius-sm)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>✕</button>
          </div>

          {/* Name field (always visible) */}
          <div style={{padding:'16px 20px 0',display:'flex',gap:'12px'}}>
            <div className="pb-field" style={{flex:1}}>
              <label className="pb-field-label">Playbook Name</label>
              <input
                type="text"
                className="pb-input pb-input-lg"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="e.g. Opening Range Breakout"
                autoFocus
              />
            </div>
          </div>

          {/* Tabs */}
          <div style={{display:'flex',borderBottom:'1px solid var(--border)',padding:'0 20px',marginTop:'12px',overflowX:'auto'}}>
            {FORM_TABS.map(tab => (
              <div key={tab.key}
                className={`nav-tab ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
                style={{padding:'10px 16px',fontSize:'12px',cursor:'pointer'}}>
                {tab.label}
              </div>
            ))}
          </div>

          {/* Tab content */}
          <div className="pb-tab-content" key={activeTab}>
            {FORM_TABS.find(t => t.key === activeTab)?.fields.map(field => renderField(field))}
          </div>

          {/* Footer */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:'10px',padding:'14px 20px',borderTop:'1px solid var(--border)',background:'var(--surface)'}}>
            <span style={{fontSize:'12px',color:'var(--text-secondary)',marginRight:'auto'}}>All changes are saved when you click Update</span>
            <button onClick={closeForm} style={{padding:'7px 16px',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',background:'var(--bg)',color:'var(--text-secondary)',fontSize:'13px',cursor:'pointer'}}>Cancel</button>
            <button className="import-btn" onClick={handleSave} disabled={saving || !formName.trim()}
              style={{fontSize:'13px'}}>
              {saving ? 'Saving…' : editingId ? 'Update Playbook' : 'Create Playbook'}
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="pb-loading">
          <div className="pb-loading-spinner"></div>
          <span>Loading playbooks...</span>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="pb-error">
          <span className="pb-error-icon">⚠</span>
          <span>{error}</span>
          <button className="pb-retry-btn" onClick={fetchPlaybooks}>Retry</button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && playbooks.length === 0 && !formOpen && (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h3 className="empty-title">No playbooks yet</h3>
          <p className="empty-sub">Create your first trading setup to track and repeat winning patterns. Playbooks help you systematize your edge and trade with confidence.</p>
          <button className="import-btn" onClick={openCreateForm} style={{marginTop:'16px'}}>+ Create First Setup</button>
        </div>
      )}

      {/* Card grid */}
      {!loading && !error && playbooks.length > 0 && (
        <div className="pb-grid">
          {playbooks.map(pb => renderCard(pb))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div className="pb-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="pb-dialog" onClick={e => e.stopPropagation()}>
            <div className="pb-dialog-title">Delete Playbook</div>
            <div className="pb-dialog-body">
              Are you sure you want to delete <strong>&ldquo;{deleteTarget.name}&rdquo;</strong>? This action cannot be undone.
            </div>
            <div className="pb-dialog-actions">
              <button className="pb-btn-cancel" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="pb-btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{position:'fixed',bottom:'24px',right:'24px',zIndex:9999}}>
          <div className={`toast-msg ${toast.type}`}>{toast.msg}</div>
        </div>
      )}
    </div>
  );
}

// ── Styles ──
const PB_STYLES = `
  /* ═══════════════════════════════════════════════════
     PLAYBOOKS — Scoped Component Styles
     ═══════════════════════════════════════════════════ */

  /* ── Card grade left-border accents ── */
  .pb-card-grade-a {
    border-left: 3px solid var(--green) !important;
  }
  .pb-card-grade-b {
    border-left: 3px solid var(--border) !important;
  }

  /* ── Card Grid ── */
  .pb-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  @media (max-width: 768px) {
    .pb-grid { grid-template-columns: 1fr; }
  }

  /* override global stat-pill min-width inside playbook cards */
  @media (max-width: 1024px) {
    .pb-grid .stat-pill { min-width: 0; flex: 1 1 auto; }
  }

  /* ── Card action buttons (hover reveal) ── */
  .pb-card-actions {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.2s ease;
    flex-shrink: 0;
  }
  .section:hover .pb-card-actions {
    opacity: 1;
  }
  .pb-card-action-btn {
    width: 28px;
    height: 28px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg);
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    padding: 0;
  }
  .pb-card-action-btn:hover {
    background: var(--surface);
    border-color: #c0c0c0;
    color: var(--text);
  }
  .pb-card-action-delete:hover {
    background: var(--red-bg);
    border-color: var(--red);
    color: var(--red);
  }

  /* ── Card market tags ── */
  .pb-card-tag {
    font-size: 10px;
    font-weight: 500;
    color: var(--text-secondary);
    background: var(--surface);
    border: 1px solid var(--border);
    padding: 2px 8px;
    border-radius: 10px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  /* ── Card default badge ── */
  .pb-card-default-badge {
    font-size: 10px;
    font-weight: 600;
    color: var(--brand);
    background: var(--brand-light);
    padding: 2px 8px;
    border-radius: 10px;
  }

  /* ── Live badge ── */
  .pb-live-badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 10px;
    font-weight: 600;
    color: var(--brand);
    background: var(--brand-light);
    padding: 2px 8px;
    border-radius: 10px;
    letter-spacing: 0.1px;
  }

  /* ── Form slide-down animation ── */
  @keyframes pbSlideDown {
    from { opacity: 0; transform: translateY(-8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* ── Tab content fade transition ── */
  .pb-tab-content {
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    animation: pbFadeTab 0.2s ease;
  }
  @keyframes pbFadeTab {
    from { opacity: 0; transform: translateX(4px); }
    to { opacity: 1; transform: translateX(0); }
  }

  /* ── Form fields ── */
  .pb-field {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .pb-field-label {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .pb-input {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 8px 10px;
    font-family: var(--font);
    font-size: 13px;
    background: var(--bg);
    color: var(--text);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  .pb-input:focus {
    outline: none;
    border-color: var(--brand);
    box-shadow: 0 0 0 3px var(--brand-light);
  }
  .pb-input-lg {
    font-size: 15px;
    font-weight: 600;
    padding: 10px 12px;
  }
  .pb-textarea {
    resize: vertical;
    min-height: 60px;
  }
  .pb-select {
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23737373' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
    background-position: right 8px center;
    background-repeat: no-repeat;
    background-size: 16px;
    padding-right: 32px;
  }

  /* ── Tag Chips (multi-select) ── */
  .pb-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .pb-chip {
    padding: 5px 12px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--bg);
    font-size: 11px;
    font-weight: 500;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-family: var(--font);
  }
  .pb-chip:hover {
    border-color: var(--brand);
    color: var(--text);
  }
  .pb-chip.active {
    background: var(--brand-light);
    border-color: var(--brand);
    color: var(--brand);
    font-weight: 600;
  }
  .pb-chip-check {
    font-size: 9px;
    color: var(--brand);
  }

  /* ── Cancel & Danger buttons ── */
  .pb-btn-cancel {
    padding: 8px 16px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg);
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: var(--font);
  }
  .pb-btn-cancel:hover {
    border-color: #c0c0c0;
    color: var(--text);
  }
  .pb-btn-danger {
    padding: 8px 16px;
    border: none;
    border-radius: var(--radius-sm);
    background: var(--red);
    color: white;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: var(--font);
  }
  .pb-btn-danger:hover {
    background: #b91c1c;
  }

  /* ── Loading ── */
  .pb-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 40px 20px;
    color: var(--text-secondary);
    font-size: 13px;
  }
  .pb-loading-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid var(--border);
    border-top-color: var(--brand);
    border-radius: 50%;
    animation: pbSpin 0.6s linear infinite;
  }
  @keyframes pbSpin {
    to { transform: rotate(360deg); }
  }

  /* ── Error ── */
  .pb-error {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 18px;
    background: var(--red-bg);
    border: 1px solid var(--red);
    border-radius: var(--radius-sm);
    color: var(--red);
    font-size: 13px;
  }
  .pb-error-icon {
    font-size: 18px;
    flex-shrink: 0;
  }
  .pb-retry-btn {
    margin-left: auto;
    padding: 5px 12px;
    border: 1px solid currentColor;
    border-radius: var(--radius-sm);
    background: transparent;
    color: inherit;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: var(--font);
  }
  .pb-retry-btn:hover {
    background: var(--red);
    color: white;
    border-color: var(--red);
  }

  /* ── Delete Dialog ── */
  .pb-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.45);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: pbFadeIn 0.15s ease;
  }
  @keyframes pbFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .pb-dialog {
    background: var(--bg);
    border-radius: var(--radius);
    box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    width: 90%;
    max-width: 400px;
    overflow: hidden;
    animation: pbScaleIn 0.2s ease;
  }
  @keyframes pbScaleIn {
    from { transform: scale(0.95); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
  .pb-dialog-title {
    font-size: 16px;
    font-weight: 700;
    padding: 20px 20px 0;
    color: var(--text);
  }
  .pb-dialog-body {
    padding: 12px 20px;
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.6;
  }
  .pb-dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 20px 16px;
  }

  /* ── Responsive ── */
  @media (max-width: 768px) {
    .pb-card-actions {
      opacity: 1;
    }
  }
`;
