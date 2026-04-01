'use client';

import React, {
  useState, useEffect, useRef, useCallback,
} from 'react';
import QRCode from 'qrcode';
import QRHistory, { HistoryItem } from './QRHistory';
import ParticleBackground from './ParticleBackground';

// ── Types ────────────────────────────────────────────────────
type QRType = 'url' | 'text' | 'email' | 'phone' | 'sms' | 'wifi' | 'vcard' | 'location' | 'event';
type ErrorLevel = 'L' | 'M' | 'Q' | 'H';

interface QROptions {
  fgColor: string;
  bgColor: string;
  size: number;
  errorLevel: ErrorLevel;
  margin: number;
  logoDataUrl: string | null;
  logoSize: number;
}

interface FormData {
  url: { url: string; useUtm?: boolean; utmSource?: string; utmMedium?: string; utmCampaign?: string; utmTerm?: string; utmContent?: string };
  text: { text: string };
  email: { to: string; subject: string; body: string };
  phone: { phone: string };
  sms: { phone: string; message: string };
  wifi: { ssid: string; password: string; auth: 'WPA' | 'WEP' | 'nopass'; hidden: boolean };
  vcard: { firstName: string; lastName: string; phone: string; email: string; org: string; title: string; address: string; website: string };
  location: { lat: string; lng: string };
  event: { title: string; start: string; end: string; location: string; description: string };
}

// ── Constants ────────────────────────────────────────────────
const QR_TYPES: QRType[] = ['url', 'text', 'email', 'phone', 'sms', 'wifi', 'vcard', 'location', 'event'];

