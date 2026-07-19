"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const appBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const firebaseConfig = {
  apiKey: "AIzaSyBN0ofEm-yUzno7F7tJB0DEQCLrKlb4fP0",
  authDomain: "medicoolbox.firebaseapp.com",
  databaseURL: "https://medicoolbox-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "medicoolbox",
  storageBucket: "medicoolbox.firebasestorage.app",
  messagingSenderId: "869631771092",
  appId: "1:869631771092:web:190c7285f19fa306c61641",
};

type BoxData = {
  temperature: number;
  temperatureStatus: string;
  coolingText: string;
  gpsValid: boolean;
  latitude: number;
  longitude: number;
  satellites: number;
  wifiRSSI: number;
  device: string;
  sensorOK?: boolean;
  uptimeSeconds?: number;
};

type View = "home" | "delivery" | "scan" | "notifications" | "profile";

const fallback: BoxData = {
  temperature: 8.25,
  temperatureStatus: "HIGH",
  coolingText: "ON",
  gpsValid: false,
  latitude: 0,
  longitude: 0,
  satellites: 0,
  wifiRSSI: -35,
  device: "BOX-001",
  sensorOK: true,
};

const statusCopy: Record<string, string> = {
  NORMAL: "อุณหภูมิปกติ",
  HIGH: "อุณหภูมิสูง",
  LOW: "อุณหภูมิต่ำ",
  SENSOR_ERROR: "เซนเซอร์ขัดข้อง",
};

function greetingForHour(hour: number) {
  if (hour >= 5 && hour < 12) return "สวัสดีตอนเช้า";
  if (hour >= 12 && hour < 17) return "สวัสดีตอนบ่าย";
  if (hour >= 17 && hour < 22) return "สวัสดีตอนเย็น";
  return "สวัสดีตอนกลางคืน";
}

function Icon({ name }: { name: string }) {
  const icons: Record<string, string> = {
    home: "⌂", delivery: "↗", scan: "⌗", bell: "●", profile: "◉",
    temp: "°", cooling: "❄", gps: "⌖", wifi: "≋", box: "□",
  };
  return <span className={`icon icon-${name}`} aria-hidden="true">{icons[name]}</span>;
}

