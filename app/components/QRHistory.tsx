'use client';

import React from 'react';

export interface HistoryItem {
  id: string;
  type: string;
  data: string;
  timestamp: number;
  thumbnail: string;
  label: string;
  starred: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  url: 'URL', text: 'Text', email: 'Email', phone: 'Phone',
  sms: 'SMS', wifi: 'Wi-Fi', vcard: 'vCard', location: 'Location', event: 'Event',
};

function timeAgo(ts: number): string {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

interface Props {
  items: HistoryItem[];
  onRestore: (item: HistoryItem) => void;
  onDelete: (id: string) => void;
  onStar: (id: string) => void;
  onClear: () => void;
}

export default function QRHistory({ items, onRestore, onDelete, onStar, onClear }: Props) {
  return (
    <div className="history-panel animate-in">
      <div className="history-header">
        <h3>History ({items.length})</h3>
        {items.length > 0 && (
          <button className="history-clear-btn" onClick={onClear}>Clear all</button>
        )}
      </div>
      <div className="history-list">
        {items.length === 0 ? (
          <p className="history-empty">No history yet. Generate a QR code and save it!</p>
        ) : (
          // Starred first
          [...items].sort((a, b) => Number(b.starred) - Number(a.starred)).map(item => (
            <div key={item.id} className="history-item" onClick={() => onRestore(item)} role="button" tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && onRestore(item)}>
              {/* Thumbnail */}
              {item.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.thumbnail} alt="QR thumbnail" className="history-thumb" />
              ) : (
                <div className="history-thumb" style={{ background: 'var(--surface3)' }} />
              )}
              {/* Info */}
              <div className="history-info">
                <div className="history-label" title={item.label}>{item.label}</div>
                <div className="history-meta">
                  <span className="history-type-badge">{TYPE_LABELS[item.type] ?? item.type}</span>
                  <span className="history-time">{timeAgo(item.timestamp)}</span>
                </div>
              </div>
              {/* Actions */}
              <div className="history-actions" onClick={e => e.stopPropagation()}>
                <button
                  className={`history-btn ${item.starred ? 'starred' : ''}`}
                  title={item.starred ? 'Unstar' : 'Star'}
                  onClick={() => onStar(item.id)}
                  aria-label={item.starred ? 'Unstar' : 'Star'}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill={item.starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </button>
                <button className="history-btn delete" title="Delete" onClick={() => onDelete(item.id)} aria-label="Delete">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