const TYPE_META: Record<QRType, { label: string; icon: React.ReactNode }> = {
  url: { label: 'URL', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg> },
  text: { label: 'Text', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" /></svg> },
  email: { label: 'Email', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 7l-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg> },
  phone: { label: 'Phone', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg> },
  sms: { label: 'SMS', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg> },
  wifi: { label: 'Wi-Fi', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0" /><path d="M1.42 9a16 16 0 0 1 21.16 0" /><path d="M8.53 16.11a6 6 0 0 1 6.95 0" /><line x1="12" y1="20" x2="12.01" y2="20" /></svg> },
  vcard: { label: 'vCard', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg> },
  location: { label: 'Location', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg> },
  event: { label: 'Event', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><path d="M8 14h.01" /><path d="M12 14h.01" /><path d="M16 14h.01" /><path d="M8 18h.01" /><path d="M12 18h.01" /><path d="M16 18h.01" /></svg> },
};

const DEFAULT_OPTIONS: QROptions = {
  fgColor: '#000000', bgColor: '#ffffff',
  size: 300, errorLevel: 'M', margin: 3,
  logoDataUrl: null, logoSize: 22,
};

const DEFAULT_FORM: FormData = {
  url: { url: '', useUtm: false, utmSource: '', utmMedium: '', utmCampaign: '', utmTerm: '', utmContent: '' },
  text: { text: '' },
  email: { to: '', subject: '', body: '' },
  phone: { phone: '' },
  sms: { phone: '', message: '' },
  wifi: { ssid: '', password: '', auth: 'WPA', hidden: false },
  vcard: { firstName: '', lastName: '', phone: '', email: '', org: '', title: '', address: '', website: '' },
  location: { lat: '', lng: '' },
  event: { title: '', start: '', end: '', location: '', description: '' },
};

// ── Data builder ─────────────────────────────────────────────
function buildQRData(type: QRType, fd: FormData): string {
  switch (type) {
    case 'url': {
      let u = fd.url.url.trim();
      if (!u) return '';
      u = /^https?:\/\//i.test(u) ? u : `https://${u}`;
      
      if (fd.url.useUtm) {
        try {
          const urlObj = new URL(u);
          if (fd.url.utmSource) urlObj.searchParams.set('utm_source', fd.url.utmSource);
          if (fd.url.utmMedium) urlObj.searchParams.set('utm_medium', fd.url.utmMedium);
          if (fd.url.utmCampaign) urlObj.searchParams.set('utm_campaign', fd.url.utmCampaign);
          if (fd.url.utmTerm) urlObj.searchParams.set('utm_term', fd.url.utmTerm);
          if (fd.url.utmContent) urlObj.searchParams.set('utm_content', fd.url.utmContent);
          u = urlObj.toString();
        } catch(e) { /* ignore invalid URL while typing */ }
      }
      return u;
    }
    case 'text': return fd.text.text;
    case 'email': {
      const { to, subject, body } = fd.email;
      if (!to) return '';
      const p = new URLSearchParams();
      if (subject) p.set('subject', subject);
      if (body) p.set('body', body);
      const q = p.toString();
      return `mailto:${to}${q ? '?' + q : ''}`;
    }
    case 'phone': return fd.phone.phone ? `tel:${fd.phone.phone}` : '';
    case 'sms': {
      const { phone, message } = fd.sms;
      return phone ? `smsto:${phone}:${message}` : '';
    }
    case 'wifi': {
      const { ssid, password, auth, hidden } = fd.wifi;
      if (!ssid) return '';
      return `WIFI:T:${auth};S:${ssid};P:${password};H:${hidden};;`;
    }
    case 'vcard': {
      const v = fd.vcard;
      if (!v.firstName && !v.lastName) return '';
      return [
        'BEGIN:VCARD', 'VERSION:3.0',
        `N:${v.lastName};${v.firstName};;;`,
        `FN:${[v.firstName, v.lastName].filter(Boolean).join(' ')}`,
        v.org ? `ORG:${v.org}` : '',
        v.title ? `TITLE:${v.title}` : '',
        v.phone ? `TEL:${v.phone}` : '',
        v.email ? `EMAIL:${v.email}` : '',
        v.address ? `ADR:;;${v.address};;;;` : '',
        v.website ? `URL:${v.website}` : '',
        'END:VCARD',
      ].filter(Boolean).join('\n');
    }
    case 'location': {
      const { lat, lng } = fd.location;
      return lat && lng ? `geo:${lat},${lng}` : '';
    }
    case 'event': {
      const e = fd.event;
      if (!e.title) return '';
      const fmt = (d: string) => d.replace(/[-:]/g, '').slice(0, 15);
      return [
        'BEGIN:VEVENT',
        `SUMMARY:${e.title}`,
        e.start ? `DTSTART:${fmt(e.start)}` : '',
        e.end ? `DTEND:${fmt(e.end)}` : '',
        e.location ? `LOCATION:${e.location}` : '',
        e.description ? `DESCRIPTION:${e.description}` : '',
        'END:VEVENT',
      ].filter(Boolean).join('\n');
    }
  }
}

function getLabel(type: QRType, fd: FormData): string {
  switch (type) {
    case 'url': return fd.url.url || 'URL';
    case 'text': return fd.text.text.slice(0, 30) || 'Text';
    case 'email': return fd.email.to || 'Email';
    case 'phone': return fd.phone.phone || 'Phone';
    case 'sms': return fd.sms.phone || 'SMS';
    case 'wifi': return fd.wifi.ssid || 'Wi-Fi';
    case 'vcard': return [fd.vcard.firstName, fd.vcard.lastName].filter(Boolean).join(' ') || 'vCard';
    case 'location': return `${fd.location.lat}, ${fd.location.lng}` || 'Location';
    case 'event': return fd.event.title || 'Event';
  }
}

// ── Toast ─────────────────────────────────────────────────────
interface Toast { id: number; message: string; type: 'success' | 'error' }

// ── Component ─────────────────────────────────────────────────
export default function QRGenerator() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activeType, setActiveType] = useState<QRType>('url');
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM);
  const [options, setOptions] = useState<QROptions>(DEFAULT_OPTIONS);
  const [qrData, setQrData] = useState('');
  const [svgString, setSvgString] = useState('');
  const [generating, setGenerating] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showCustomizer, setShowCustomizer] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const toastId = useRef(0);
  const fgRef = useRef<HTMLInputElement>(null);
  const bgRef = useRef<HTMLInputElement>(null);

  // Persist theme & history
  useEffect(() => {
    const t = localStorage.getItem('qr-theme') as 'dark' | 'light' | null;
    const h = localStorage.getItem('qr-history');
    if (t) setTheme(t);
    if (h) { try { setHistory(JSON.parse(h)); } catch { /* ignore */ } }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('qr-theme', theme);
  }, [theme]);

  // Generate QR
  const generateQR = useCallback(async () => {
    const data = buildQRData(activeType, formData);
    setQrData(data);
    if (!data || !canvasRef.current) return;
    setGenerating(true);
    try {
      await QRCode.toCanvas(canvasRef.current, data, {
        width: options.size,
        margin: options.margin,
        errorCorrectionLevel: options.errorLevel,
        color: { dark: options.fgColor, light: options.bgColor },
      });
      // Logo overlay
      if (options.logoDataUrl) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const img = new Image();
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
          };
          img.src = options.logoDataUrl;
        }
      }
      // SVG for download
      const svg = await QRCode.toString(data, {
        type: 'svg', margin: options.margin,
        errorCorrectionLevel: options.errorLevel,
        color: { dark: options.fgColor, light: options.bgColor },
      });
      setSvgString(svg);
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  }, [activeType, formData, options]);

  useEffect(() => {
    const t = setTimeout(generateQR, 280);
    return () => clearTimeout(t);
  }, [generateQR]);

  // Toast helper
  const toast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = ++toastId.current;
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  };

  // Save to history
  const saveToHistory = useCallback(() => {
    if (!canvasRef.current || !qrData) return;
    const thumb = canvasRef.current.toDataURL('image/png', 0.6);
    const item: HistoryItem = {
      id: String(Date.now()),
      type: activeType,
      data: qrData,
      timestamp: Date.now(),
      thumbnail: thumb,
      label: getLabel(activeType, formData),
      starred: false,
    };
    setHistory(prev => {
      const next = [item, ...prev.filter(h => h.data !== qrData)].slice(0, 30);
      localStorage.setItem('qr-history', JSON.stringify(next));
      return next;
    });
    toast('Saved to history ✓');
  }, [activeType, formData, qrData]);

  const downloadPNG = () => {
    if (!canvasRef.current || !qrData) return;
    const a = document.createElement('a');
    a.download = `qr-${activeType}-${Date.now()}.png`;
    a.href = canvasRef.current.toDataURL('image/png');
    a.click();
    toast('PNG downloaded ✓');
  };

  const downloadSVG = () => {
    if (!svgString || !qrData) return;
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = `qr-${activeType}-${Date.now()}.svg`;
    a.href = url; a.click();
    URL.revokeObjectURL(url);
    toast('SVG downloaded ✓');
  };

  const copyClipboard = () => {
    if (!canvasRef.current || !qrData) return;
    canvasRef.current.toBlob(async blob => {
      if (!blob) return;
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        toast('Copied to clipboard ✓');
      } catch {
        toast('Copy failed — try PNG download', 'error');
      }
    }, 'image/png');
  };

  const shareQR = () => {
    if (!canvasRef.current || !qrData) return;
    canvasRef.current.toBlob(async blob => {
      if (!blob) return;
      const file = new File([blob], 'qrcode.png', { type: 'image/png' });
      try {
        if (navigator.share && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'QR Code' });
        } else {
          toast('Share not supported — use Download', 'error');
        }
      } catch {
        toast('Share cancelled', 'error');
      }
    }, 'image/png');
  };

  const printQR = () => {
    if (!canvasRef.current || !qrData) return;
    const dataUrl = canvasRef.current.toDataURL();
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>QR Code</title>
      <style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;padding:20px}
      img{max-width:320px;border-radius:8px}p{margin-top:16px;color:#666;font-size:13px;word-break:break-all;max-width:320px;text-align:center}</style></head>
      <body><img src="${dataUrl}" /><p>${qrData}</p>
      <script>window.onload=()=>{window.print();window.close()}<\/script></body></html>`);
    win.document.close();
  };

  // Form updater
  function patch<T extends QRType>(type: T, diff: Partial<FormData[T]>) {
    setFormData(prev => ({ ...prev, [type]: { ...prev[type], ...diff } }));
  }

  // History actions
  const restoreHistory = (item: HistoryItem) => {
    setOptions(prev => ({ ...prev, ...item }));
    setShowHistory(false);
    toast('Restored from history ✓');
  };
  const deleteHistory = (id: string) => {
    setHistory(prev => {
      const next = prev.filter(h => h.id !== id);
      localStorage.setItem('qr-history', JSON.stringify(next));
      return next;
    });
  };
  const starHistory = (id: string) => {
    setHistory(prev => {
      const next = prev.map(h => h.id === id ? { ...h, starred: !h.starred } : h);
      localStorage.setItem('qr-history', JSON.stringify(next));
      return next;
    });
  };
  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('qr-history');
    toast('History cleared');
  };

  const hasQR = !!qrData;

  // ── Form renderer ──────────────────────────────────────────
  const renderForm = () => {
    switch (activeType) {
      case 'url':
        return (
          <div className="form-fields">
            <div className="form-group">
              <label className="form-label" htmlFor="input-url">Website URL</label>
              <input id="input-url" className="form-input" type="url" placeholder="https://example.com"
                value={formData.url.url} onChange={e => patch('url', { url: e.target.value })} />
              <span className="form-hint">Enter a full URL including https://</span>
            </div>
            
            <div className="form-group" style={{ marginTop: '8px' }}>
              <div className="toggle-wrap">
                <input type="checkbox" id="utm-toggle" className="toggle-input"
                  checked={formData.url.useUtm || false}
                  onChange={e => patch('url', { useUtm: e.target.checked })} />
                <label htmlFor="utm-toggle" className="toggle-label">
                  <span>Add UTM Tracking Parameters</span>
                </label>
              </div>
            </div>
            
            {formData.url.useUtm && (
              <div className="utm-builder-panel animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', background: 'var(--surface2)', borderRadius: '8px', border: '1px solid var(--border)', marginTop: '4px' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>Add campaign tracking tags to monitor analytics for this QR code.</p>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="utm-source">Campaign Source</label>
                    <input id="utm-source" className="form-input" type="text" placeholder="e.g. google, newsletter"
                      value={formData.url.utmSource || ''} onChange={e => patch('url', { utmSource: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="utm-medium">Campaign Medium</label>
                    <input id="utm-medium" className="form-input" type="text" placeholder="e.g. cpc, email, print"
                      value={formData.url.utmMedium || ''} onChange={e => patch('url', { utmMedium: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="utm-campaign">Campaign Name</label>
                  <input id="utm-campaign" className="form-input" type="text" placeholder="e.g. spring_sale"
                    value={formData.url.utmCampaign || ''} onChange={e => patch('url', { utmCampaign: e.target.value })} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="utm-term">Campaign Term</label>
                    <input id="utm-term" className="form-input" type="text" placeholder="e.g. running+shoes"
                      value={formData.url.utmTerm || ''} onChange={e => patch('url', { utmTerm: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="utm-content">Campaign Content</label>
                    <input id="utm-content" className="form-input" type="text" placeholder="e.g. logolink"
                      value={formData.url.utmContent || ''} onChange={e => patch('url', { utmContent: e.target.value })} />
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      case 'text':
        return (
          <div className="form-group">
            <label className="form-label" htmlFor="input-text">Text Content</label>
            <textarea id="input-text" className="form-textarea" placeholder="Enter any text…" rows={5}
              value={formData.text.text} onChange={e => patch('text', { text: e.target.value })} />
            <span className="form-hint">{formData.text.text.length} characters</span>
          </div>
        );
      case 'email':
        return (<>
          <div className="form-group">
            <label className="form-label" htmlFor="input-email-to">To</label>
            <input id="input-email-to" className="form-input" type="email" placeholder="user@example.com"
              value={formData.email.to} onChange={e => patch('email', { to: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="input-email-sub">Subject</label>
            <input id="input-email-sub" className="form-input" type="text" placeholder="Subject line"
              value={formData.email.subject} onChange={e => patch('email', { subject: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="input-email-body">Body</label>
            <textarea id="input-email-body" className="form-textarea" placeholder="Email body…" rows={3}
              value={formData.email.body} onChange={e => patch('email', { body: e.target.value })} />
          </div>
        </>);
      case 'phone':
        return (
          <div className="form-group">
            <label className="form-label" htmlFor="input-phone">Phone Number</label>
            <input id="input-phone" className="form-input" type="tel" placeholder="+1 555 000 0000"
              value={formData.phone.phone} onChange={e => patch('phone', { phone: e.target.value })} />
            <span className="form-hint">Include country code (+1, +44…)</span>
          </div>
        );
      case 'sms':
        return (<>
          <div className="form-group">
            <label className="form-label" htmlFor="input-sms-phone">Phone Number</label>
            <input id="input-sms-phone" className="form-input" type="tel" placeholder="+1 555 000 0000"
              value={formData.sms.phone} onChange={e => patch('sms', { phone: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="input-sms-msg">Message</label>
            <textarea id="input-sms-msg" className="form-textarea" placeholder="SMS message…" rows={3}
              value={formData.sms.message} onChange={e => patch('sms', { message: e.target.value })} />
          </div>
        </>);
      case 'wifi':
        return (<>
          <div className="form-group">
            <label className="form-label" htmlFor="input-wifi-ssid">Network Name (SSID)</label>
            <input id="input-wifi-ssid" className="form-input" type="text" placeholder="MyWiFiNetwork"
              value={formData.wifi.ssid} onChange={e => patch('wifi', { ssid: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="input-wifi-pw">Password</label>
            <input id="input-wifi-pw" className="form-input" type="password" placeholder="Network password"
              value={formData.wifi.password} onChange={e => patch('wifi', { password: e.target.value })} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="input-wifi-auth">Security</label>
              <select id="input-wifi-auth" className="form-select" value={formData.wifi.auth}
                onChange={e => patch('wifi', { auth: e.target.value as 'WPA' | 'WEP' | 'nopass' })}>
                <option value="WPA">WPA / WPA2</option>
                <option value="WEP">WEP</option>
                <option value="nopass">Open (None)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Hidden Network</label>
              <div className="toggle-wrap">
                <input type="checkbox" id="wifi-hidden" className="toggle-input"
                  checked={formData.wifi.hidden}
                  onChange={e => patch('wifi', { hidden: e.target.checked })} />
                <label htmlFor="wifi-hidden" className="toggle-label">
                  <span>{formData.wifi.hidden ? 'Hidden' : 'Visible'}</span>
                </label>
              </div>
            </div>
          </div>
        </>);
      case 'vcard':
        return (<>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="vc-fn">First Name</label>
              <input id="vc-fn" className="form-input" type="text" placeholder="John"
                value={formData.vcard.firstName} onChange={e => patch('vcard', { firstName: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="vc-ln">Last Name</label>
              <input id="vc-ln" className="form-input" type="text" placeholder="Doe"
                value={formData.vcard.lastName} onChange={e => patch('vcard', { lastName: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="vc-ph">Phone</label>
              <input id="vc-ph" className="form-input" type="tel" placeholder="+1 555 000 0000"
                value={formData.vcard.phone} onChange={e => patch('vcard', { phone: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="vc-em">Email</label>
              <input id="vc-em" className="form-input" type="email" placeholder="john@example.com"
                value={formData.vcard.email} onChange={e => patch('vcard', { email: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="vc-org">Organization</label>
              <input id="vc-org" className="form-input" type="text" placeholder="Company Inc."
                value={formData.vcard.org} onChange={e => patch('vcard', { org: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="vc-title">Job Title</label>
              <input id="vc-title" className="form-input" type="text" placeholder="Software Engineer"
                value={formData.vcard.title} onChange={e => patch('vcard', { title: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="vc-addr">Address</label>
            <input id="vc-addr" className="form-input" type="text" placeholder="123 Main St, City, Country"
              value={formData.vcard.address} onChange={e => patch('vcard', { address: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="vc-web">Website</label>
            <input id="vc-web" className="form-input" type="url" placeholder="https://example.com"
              value={formData.vcard.website} onChange={e => patch('vcard', { website: e.target.value })} />
          </div>
        </>);
      case 'location':
        return (<>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="loc-lat">Latitude</label>
              <input id="loc-lat" className="form-input" type="number" placeholder="37.7749" step="0.0001"
                value={formData.location.lat} onChange={e => patch('location', { lat: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="loc-lng">Longitude</label>
              <input id="loc-lng" className="form-input" type="number" placeholder="-122.4194" step="0.0001"
                value={formData.location.lng} onChange={e => patch('location', { lng: e.target.value })} />
            </div>
          </div>
          <div className="form-hint-box">💡 Right-click on Google Maps → &quot;What&apos;s here?&quot; to copy coordinates</div>
        </>);
      case 'event':
        return (<>
          <div className="form-group">
            <label className="form-label" htmlFor="ev-title">Event Title</label>
            <input id="ev-title" className="form-input" type="text" placeholder="Creative Workshop / Team Meeting"
              value={formData.event.title} onChange={e => patch('event', { title: e.target.value })} />
          </div>
          <div className="event-date-grid">
            <div className="form-group">
              <label className="form-label date-start" htmlFor="ev-start">
                <span className="dot"></span> Start Date & Time
              </label>
              <input id="ev-start" className="form-input" type="datetime-local"
                value={formData.event.start} onChange={e => patch('event', { start: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label date-end" htmlFor="ev-end">
                <span className="dot"></span> End Date & Time
              </label>
              <input id="ev-end" className="form-input" type="datetime-local"
                value={formData.event.end} onChange={e => patch('event', { end: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="ev-loc">Location</label>
            <div className="input-with-icon">
              <input id="ev-loc" className="form-input" type="text" placeholder="Conference Room / Online"
                value={formData.event.location} onChange={e => patch('event', { location: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="ev-desc">Description</label>
            <textarea id="ev-desc" className="form-textarea" placeholder="What is the event about?..." rows={3}
              value={formData.event.description} onChange={e => patch('event', { description: e.target.value })} />
          </div>
        </>);
    }
  };

  // ── JSX ───────────────────────────────────────────────────
  return (
    <div className="qr-app">
      <ParticleBackground />
      {/* ── Header ── */}
      <header className="qr-header" style={{ position: 'sticky', zIndex: 100 }}>
        <div className="qr-header-inner">
          <div className="qr-logo-wrap">
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
              <div className="qr-logo-title">QR Studio</div>
              <div className="qr-logo-sub">PROFESSIONAL QR GENERATOR</div>
            </div>
          </div>
          <div className="qr-header-actions">
            <button id="history-toggle-btn" className="icon-btn" onClick={() => setShowHistory(s => !s)} title="History" aria-label="Toggle history">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              {history.length > 0 && <span className="badge">{history.length}</span>}
            </button>
            <button id="theme-toggle-btn" className="icon-btn" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} title="Toggle theme" aria-label="Toggle theme">
              {theme === 'dark'
                ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="4.93" y1="4.93" x2="7.76" y2="7.76" /><line x1="16.24" y1="16.24" x2="19.07" y2="19.07" /><line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" /><line x1="4.93" y1="19.07" x2="7.76" y2="16.24" /><line x1="16.24" y1="7.76" x2="19.07" y2="4.93" /></svg>
                : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
              }
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Grid ── */}
      <main className="qr-main" style={{ position: 'relative', zIndex: 1 }}>
        {/* ─ Left Panel ─ */}
        <div className="qr-panel qr-panel-left">

          {/* History panel (toggle) */}
          {showHistory && (
            <QRHistory
              items={history}
              onRestore={restoreHistory}
              onDelete={deleteHistory}
              onStar={starHistory}
              onClear={clearHistory}
            />
          )}

          {/* Type Tabs */}
          <div className="panel-section animate-in">
            <p className="section-label">QR TYPE</p>
            <div className="type-tabs" role="tablist">
              {QR_TYPES.map(type => (
                <button
                  key={type}
                  id={`tab-${type}`}
                  role="tab"
                  aria-selected={activeType === type}
                  className={`type-tab${activeType === type ? ' active' : ''}`}
                  onClick={() => setActiveType(type)}
                >
                  <span className="type-tab-icon">{TYPE_META[type].icon}</span>
                  <span className="type-tab-label">{TYPE_META[type].label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Form */}
          <div className="panel-section animate-in" role="tabpanel" aria-labelledby={`tab-${activeType}`}>
            <p className="section-label">CONTENT</p>
            <div className="form-fields">{renderForm()}</div>
          </div>

          {/* Save Button */}
          <div className="panel-section animate-in">
            <button id="save-history-btn" className="generate-btn" onClick={saveToHistory} disabled={!hasQR}>
              Save to History
            </button>
          </div>
        </div>

        {/* ─ Right Panel ─ */}
        <div className="qr-panel qr-panel-right">

          {/* Preview */}
          <div className="panel-section animate-in">
            <p className="section-label">LIVE PREVIEW</p>
            <div className="qr-preview-card">
              <div className={`qr-canvas-wrap${hasQR ? ' has-qr' : ''}${generating ? ' generating' : ''}`}>
                {!hasQR && (
                  <div className="qr-placeholder">
                    <svg width="72" height="72" viewBox="0 0 64 64" fill="none" opacity="0.35">
                      <rect x="4" y="4" width="24" height="24" rx="4" stroke="currentColor" strokeWidth="2.5" />
                      <rect x="36" y="4" width="24" height="24" rx="4" stroke="currentColor" strokeWidth="2.5" />
                      <rect x="4" y="36" width="24" height="24" rx="4" stroke="currentColor" strokeWidth="2.5" />
                      <rect x="10" y="10" width="12" height="12" rx="2" fill="currentColor" />
                      <rect x="42" y="10" width="12" height="12" rx="2" fill="currentColor" />
                      <rect x="10" y="42" width="12" height="12" rx="2" fill="currentColor" />
                      <line x1="36" y1="36" x2="60" y2="36" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                      <line x1="36" y1="44" x2="56" y2="44" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                      <line x1="36" y1="52" x2="48" y2="52" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                    <p>Fill in the form to generate your QR code</p>
                  </div>
                )}
                <canvas ref={canvasRef} style={{ display: hasQR ? 'block' : 'none', maxWidth: '100%', borderRadius: '8px' }} />
              </div>
              {hasQR && (
                <div className="qr-data-preview">
                  <span className="qr-data-text">{qrData.length > 80 ? qrData.slice(0, 80) + '…' : qrData}</span>
                </div>
              )}
            </div>
          </div>

          {/* Export Buttons */}
          {hasQR && (
            <div className="panel-section animate-in">
              <p className="section-label">EXPORT</p>
              <div className="qr-actions">
                <button id="dl-png-btn" className="qr-action-btn primary" onClick={downloadPNG}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                  PNG
                </button>
                <button id="dl-svg-btn" className="qr-action-btn" onClick={downloadSVG}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                  SVG
                </button>
                <button id="copy-btn" className="qr-action-btn" onClick={copyClipboard}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                  Copy
                </button>
                <button id="share-btn" className="qr-action-btn" onClick={shareQR}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
                  Share
                </button>
                <button id="print-btn" className="qr-action-btn" onClick={printQR} style={{ gridColumn: 'span 2' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
                  Print QR Code
                </button>
              </div>
            </div>
          )}

          {/* Customizer */}
          <div className="panel-section animate-in">
            <button
              id="customizer-toggle-btn"
              className={`customizer-toggle${showCustomizer ? ' open' : ''}`}
              onClick={() => setShowCustomizer(s => !s)}
            >
              <span>CUSTOMIZATION</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {showCustomizer && (
              <div className="customizer-body">
                {/* Colors */}
                <div className="color-row">
                  <div className="color-group">
                    <label htmlFor="fg-color">Foreground</label>
                    <div className="color-preview" onClick={() => fgRef.current?.click()}>
                      <span className="color-swatch" style={{ background: options.fgColor }} />
                      <span className="color-hex">{options.fgColor}</span>
                      <input ref={fgRef} id="fg-color" type="color" value={options.fgColor}
                        onChange={e => setOptions(p => ({ ...p, fgColor: e.target.value }))} />
                    </div>
                  </div>
                  <div className="color-group">
                    <label htmlFor="bg-color">Background</label>
                    <div className="color-preview" onClick={() => bgRef.current?.click()}>
                      <span className="color-swatch" style={{ background: options.bgColor, border: '1px solid var(--border)' }} />
                      <span className="color-hex">{options.bgColor}</span>
                      <input ref={bgRef} id="bg-color" type="color" value={options.bgColor}
                        onChange={e => setOptions(p => ({ ...p, bgColor: e.target.value }))} />
                    </div>
                  </div>
                </div>

                {/* Size */}
                <div className="slider-group">
                  <label>Size</label>
                  <div className="slider-row">
                    <input id="size-slider" type="range" min={128} max={600} step={8}
                      value={options.size}
                      onChange={e => setOptions(p => ({ ...p, size: +e.target.value }))} />
                    <span className="slider-val">{options.size}px</span>
                  </div>
                </div>

                {/* Margin */}
                <div className="slider-group">
                  <label>Quiet Zone (Margin)</label>
                  <div className="slider-row">
                    <input id="margin-slider" type="range" min={0} max={10} step={1}
                      value={options.margin}
                      onChange={e => setOptions(p => ({ ...p, margin: +e.target.value }))} />
                    <span className="slider-val">{options.margin}</span>
                  </div>
                </div>

                {/* Error level */}
                <div className="slider-group">
                  <label>Error Correction Level</label>
                  <div className="error-level-group">
                    {(['L', 'M', 'Q', 'H'] as ErrorLevel[]).map(lvl => (
                      <button
                        key={lvl}
                        id={`error-lvl-${lvl}`}
                        className={`error-btn${options.errorLevel === lvl ? ' active' : ''}`}
                        onClick={() => setOptions(p => ({ ...p, errorLevel: lvl }))}
                        title={{ L: '7%', M: '15%', Q: '25%', H: '30%' }[lvl]}
                      >{lvl}</button>
                    ))}
                  </div>
                  <span className="form-hint">Higher level = more damage resistance, larger QR</span>
                </div>

                {/* Logo upload */}
                <div className="slider-group">
                  <label>Logo / Center Image</label>
                  {options.logoDataUrl ? (
                    <div className="logo-preview-row">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={options.logoDataUrl} alt="Logo" className="logo-preview-img" />
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Logo applied</span>
                      <button className="logo-remove" onClick={() => setOptions(p => ({ ...p, logoDataUrl: null }))}>Remove</button>
                    </div>
                  ) : (
                    <div className="logo-upload-area" onClick={() => logoRef.current?.click()} role="button" tabIndex={0}
                      onKeyDown={e => e.key === 'Enter' && logoRef.current?.click()}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.5">
                        <rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      <p>Click to upload logo (PNG, JPG, SVG)</p>
                    </div>
                  )}
                  <input ref={logoRef} type="file" accept="image/*" className="sr-only"
                    onChange={e => {
                      const f = e.target.files?.[0]; if (!f) return;
                      const r = new FileReader();
                      r.onload = ev => setOptions(p => ({ ...p, logoDataUrl: ev.target?.result as string }));
                      r.readAsDataURL(f);
                    }} />
                </div>

                {/* Logo size */}
                {options.logoDataUrl && (
                  <div className="slider-group">
                    <label>Logo Size</label>
                    <div className="slider-row">
                      <input id="logo-size-slider" type="range" min={10} max={35} step={1}
                        value={options.logoSize}
                        onChange={e => setOptions(p => ({ ...p, logoSize: +e.target.value }))} />
                      <span className="slider-val">{options.logoSize}%</span>
                    </div>
                  </div>
                )}

                {/* Reset button */}
                <button id="reset-customize-btn" className="qr-action-btn"
                  onClick={() => setOptions(DEFAULT_OPTIONS)}
                  style={{ width: '100%', justifyContent: 'center' }}>
                  Reset to Defaults
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="qr-footer">
        QR Studio — Built with ❤️ by Rashmika Perera· Generate, customize & export QR codes instantly
      </footer>

      {/* ── Toasts ── */}
      <div className="toast-container" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span className="toast-icon">{t.type === 'success' ? '✓' : '⚠️'}</span>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
