import React, { useEffect, useRef, useState } from 'react';

// ─── Inline styles (no CSS-module dependency) ────────────────────────────────
const AUTO_DISMISS_MS = 8000; // 8 s before auto-close

function formatSQL(sql = '') {
  // Simple keyword highlighter – returns an array of spans
  const keywords = [
    'SELECT','FROM','WHERE','JOIN','LEFT','INNER','ON','INSERT','INTO',
    'VALUES','UPDATE','SET','DELETE','ORDER BY','GROUP BY','HAVING',
    'LIMIT','OFFSET','AND','OR','NOT','IN','LIKE','IS','NULL',
    'COUNT','SUM','AVG','MAX','MIN','DISTINCT','AS','ROUND','ASC','DESC',
  ];
  const re = new RegExp(`\\b(${keywords.join('|')})\\b`, 'gi');
  const parts = [];
  let last = 0;
  let match;
  while ((match = re.exec(sql)) !== null) {
    if (match.index > last) parts.push({ text: sql.slice(last, match.index), kw: false });
    parts.push({ text: match[0].toUpperCase(), kw: true });
    last = match.index + match[0].length;
  }
  if (last < sql.length) parts.push({ text: sql.slice(last), kw: false });
  return parts;
}

// One query card
function QueryCard({ entry, index }) {
  const { sql, params } = entry;
  const parts = formatSQL(sql);
  return (
    <div style={styles.card}>
      <div style={styles.queryIndex}>Query #{index + 1}</div>
      <pre style={styles.pre}>
        {parts.map((p, i) =>
          p.kw
            ? <span key={i} style={styles.keyword}>{p.text}</span>
            : <span key={i} style={styles.literal}>{p.text}</span>
        )}
      </pre>
      {params && params.length > 0 && (
        <div style={styles.params}>
          <span style={styles.paramsLabel}>Params: </span>
          <span style={styles.paramsVal}>[{params.map(p => JSON.stringify(p)).join(', ')}]</span>
        </div>
      )}
    </div>
  );
}

// The toast popup itself
export default function SqlQueryToast() {
  const [queries, setQueries]   = useState([]);   // current batch
  const [visible, setVisible]   = useState(false);
  const [exiting, setExiting]   = useState(false);
  const timerRef  = useRef(null);
  const exitTimer = useRef(null);

  const dismiss = () => {
    clearTimeout(timerRef.current);
    clearTimeout(exitTimer.current);
    setExiting(true);
    exitTimer.current = setTimeout(() => {
      setVisible(false);
      setExiting(false);
      setQueries([]);
    }, 350); // matches CSS transition duration
  };

  useEffect(() => {
    const handler = (e) => {
      const incoming = Array.isArray(e.detail) ? e.detail : [];
      if (!incoming.length) return;

      clearTimeout(timerRef.current);
      clearTimeout(exitTimer.current);
      setExiting(false);
      setQueries(incoming);
      setVisible(true);

      // Auto-dismiss
      timerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS);
    };

    window.addEventListener('sql-queries-executed', handler);
    return () => window.removeEventListener('sql-queries-executed', handler);
  }, []);

  if (!visible) return null;

  return (
    <div style={{
      ...styles.overlay,
      opacity:    exiting ? 0 : 1,
      transform:  exiting ? 'translateY(30px)' : 'translateY(0)',
      transition: 'opacity 0.35s ease, transform 0.35s ease',
    }}>
      {/* ── Header ── */}
      <div style={styles.header}>
        <span style={styles.title}>
          🗃️ SQL Executed&nbsp;
          <span style={styles.badge}>{queries.length} quer{queries.length === 1 ? 'y' : 'ies'}</span>
        </span>
        <div style={styles.headerRight}>
          <div style={styles.timerBar} />
          <button onClick={dismiss} style={styles.closeBtn} title="Close">✕</button>
        </div>
      </div>

      {/* ── Query list ── */}
      <div style={styles.body}>
        {queries.map((q, i) => (
          <QueryCard key={i} entry={q} index={i} />
        ))}
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  overlay: {
    position:     'fixed',
    bottom:       '24px',
    right:        '24px',
    zIndex:       99999,
    width:        'min(520px, calc(100vw - 48px))',
    maxHeight:    '60vh',
    display:      'flex',
    flexDirection:'column',
    background:   '#0d1117',
    border:       '1px solid #30363d',
    borderRadius: '10px',
    boxShadow:    '0 8px 32px rgba(0,0,0,.6)',
    overflow:     'hidden',
    fontFamily:   '"Fira Code", "Cascadia Code", "JetBrains Mono", Consolas, monospace',
  },
  header: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:        '10px 14px',
    background:     '#161b22',
    borderBottom:   '1px solid #30363d',
    flexShrink:     0,
  },
  title: {
    color:      '#58a6ff',
    fontSize:   '13px',
    fontWeight: 600,
    display:    'flex',
    alignItems: 'center',
    gap:        '6px',
  },
  badge: {
    background:   '#1f6feb',
    color:        '#e6edf3',
    borderRadius: '10px',
    padding:      '1px 8px',
    fontSize:     '11px',
    fontWeight:   700,
  },
  headerRight: {
    display:    'flex',
    alignItems: 'center',
    gap:        '10px',
  },
  timerBar: {
    width:        '60px',
    height:       '3px',
    background:   '#21262d',
    borderRadius: '2px',
    position:     'relative',
    overflow:     'hidden',
    // The animated shrink is handled via a CSS @keyframes injected below
  },
  closeBtn: {
    background:   'none',
    border:       'none',
    color:        '#8b949e',
    cursor:       'pointer',
    fontSize:     '16px',
    lineHeight:   1,
    padding:      '0 2px',
    transition:   'color .15s',
  },
  body: {
    overflowY:  'auto',
    padding:    '10px 12px 12px',
    display:    'flex',
    flexDirection: 'column',
    gap:        '10px',
  },
  card: {
    background:   '#0d1117',
    border:       '1px solid #21262d',
    borderRadius: '6px',
    padding:      '10px 12px',
  },
  queryIndex: {
    color:        '#3fb950',
    fontSize:     '10px',
    fontWeight:   700,
    textTransform:'uppercase',
    letterSpacing:'0.05em',
    marginBottom: '6px',
  },
  pre: {
    margin:       0,
    whiteSpace:   'pre-wrap',
    wordBreak:    'break-word',
    fontSize:     '12px',
    lineHeight:   '1.6',
    color:        '#e6edf3',
  },
  keyword: {
    color:      '#ff7b72',
    fontWeight: 700,
  },
  literal: {
    color: '#79c0ff',
  },
  params: {
    marginTop:  '6px',
    fontSize:   '11px',
    color:      '#8b949e',
  },
  paramsLabel: {
    color:      '#d2a8ff',
    fontWeight: 600,
  },
  paramsVal: {
    color: '#ffa657',
  },
};

// Inject timer-bar animation once
if (typeof document !== 'undefined') {
  const id = '__sql-toast-styles__';
  if (!document.getElementById(id)) {
    const s = document.createElement('style');
    s.id = id;
    s.textContent = `
      @keyframes sql-timer-shrink {
        from { width: 100%; }
        to   { width: 0%; }
      }
      [data-sql-timer]::after {
        content: '';
        display: block;
        height: 100%;
        width: 100%;
        background: #58a6ff;
        border-radius: 2px;
        animation: sql-timer-shrink ${AUTO_DISMISS_MS}ms linear forwards;
      }
    `;
    document.head.appendChild(s);
  }
}
