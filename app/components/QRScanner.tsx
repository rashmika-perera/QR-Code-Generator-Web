'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import jsQR from 'jsqr';

// ── Content Detection ─────────────────────────────────────────
interface DetectedContent {
  type: 'url' | 'email' | 'phone' | 'sms' | 'wifi' | 'vcard' | 'geo' | 'event' | 'text';
  label: string;
  icon: string;
  raw: string;
  parsed: Record<string, string>;
}

function detectContent(data: string): DetectedContent {
  const trimmed = data.trim();

  // URL
  if (/^https?:\/\//i.test(trimmed)) {
    return { type: 'url', label: 'Website URL', icon: '🔗', raw: trimmed, parsed: { url: trimmed } };
  }

  // mailto
  if (/^mailto:/i.test(trimmed)) {
    const match = trimmed.match(/^mailto:([^?]+)(?:\?(.*))?$/i);
    const email = match?.[1] || '';
    const params = new URLSearchParams(match?.[2] || '');
    return {
      type: 'email', label: 'Email', icon: '✉️', raw: trimmed,
      parsed: { email, subject: params.get('subject') || '', body: params.get('body') || '' },
    };
  }

  // tel
  if (/^tel:/i.test(trimmed)) {
    const phone = trimmed.replace(/^tel:/i, '');
    return { type: 'phone', label: 'Phone Number', icon: '📞', raw: trimmed, parsed: { phone } };
  }

  // SMS
  if (/^smsto:/i.test(trimmed)) {
    const parts = trimmed.replace(/^smsto:/i, '').split(':');
    return {
      type: 'sms', label: 'SMS Message', icon: '💬', raw: trimmed,
      parsed: { phone: parts[0] || '', message: parts[1] || '' },
    };
  }

  // Wi-Fi
  if (/^WIFI:/i.test(trimmed)) {
    const ssid = trimmed.match(/S:([^;]*)/)?.[1] || '';
    const password = trimmed.match(/P:([^;]*)/)?.[1] || '';
    const auth = trimmed.match(/T:([^;]*)/)?.[1] || '';
    const hidden = trimmed.match(/H:([^;]*)/)?.[1] || '';
    return {
      type: 'wifi', label: 'Wi-Fi Network', icon: '📶', raw: trimmed,
      parsed: { ssid, password, auth, hidden },
    };
  }

  // vCard
  if (/^BEGIN:VCARD/i.test(trimmed)) {
    const name = trimmed.match(/FN:(.+)/i)?.[1] || '';
    const phone = trimmed.match(/TEL:(.+)/i)?.[1] || '';
    const email = trimmed.match(/EMAIL:(.+)/i)?.[1] || '';
    const org = trimmed.match(/ORG:(.+)/i)?.[1] || '';
    const title = trimmed.match(/TITLE:(.+)/i)?.[1] || '';
    const url = trimmed.match(/URL:(.+)/i)?.[1] || '';
    return {
      type: 'vcard', label: 'Contact Card', icon: '👤', raw: trimmed,
      parsed: { name, phone, email, org, title, url },
    };
  }

  // Geo
  if (/^geo:/i.test(trimmed)) {
    const coords = trimmed.replace(/^geo:/i, '').split(',');
    return {
      type: 'geo', label: 'Location', icon: '📍', raw: trimmed,
      parsed: { lat: coords[0] || '', lng: coords[1] || '' },
    };
  }

  // Calendar event
  if (/^BEGIN:VEVENT/i.test(trimmed)) {
    const summary = trimmed.match(/SUMMARY:(.+)/i)?.[1] || '';
    const dtstart = trimmed.match(/DTSTART:(.+)/i)?.[1] || '';
    const dtend = trimmed.match(/DTEND:(.+)/i)?.[1] || '';
    const location = trimmed.match(/LOCATION:(.+)/i)?.[1] || '';
    const description = trimmed.match(/DESCRIPTION:(.+)/i)?.[1] || '';
    return {
      type: 'event', label: 'Calendar Event', icon: '📅', raw: trimmed,
      parsed: { summary, dtstart, dtend, location, description },
    };
  }

  // Plain text
  return { type: 'text', label: 'Plain Text', icon: '📝', raw: trimmed, parsed: { text: trimmed } };
}

