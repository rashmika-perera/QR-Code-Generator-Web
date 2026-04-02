'use client';

import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import JSZip from 'jszip';

interface QRBatchProps {
  onClose: () => void;
  options: {
    fgColor: string;
    bgColor: string;
    size: number;
    errorLevel: 'L' | 'M' | 'Q' | 'H';
    margin: number;
    logoDataUrl: string | null;
    logoSize: number;
  };
}

export default function QRBatch({ onClose, options }: QRBatchProps) {
  const [text, setText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);

  // Lock body scroll
  useEffect(() => {
    const scrollY = window.scrollY;
    document.body.classList.add('scanner-open');
    document.body.style.top = `-${scrollY}px`;

    return () => {
      document.body.classList.remove('scanner-open');
      document.body.style.top = '';
      window.scrollTo(0, scrollY);
    };
  }, []);

  const generateSingleQR = async (data: string): Promise<string> => {
    const canvas = document.createElement('canvas');
    await QRCode.toCanvas(canvas, data, {
      width: options.size,
      margin: options.margin,
      errorCorrectionLevel: options.errorLevel,
      color: { dark: options.fgColor, light: options.bgColor },
    });

    if (options.logoDataUrl) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const img = new Image();
        await new Promise((resolve) => {
          img.onload = () => {
            const ls = (options.size * options.logoSize) / 100;
            const x = (options.size - ls) / 2;
            const y = (options.size - ls) / 2;
            const p = ls * 0.15;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.roundRect(x - p, y - p, ls + p * 2, ls + p * 2, 8);
            ctx.fill();
            ctx.drawImage(img, x, y, ls, ls);
            resolve(null);
          };
          img.src = options.logoDataUrl as string;
        });
      }
    }

    const dataUrl = canvas.toDataURL('image/png');
    return dataUrl.split(',')[1];
  };

  const handleGenerateZip = async () => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;

    setGenerating(true);
    setTotal(lines.length);
    setProgress(0);

    const zip = new JSZip();

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        try {
           const base64Data = await generateSingleQR(line);
           let filename = line.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
           if (!filename) filename = `qr_${i}`;
           zip.file(`${filename}_${i}.png`, base64Data, {base64: true});
        } catch (e) {
           console.error(e);
        }
        setProgress(i + 1);
    }

    const content = await zip.generateAsync({type: 'blob'});
    const url = window.URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr_batch_${Date.now()}.zip`;
    a.click();
    window.URL.revokeObjectURL(url);

    setGenerating(false);
  };

  return (
    <div className="scanner-overlay" onTouchMove={e => {
        const target = e.target as HTMLElement;
        if (!target.closest('.scanner-body')) e.preventDefault();
      }}>
      <div className="scanner-modal">
        {/* Header */}
        <div className="scanner-header">
          <div className="scanner-title-wrap">
            <div className="qr-logo-icon">
              <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
                <rect x="2" y="2" width="10" height="10" rx="2.5" fill="currentColor" opacity="0.95" />
                <rect x="4.5" y="4.5" width="5" height="5" rx="1" fill="rgba(0,0,0,0.25)" />
                <rect x="16" y="2" width="10" height="10" rx="2.5" fill="currentColor" opacity="0.95" />
                <rect x="18.5" y="4.5" width="5" height="5" rx="1" fill="rgba(0,0,0,0.25)" />
                <rect x="2" y="16" width="10" height="10" rx="2.5" fill="currentColor" opacity="0.95" />
                <rect x="4.5" y="18.5" width="5" height="5" rx="1" fill="rgba(0,0,0,0.25)" />
                <rect x="16" y="16" width="4" height="4" rx="1" fill="currentColor" opacity="0.8" />
                <rect x="22" y="16" width="4" height="4" rx="1" fill="currentColor" opacity="0.8" />
                <rect x="16" y="22" width="4" height="4" rx="1" fill="currentColor" opacity="0.8" />
                <rect x="22" y="22" width="4" height="4" rx="1" fill="currentColor" opacity="0.8" />
              </svg>
            </div>
            <div>
              <h2 className="scanner-title">Batch Generator</h2>
              <p className="scanner-subtitle">Generate multiple QRs and download as ZIP</p>
            </div>
          </div>
          <button className="scanner-close-btn" onClick={onClose} aria-label="Close batch modal">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content Area */}
        <div className="scanner-body">
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label" htmlFor="batch-input">List of Data (URLs, text, etc.)</label>
            <textarea
              id="batch-input"
              className="form-textarea"
              placeholder="https://example.com&#10;https://google.com&#10;Some text data"
              rows={10}
              value={text}
              onChange={e => setText(e.target.value)}
              disabled={generating}
              style={{ fontFamily: 'monospace', whiteSpace: 'pre' }}
            />
            <span className="form-hint">Enter each item on a new line. Current count: {text.split('\n').filter(l => l.trim()).length}</span>
          </div>

          {generating && (
            <div style={{ marginBottom: '20px', padding: '16px', borderRadius: '8px', background: 'var(--surface2)', border: '1px solid var(--border)' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600 }}>
                 <span>Generating...</span>
                 <span>{progress} / {total}</span>
               </div>
               <div style={{ height: '6px', background: 'var(--surface3)', borderRadius: '3px', overflow: 'hidden' }}>
                 <div style={{
                    height: '100%',
                    background: 'var(--primary)',
                    width: `${(progress / total) * 100}%`,
                    transition: 'width 0.2s',
                 }} />
               </div>
            </div>
          )}

          <button
            className="qr-action-btn primary"
            style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
            onClick={handleGenerateZip}
            disabled={!text.trim() || generating}
          >
            {generating ? (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                </svg>
                Processing...
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Generate & Download ZIP
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