function MiniChart({ points }: { points: number[] }) {
  const width = 620;
  const height = 180;
  const plot = points.length > 1 ? points : [6.4, 6.8, 6.2, 7.1, 6.6, 7.4];
  const min = Math.min(0, ...plot) - 1;
  const max = Math.max(10, ...plot) + 1;
  const path = plot.map((value, index) => {
    const x = (index / Math.max(1, plot.length - 1)) * width;
    const y = height - ((value - min) / (max - min)) * height;
    return `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const area = `${path} L${width},${height} L0,${height} Z`;
  return (
    <div className="chart-wrap" aria-label="กราฟอุณหภูมิย้อนหลัง">
      <div className="chart-label top">8°C</div><div className="chart-label bottom">2°C</div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img">
        <defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#087f8c" stopOpacity=".28"/><stop offset="1" stopColor="#087f8c" stopOpacity="0"/></linearGradient></defs>
        <line x1="0" y1="48" x2={width} y2="48" className="threshold high"/>
        <line x1="0" y1="145" x2={width} y2="145" className="threshold low"/>
        <path d={area} fill="url(#chartFill)"/><path d={path} className="chart-line"/>
      </svg>
      <div className="chart-times"><span>10:00</span><span>10:15</span><span>10:30</span><span>ขณะนี้</span></div>
    </div>
  );
}

export default function Home() {
  const [view, setView] = useState<View>("home");
  const [data, setData] = useState<BoxData>(fallback);
  const [online, setOnline] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [greeting, setGreeting] = useState("สวัสดี");
  const [scanResult, setScanResult] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register(`${appBasePath}/sw.js`).catch(() => undefined);
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(`${firebaseConfig.databaseURL}/MediCoolBox.json?ts=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Firebase unavailable");
        const next = await response.json();
        if (!active || !next) return;
        setData({ ...fallback, ...next });
        setOnline(true);
        setLastUpdate(new Date());
        if (typeof next.temperature === "number") setHistory(old => [...old, next.temperature].slice(-24));
      } catch {
        if (active) setOnline(false);
      }
    };
    load();
    const timer = window.setInterval(load, 2000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  useEffect(() => () => streamRef.current?.getTracks().forEach(track => track.stop()), []);

  useEffect(() => {
    const updateGreeting = () => setGreeting(greetingForHour(new Date().getHours()));
    updateGreeting();
    const timer = window.setInterval(updateGreeting, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const status = data.temperatureStatus || (data.temperature > 8 ? "HIGH" : data.temperature < 2 ? "LOW" : "NORMAL");
  const statusClass = status === "NORMAL" ? "normal" : status === "HIGH" ? "high" : "warning";
  const wifiLabel = data.wifiRSSI >= -50 ? "ดีมาก" : data.wifiRSSI >= -67 ? "ดี" : "อ่อน";
  const mapUrl = data.gpsValid ? `https://www.google.com/maps?q=${data.latitude},${data.longitude}` : "https://www.google.com/maps";
  const mapEmbedUrl = data.gpsValid
    ? `https://maps.google.com/maps?q=${data.latitude},${data.longitude}&z=16&output=embed`
    : "";
  const qrImageUrl = "https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=16&data=BOX-001";
  const notifications = useMemo(() => {
    const items = [];
    if (status === "HIGH") items.push({ level: "critical", title: "อุณหภูมิสูงเกินกำหนด", detail: `${data.temperature.toFixed(2)}°C — ตรวจสอบระบบทำความเย็น`, time: "ขณะนี้" });
    if (status === "LOW") items.push({ level: "warn", title: "อุณหภูมิต่ำกว่าเกณฑ์", detail: `${data.temperature.toFixed(2)}°C — ตรวจสอบสิ่งส่งตรวจ`, time: "ขณะนี้" });
    if (!data.gpsValid) items.push({ level: "info", title: "กำลังค้นหาสัญญาณ GPS", detail: "นำกล่องไปบริเวณที่มองเห็นท้องฟ้า", time: "ล่าสุด" });
    if (!online) items.push({ level: "critical", title: "ขาดการเชื่อมต่อ", detail: "เว็บไซต์ยังแสดงข้อมูลล่าสุดที่ได้รับ", time: "ขณะนี้" });
    if (!items.length) items.push({ level: "success", title: "ระบบทำงานปกติ", detail: "อุณหภูมิและตำแหน่งอยู่ในเกณฑ์", time: "ขณะนี้" });
    return items;
  }, [status, data.temperature, data.gpsValid, online]);

  async function startScanner() {
    setScanResult("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setCameraOn(true);
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      const Detector = (window as unknown as { BarcodeDetector?: new (opts: {formats: string[]}) => {detect: (video: HTMLVideoElement) => Promise<Array<{rawValue: string}>>} }).BarcodeDetector;
      if (Detector && videoRef.current) {
        const detector = new Detector({ formats: ["qr_code"] });
        const scan = async () => {
          if (!streamRef.current || !videoRef.current) return;
          const codes = await detector.detect(videoRef.current).catch(() => []);
          if (codes[0]) { finishScan(codes[0].rawValue); return; }
          requestAnimationFrame(scan);
        };
        requestAnimationFrame(scan);
      }
    } catch { setScanResult("ไม่สามารถเปิดกล้องได้ — ใช้ปุ่มทดสอบ BOX-001 แทน"); }
  }

  function finishScan(value: string) {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setCameraOn(false);
    setScanResult(value.trim().toUpperCase() === "BOX-001" ? "BOX-001" : `ไม่พบกล่อง: ${value}`);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setView("home")} aria-label="MediCool Box หน้าหลัก"><span className="brand-mark">M</span><span><b>MediCool</b><small>Cold-chain monitor</small></span></button>
        <nav aria-label="เมนูหลัก">
          {([['home','home','หน้าหลัก'],['delivery','delivery','การจัดส่ง'],['scan','scan','สแกน QR'],['notifications','bell','แจ้งเตือน'],['profile','profile','โปรไฟล์']] as [View,string,string][]).map(([id, icon, label]) =>
            <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}><Icon name={icon}/><span>{label}</span>{id === "notifications" && notifications.some(n => n.level === "critical") && <i/>}</button>
          )}
        </nav>
        <div className="sidebar-device"><span className={`live-dot ${online ? "" : "offline"}`}/><div><b>{data.device || "BOX-001"}</b><small>{online ? "ออนไลน์" : "ออฟไลน์"}</small></div></div>
      </aside>

      <section className="content">
        <header className="topbar"><div><p className="eyebrow">MEDICOOL CONTROL CENTER</p><h1>{view === "home" ? greeting : view === "delivery" ? "ติดตามการจัดส่ง" : view === "scan" ? "สแกนกล่อง" : view === "notifications" ? "การแจ้งเตือน" : "ข้อมูลผู้ดูแล"}</h1></div><div className="sync"><span className={`live-dot ${online ? "" : "offline"}`}/><span>{online ? "ข้อมูลสด" : "ข้อมูลล่าสุด"}<small>{lastUpdate ? lastUpdate.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "กำลังเชื่อมต่อ"}</small></span></div></header>

        {view === "home" && <>
          <section className={`hero ${statusClass}`}>
            <div className="hero-copy"><p className="eyebrow">สถานะกล่องขณะนี้</p><div className="status-pill"><span/>{statusCopy[status] || status}</div><h2><span>{data.temperature.toFixed(2)}</span><sup>°C</sup></h2><p>ช่วงที่แนะนำสำหรับต้นแบบ: 2–8°C</p></div>
            <div className="hero-ring"><div><Icon name="temp"/><b>{status === "NORMAL" ? "อยู่ในเกณฑ์" : "ต้องตรวจสอบ"}</b><small>{data.device}</small></div></div>
          </section>
          <section className="metric-grid">
            <article className="metric"><div className="metric-icon blue"><Icon name="cooling"/></div><span>ระบบทำความเย็น</span><b>{data.coolingText || "—"}</b><small>IRLZ44N · Peltier ×2</small></article>
            <article className="metric"><div className="metric-icon green"><Icon name="gps"/></div><span>ตำแหน่ง GPS</span><b>{data.gpsValid ? "เชื่อมต่อแล้ว" : "กำลังค้นหา"}</b><small>{data.satellites || 0} ดาวเทียม</small></article>
            <article className="metric"><div className="metric-icon purple"><Icon name="wifi"/></div><span>สัญญาณ Wi-Fi</span><b>{wifiLabel}</b><small>{data.wifiRSSI} dBm</small></article>
            <article className="metric"><div className="metric-icon orange"><Icon name="box"/></div><span>กล่องของฉัน</span><b>{data.device || "BOX-001"}</b><small>พร้อมสำหรับการขนส่ง</small></article>
          </section>
          <section className="panel split-panel"><div><div className="section-head"><div><p className="eyebrow">TEMPERATURE TREND</p><h3>อุณหภูมิย้อนหลัง</h3></div><span className="range-chip">ล่าสุด 24 ค่า</span></div><MiniChart points={history}/></div><div className="quick-panel"><p className="eyebrow">QUICK ACTION</p><h3>เริ่มการจัดส่งใหม่</h3><p>ตรวจสอบกล่องและสร้างรายการจัดส่งสำหรับสิ่งส่งตรวจ</p><button className="primary" onClick={() => setView("scan")}>สแกน QR กล่อง <span>→</span></button><button className="text-btn" onClick={() => setView("delivery")}>ดูการจัดส่งปัจจุบัน</button></div></section>
        </>}

        {view === "delivery" && <>
          <section className="delivery-banner"><div><p className="eyebrow">ACTIVE SHIPMENT</p><h2>MCB-2026-001</h2><p>ตัวอย่างเลือด · {data.device}</p></div><span className="delivery-status"><i/>กำลังขนส่ง</span></section>
          <section className="delivery-layout"><article className="panel map-panel"><div className="section-head"><div><p className="eyebrow">LIVE LOCATION</p><h3>ตำแหน่งกล่อง</h3></div><span className={data.gpsValid ? "gps-ok" : "gps-wait"}>{data.gpsValid ? `${data.satellites} ดาวเทียม` : "รอสัญญาณ GPS"}</span></div>{data.gpsValid ? <div className="google-map"><iframe title={`ตำแหน่ง ${data.device}`} src={mapEmbedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade"/><div className="map-card"><b>{data.device}</b><span>{data.latitude.toFixed(5)}, {data.longitude.toFixed(5)}</span></div></div> : <div className="map-placeholder"><div className="map-grid"/><span className="map-pin">M</span><div className="map-card"><b>{data.device}</b><span>ยังไม่มีตำแหน่ง — นำ GPS ออกที่โล่ง</span></div></div>}<a className="primary map-button" href={mapUrl} target="_blank" rel="noreferrer">เปิดเต็มจอใน Google Maps <span>↗</span></a></article><article className="panel route-panel"><p className="eyebrow">DELIVERY ROUTE</p><h3>รายละเอียดเส้นทาง</h3><div className="route"><div className="route-line"><i/><span/><i/></div><div><b>โรงพยาบาลต้นทาง</b><p>จุดรับสิ่งส่งตรวจ</p><small>ออกเดินทาง 10:00 น.</small><b>ห้องปฏิบัติการปลายทาง</b><p>จุดส่งสิ่งส่งตรวจ</p><small>คาดว่าจะถึง 11:20 น.</small></div></div><div className="shipment-temp"><span>อุณหภูมิปัจจุบัน</span><b>{data.temperature.toFixed(2)}°C</b><small className={statusClass}>{statusCopy[status]}</small></div></article></section>
          <section className="panel"><div className="section-head"><div><p className="eyebrow">COLD-CHAIN RECORD</p><h3>กราฟอุณหภูมิระหว่างขนส่ง</h3></div><span className="range-chip">เป้าหมาย 2–8°C</span></div><MiniChart points={history}/></section>
        </>}

        {view === "scan" && <section className="scanner-layout"><article className="panel scanner-card"><div className="scanner-title"><span className="scan-symbol">⌗</span><p className="eyebrow">PAIR A BOX</p><h2>สแกน QR ที่กล่อง</h2><p>วาง QR Code ให้อยู่ในกรอบเพื่อเชื่อมต่อกับ {data.device}</p></div><div className={`scanner-window ${cameraOn ? "camera" : ""}`}><video ref={videoRef} playsInline muted/><div className="scan-frame"><i/><i/><i/><i/></div>{!cameraOn && <div className="camera-placeholder"><span>⌗</span><small>กล้องยังไม่เปิด</small></div>}</div><button className="primary full" onClick={cameraOn ? () => finishScan("BOX-001") : startScanner}>{cameraOn ? "ยืนยัน BOX-001" : "เปิดกล้องสแกน QR"}</button><button className="text-btn" onClick={() => finishScan("BOX-001")}>ทดสอบด้วย BOX-001</button></article><article className="panel scan-info"><p className="eyebrow">BOX QR CODE</p><h3>QR สำหรับติดบนกล่อง</h3><div className="qr-identity"><img src={qrImageUrl} alt="QR Code BOX-001" width="230" height="230"/><div><span>รหัสภายใน QR</span><b>BOX-001</b><small>พิมพ์หรือติด QR นี้บนกล่อง MediCool</small></div><a className="secondary qr-download" href={qrImageUrl} target="_blank" rel="noreferrer">เปิด QR เพื่อบันทึกหรือพิมพ์</a></div><div className="scan-divider"/><p className="eyebrow">SCAN RESULT</p><h3>{scanResult === "BOX-001" ? "เชื่อมต่อกล่องสำเร็จ" : "ข้อมูลหลังการสแกน"}</h3>{scanResult === "BOX-001" ? <div className="box-result"><div className="box-visual"><span>M</span></div><div><span>รหัสกล่อง</span><b>{data.device}</b><small className={statusClass}>{statusCopy[status]}</small></div><dl><div><dt>อุณหภูมิ</dt><dd>{data.temperature.toFixed(2)}°C</dd></div><div><dt>Cooling</dt><dd>{data.coolingText}</dd></div><div><dt>GPS</dt><dd>{data.gpsValid ? "พร้อม" : "ค้นหา"}</dd></div></dl><button className="primary full" onClick={() => setView("home")}>เปิด Dashboard</button></div> : <div className="scan-ready"><p>{scanResult || "สแกน QR ทางซ้ายเพื่อเชื่อมต่อกล่อง"}</p><small>บนมือถือให้อนุญาตการใช้งานกล้องเมื่อเบราว์เซอร์ถาม</small></div>}</article></section>}

        {view === "notifications" && <section className="notifications-layout"><div className="notification-summary"><div><p className="eyebrow">SYSTEM EVENTS</p><h2>{notifications.length} รายการล่าสุด</h2></div><div className="summary-ring"><b>{notifications.filter(n => n.level === "critical").length}</b><span>เร่งด่วน</span></div></div><div className="notification-list">{notifications.map((item, index) => <article key={index} className={`notification ${item.level}`}><span className="notification-mark"/><div><b>{item.title}</b><p>{item.detail}</p></div><time>{item.time}</time></article>)}</div><article className="panel alert-guide"><p className="eyebrow">ACTION GUIDE</p><h3>เมื่อได้รับการแจ้งเตือน</h3><div className="guide-grid"><div><b>1</b><span>ตรวจสอบฝาและแหล่งจ่ายไฟ</span></div><div><b>2</b><span>ตรวจสอบพัดลมและ Peltier</span></div><div><b>3</b><span>ติดต่อผู้ขนส่งและปลายทาง</span></div></div></article></section>}

        {view === "profile" && <section className="profile-layout"><article className="profile-card"><div className="profile-cover"><span className="brand-mark large">M</span></div><div className="profile-body"><p className="eyebrow">MEDICOOL OPERATOR</p><h2>ผู้ดูแลระบบต้นแบบ</h2><p>Smart Cold Chain Transport System</p><div className="profile-stats"><div><b>1</b><span>กล่องที่ดูแล</span></div><div><b>99%</b><span>ระบบออนไลน์</span></div><div><b>{data.temperature.toFixed(1)}°</b><span>อุณหภูมิล่าสุด</span></div></div></div></article><article className="panel device-details"><p className="eyebrow">DEVICE DETAILS</p><h3>ข้อมูลกล่อง</h3><dl><div><dt>รหัสอุปกรณ์</dt><dd>{data.device}</dd></div><div><dt>ไมโครคอนโทรลเลอร์</dt><dd>ESP32</dd></div><div><dt>เซนเซอร์</dt><dd>DS18B20</dd></div><div><dt>ตำแหน่ง</dt><dd>NEO-6M GPS</dd></div><div><dt>การเชื่อมต่อ</dt><dd className={online ? "success-text" : "danger-text"}>{online ? "Firebase Online" : "Offline"}</dd></div></dl><button className="secondary" onClick={() => setView("notifications")}>ดูสถานะระบบ</button></article><article className="panel about-card"><p className="eyebrow">ABOUT PROJECT</p><h3>MediCool Box</h3><p>ต้นแบบกล่องควบคุมและติดตามอุณหภูมิสำหรับขนส่งสิ่งส่งตรวจทางการแพทย์ โดยแสดงข้อมูลแบบเรียลไทม์เพื่อช่วยเฝ้าระวัง Cold Chain</p><div className="safety-note"><b>หมายเหตุ</b><span>ระบบนี้เป็นต้นแบบเพื่อการศึกษา ยังไม่ใช่อุปกรณ์การแพทย์ที่ผ่านการรับรอง</span></div></article></section>}
      </section>

      <nav className="mobile-nav" aria-label="เมนูมือถือ">{([['home','home','หน้าแรก'],['delivery','delivery','จัดส่ง'],['scan','scan','สแกน'],['notifications','bell','แจ้งเตือน'],['profile','profile','โปรไฟล์']] as [View,string,string][]).map(([id, icon, label]) => <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}><Icon name={icon}/><span>{label}</span></button>)}</nav>
    </main>
  );
}