// ── Scanner Component ─────────────────────────────────────────
interface QRScannerProps {
  onClose: () => void;
}

export default function QRScanner({ onClose }: QRScannerProps) {
  const [mode, setMode] = useState<'camera' | 'upload'>('camera');
  const [result, setResult] = useState<DetectedContent | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanLine, setScanLine] = useState(0);
  const [copied, setCopied] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [history, setHistory] = useState<DetectedContent[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number>(0);

  // Scan animation
  useEffect(() => {
    if (scanning) {
      const interval = setInterval(() => {
        setScanLine(s => (s >= 100 ? 0 : s + 1.5));
      }, 20);
      return () => clearInterval(interval);
    }
  }, [scanning]);

  // Lock body scroll when scanner is open
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = 0;
    }
    setCameraActive(false);
    setScanning(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError('');
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        setScanning(true);
        scanFrame();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (msg.includes('NotAllowed') || msg.includes('Permission')) {
        setCameraError('Camera permission denied. Please allow camera access in your browser settings.');
      } else if (msg.includes('NotFound') || msg.includes('DevicesNotFound')) {
        setCameraError('No camera found. Please connect a camera or try image upload.');
      } else {
        setCameraError(`Camera error: ${msg}`);
      }
    }
  }, []);

  const scanFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });

    if (code) {
      const detected = detectContent(code.data);
      setResult(detected);
      setHistory(prev => [detected, ...prev.filter(h => h.raw !== detected.raw)].slice(0, 20));
      setScanning(false);
      // Don't stop camera — user may want to scan more
      return;
    }

    animRef.current = requestAnimationFrame(scanFrame);
  }, []);

  // Start camera when mode switches to camera
  useEffect(() => {
    if (mode === 'camera' && !cameraActive && !result) {
      startCamera();
    }
    if (mode === 'upload') {
      stopCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const scanAgain = useCallback(() => {
    setResult(null);
    setScanning(true);
    scanFrame();
  }, [scanFrame]);

  const handleImageUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });
        if (code) {
          const detected = detectContent(code.data);
          setResult(detected);
          setHistory(prev => [detected, ...prev.filter(h => h.raw !== detected.raw)].slice(0, 20));
        } else {
          setResult({
            type: 'text', label: 'No QR Found', icon: '⚠️',
            raw: 'Could not detect a QR code in this image. Try a clearer image.',
            parsed: { text: '' },
          });
        }
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleImageUpload(file);
    }
  }, [handleImageUpload]);

  const copyToClipboard = useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.raw);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  }, [result]);

  const openAction = useCallback(() => {
    if (!result) return;
    switch (result.type) {
      case 'url':
        window.open(result.raw, '_blank', 'noopener');
        break;
      case 'email':
        window.open(result.raw, '_self');
        break;
      case 'phone':
        window.open(result.raw, '_self');
        break;
      case 'sms':
        window.open(`sms:${result.parsed.phone}?body=${encodeURIComponent(result.parsed.message)}`, '_self');
        break;
      case 'geo':
        window.open(`https://www.google.com/maps?q=${result.parsed.lat},${result.parsed.lng}`, '_blank');
        break;
      default:
        break;
    }
  }, [result]);

  const getActionLabel = () => {
    if (!result) return '';
    switch (result.type) {
      case 'url': return 'Open URL';
      case 'email': return 'Compose Email';
      case 'phone': return 'Call Number';
      case 'sms': return 'Send SMS';
      case 'geo': return 'Open in Maps';
      default: return '';
    }
  };

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="scanner-overlay" onTouchMove={e => {
      // Allow scrolling inside scanner-body, block scrolling on the overlay itself
      const target = e.target as HTMLElement;
      if (!target.closest('.scanner-body') && !target.closest('.scanner-history-list')) {
        e.preventDefault();
      }
    }}>
      <div className="scanner-modal">
        {/* Header */}
        <div className="scanner-header">
          <div className="scanner-title-wrap">
            <div className="scanner-icon-wrap">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M4 7V4h3" /><path d="M20 7V4h-3" />
                <path d="M4 17v3h3" /><path d="M20 17v3h-3" />
                <line x1="4" y1="12" x2="20" y2="12" opacity="0.5" />
              </svg>
            </div>
            <div>
              <h2 className="scanner-title">QR Scanner</h2>
              <p className="scanner-subtitle">Scan or upload a QR code to decode</p>
            </div>
          </div>
          <button className="scanner-close-btn" onClick={() => { stopCamera(); onClose(); }} aria-label="Close scanner">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="scanner-tabs">
          <button
            className={`scanner-tab${mode === 'camera' ? ' active' : ''}`}
            onClick={() => { setResult(null); setMode('camera'); }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            Camera
          </button>
          <button
            className={`scanner-tab${mode === 'upload' ? ' active' : ''}`}
            onClick={() => { setResult(null); setMode('upload'); }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload Image
          </button>
        </div>

        {/* Content Area */}
        <div className="scanner-body">
          {/* Camera View */}
          {mode === 'camera' && !result && (
            <div className="scanner-camera-wrap">
              {cameraError ? (
                <div className="scanner-error">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5">
                    <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
                  </svg>
                  <p>{cameraError}</p>
                  <button className="scanner-retry-btn" onClick={startCamera}>Try Again</button>
                </div>
              ) : (
                <>
                  <video ref={videoRef} className="scanner-video" playsInline muted />
                  <canvas ref={canvasRef} className="scanner-canvas-hidden" />
                  {/* Scanning overlay */}
                  <div className="scanner-viewfinder">
                    <div className="viewfinder-corner tl" />
                    <div className="viewfinder-corner tr" />
                    <div className="viewfinder-corner bl" />
                    <div className="viewfinder-corner br" />
                    {scanning && (
                      <div className="scan-line" style={{ top: `${scanLine}%` }} />
                    )}
                  </div>
                  <div className="scanner-status">
                    <span className="scanner-pulse" />
                    Scanning…
                  </div>
                </>
              )}
            </div>
          )}

          {/* Upload View */}
          {mode === 'upload' && !result && (
            <div
              className={`scanner-upload-zone${dragOver ? ' drag-over' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && fileRef.current?.click()}
            >
              <div className="upload-icon-circle">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </div>
              <p className="upload-title">Drop QR code image here</p>
              <p className="upload-hint">or click to browse files</p>
              <div className="upload-formats">
                <span>PNG</span><span>JPG</span><span>WEBP</span><span>SVG</span>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleImageUpload(f);
                }}
              />
            </div>
          )}

          {/* Result View */}
          {result && (
            <div className="scanner-result animate-in">
              <div className="result-badge">
                <span className="result-icon">{result.icon}</span>
                <span className="result-type">{result.label}</span>
                {result.label !== 'No QR Found' && (
                  <span className="result-check">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                )}
              </div>

              {/* Parsed Content */}
              {result.type === 'url' && (
                <div className="result-content-card">
                  <p className="result-url">{result.parsed.url}</p>
                </div>
              )}
              {result.type === 'wifi' && (
                <div className="result-content-card">
                  <div className="result-field"><span className="rf-label">Network</span><span className="rf-value">{result.parsed.ssid}</span></div>
                  <div className="result-field"><span className="rf-label">Password</span><span className="rf-value mono">{result.parsed.password || '—'}</span></div>
                  <div className="result-field"><span className="rf-label">Security</span><span className="rf-value">{result.parsed.auth || 'Open'}</span></div>
                </div>
              )}
              {result.type === 'vcard' && (
                <div className="result-content-card">
                  {result.parsed.name && <div className="result-field"><span className="rf-label">Name</span><span className="rf-value">{result.parsed.name}</span></div>}
                  {result.parsed.phone && <div className="result-field"><span className="rf-label">Phone</span><span className="rf-value">{result.parsed.phone}</span></div>}
                  {result.parsed.email && <div className="result-field"><span className="rf-label">Email</span><span className="rf-value">{result.parsed.email}</span></div>}
                  {result.parsed.org && <div className="result-field"><span className="rf-label">Organization</span><span className="rf-value">{result.parsed.org}</span></div>}
                  {result.parsed.title && <div className="result-field"><span className="rf-label">Title</span><span className="rf-value">{result.parsed.title}</span></div>}
                </div>
              )}
              {result.type === 'email' && (
                <div className="result-content-card">
                  <div className="result-field"><span className="rf-label">To</span><span className="rf-value">{result.parsed.email}</span></div>
                  {result.parsed.subject && <div className="result-field"><span className="rf-label">Subject</span><span className="rf-value">{result.parsed.subject}</span></div>}
                </div>
              )}
              {result.type === 'phone' && (
                <div className="result-content-card">
                  <div className="result-field"><span className="rf-label">Number</span><span className="rf-value">{result.parsed.phone}</span></div>
                </div>
              )}
              {result.type === 'sms' && (
                <div className="result-content-card">
                  <div className="result-field"><span className="rf-label">To</span><span className="rf-value">{result.parsed.phone}</span></div>
                  {result.parsed.message && <div className="result-field"><span className="rf-label">Message</span><span className="rf-value">{result.parsed.message}</span></div>}
                </div>
              )}
              {result.type === 'geo' && (
                <div className="result-content-card">
                  <div className="result-field"><span className="rf-label">Latitude</span><span className="rf-value mono">{result.parsed.lat}</span></div>
                  <div className="result-field"><span className="rf-label">Longitude</span><span className="rf-value mono">{result.parsed.lng}</span></div>
                </div>
              )}
              {result.type === 'event' && (
                <div className="result-content-card">
                  {result.parsed.summary && <div className="result-field"><span className="rf-label">Event</span><span className="rf-value">{result.parsed.summary}</span></div>}
                  {result.parsed.dtstart && <div className="result-field"><span className="rf-label">Start</span><span className="rf-value">{result.parsed.dtstart}</span></div>}
                  {result.parsed.dtend && <div className="result-field"><span className="rf-label">End</span><span className="rf-value">{result.parsed.dtend}</span></div>}
                  {result.parsed.location && <div className="result-field"><span className="rf-label">Location</span><span className="rf-value">{result.parsed.location}</span></div>}
                </div>
              )}
              {result.type === 'text' && result.parsed.text && (
                <div className="result-content-card">
                  <p className="result-raw-text">{result.raw}</p>
                </div>
              )}
              {result.type === 'text' && !result.parsed.text && (
                <div className="result-content-card error-card">
                  <p className="result-raw-text">{result.raw}</p>
                </div>
              )}

              {/* Raw Data */}
              {result.label !== 'No QR Found' && (
                <div className="result-raw">
                  <span className="result-raw-label">RAW DATA</span>
                  <code className="result-raw-code">{result.raw.length > 200 ? result.raw.slice(0, 200) + '…' : result.raw}</code>
                </div>
              )}

              {/* Action Buttons */}
              <div className="result-actions">
                {getActionLabel() && (
                  <button className="result-action-btn primary" onClick={openAction}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                    {getActionLabel()}
                  </button>
                )}
                <button className="result-action-btn" onClick={copyToClipboard}>
                  {copied ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      Copy
                    </>
                  )}
                </button>
                <button className="result-action-btn" onClick={() => { setResult(null); if (mode === 'camera') scanAgain(); }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                  Scan Again
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Scan History */}
        {history.length > 0 && (
          <div className="scanner-history">
            <div className="scanner-history-header">
              <span className="section-label" style={{ margin: 0 }}>RECENT SCANS</span>
              <button className="scanner-history-clear" onClick={() => setHistory([])}>Clear</button>
            </div>
            <div className="scanner-history-list">
              {history.slice(0, 5).map((item, i) => (
                <button
                  key={`${item.raw}-${i}`}
                  className="scanner-history-item"
                  onClick={() => setResult(item)}
                >
                  <span className="shi-icon">{item.icon}</span>
                  <div className="shi-content">
                    <span className="shi-type">{item.label}</span>
                    <span className="shi-data">{item.raw.length > 50 ? item.raw.slice(0, 50) + '…' : item.raw}</span>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.4">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
