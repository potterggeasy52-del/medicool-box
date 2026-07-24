"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import jsQR from "jsqr";

const appBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const lastValidTemperatureKey = "medicool.lastValidTemperature";

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

type TemperaturePoint = {
  temperature: number;
  timestamp: number;
};

type ShipmentStage = "READY" | "IN_TRANSIT" | "DELIVERED";

type ShipmentData = {
  id: string;
  boxId: string;
  cargo: string;
  origin: string;
  destination: string;
  stage: ShipmentStage;
  startedAt: number | null;
  deliveredAt: number | null;
  handoverCount: number;
};

const historySampleInterval = 5 * 60 * 1000;
const shipmentStorageKey = "medicool.activeShipment";

const defaultShipment: ShipmentData = {
  id: "MCB-2026-001",
  boxId: "BOX-001",
  cargo: "สิ่งส่งตรวจทางห้องปฏิบัติการ",
  origin: "โรงพยาบาลต้นทาง",
  destination: "ห้องปฏิบัติการปลายทาง",
  stage: "READY",
  startedAt: null,
  deliveredAt: null,
  handoverCount: 0,
};

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

function MiniChart({ points, startedAt }: { points: TemperaturePoint[]; startedAt: number }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const height = 260;
  const plotTop = 18;
  const plotBottom = 218;
  const plotHeight = plotBottom - plotTop;
  const now = Date.now();
  const firstTimestamp = points[0]?.timestamp ?? now;
  const start = Math.min(startedAt || firstTimestamp, firstTimestamp);
  const end = Math.max(now, points.at(-1)?.timestamp ?? now);
  const slotCount = Math.max(9, Math.ceil((end - start) / historySampleInterval) + 1);
  const width = Math.max(700, slotCount * 74);
  const xFor = (timestamp: number) => 12 + ((timestamp - start) / Math.max(1, end - start)) * (width - 24);
  const yFor = (temperature: number) => plotBottom - (Math.min(40, Math.max(0, temperature)) / 40) * plotHeight;
  const path = points.map((point, index) => {
    const x = xFor(point.timestamp);
    const y = yFor(point.temperature);
    return `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const timeTicks = Array.from({ length: slotCount }, (_, index) => {
    const timestamp = Math.min(start + index * historySampleInterval, end);
    return { timestamp, x: xFor(timestamp) };
  });

  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollLeft = element.scrollWidth;
  }, [width, points.length]);

  return (
    <div className="chart-wrap" aria-label="กราฟอุณหภูมิตั้งแต่เริ่มระบบ ช่วง 0 ถึง 40 องศาเซลเซียส">
      <div className="chart-guide"><span className="guide-dot"/>ช่วงเหมาะสม 2–8°C <small>• ทุก 5 นาที • เลื่อนเพื่อดูย้อนหลัง</small></div>
      <div className="chart-frame">
        <div className="chart-y-axis" aria-hidden="true">
          {[40, 30, 20, 10, 0].map(value => <span key={value} style={{ top: `${plotTop + ((40 - value) / 40) * plotHeight}px` }}>{value}°</span>)}
        </div>
        <div className="chart-scroll" ref={scrollRef}>
          <div className="chart-canvas" style={{ width: `${width}px` }}>
            <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img">
              <rect x="0" y={yFor(8)} width={width} height={yFor(2) - yFor(8)} className="recommended-band"/>
              {[0, 10, 20, 30, 40].map(value => <line key={value} x1="0" y1={yFor(value)} x2={width} y2={yFor(value)} className="axis-grid"/>)}
              {timeTicks.map(({ timestamp, x }, index) => <g key={`${timestamp}-${index}`}><line x1={x} y1={plotTop} x2={x} y2={plotBottom} className="time-grid"/><text x={x} y="247" textAnchor="middle" className="chart-time-label">{new Date(timestamp).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</text></g>)}
              {path && <path d={path} className="chart-line"/>}
              {points.map((point, index) => <circle key={`${point.timestamp}-${index}`} cx={xFor(point.timestamp)} cy={yFor(point.temperature)} r={index === points.length - 1 ? 5 : 3} className="chart-point"/>)}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [view, setView] = useState<View>("home");
  const [data, setData] = useState<BoxData>(fallback);
  const [online, setOnline] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [history, setHistory] = useState<TemperaturePoint[]>([]);
  const [systemStartedAt, setSystemStartedAt] = useState(Date.now());
  const [shipment, setShipment] = useState<ShipmentData>(defaultShipment);
  const lastValidTemperatureRef = useRef(fallback.temperature);
  const lastSavedHistoryBucketRef = useRef<number | null>(null);
  const [greeting, setGreeting] = useState("สวัสดี");
  const [scanResult, setScanResult] = useState("");
  const [scanMessage, setScanMessage] = useState("กดเปิดกล้อง แล้วเล็ง QR ให้อยู่ในกรอบ");
  const [cameraOn, setCameraOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register(`${appBasePath}/sw.js`).catch(() => undefined);
    const storedTemperature = Number(window.localStorage.getItem(lastValidTemperatureKey));
    if (Number.isFinite(storedTemperature) && storedTemperature > -126 && storedTemperature <= 100) {
      lastValidTemperatureRef.current = storedTemperature;
    }
    let active = true;
    const historyUrl = `${firebaseConfig.databaseURL}/MediCoolBoxHistory/BOX-001`;
    const loadHistory = async () => {
      try {
        const response = await fetch(`${historyUrl}.json?ts=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) return;
        const stored = await response.json();
        const values = stored && typeof stored === "object" ? Object.values(stored) : [];
        const restored = values
          .map(value => value as Partial<TemperaturePoint>)
          .filter(point => Number.isFinite(Number(point.temperature)) && Number(point.temperature) > -126 && Number(point.temperature) <= 100 && Number.isFinite(Number(point.timestamp)))
          .map(point => ({ temperature: Number(point.temperature), timestamp: Number(point.timestamp) }))
          .sort((a, b) => a.timestamp - b.timestamp);
        if (!active || !restored.length) return;
        lastSavedHistoryBucketRef.current = Math.floor(restored.at(-1)!.timestamp / historySampleInterval) * historySampleInterval;
        setHistory(restored);
      } catch {
        // The live value remains available if history is temporarily unavailable.
      }
    };
    const load = async () => {
      try {
        const response = await fetch(`${firebaseConfig.databaseURL}/MediCoolBox.json?ts=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Firebase unavailable");
        const next = await response.json();
        if (!active || !next) return;
        const rawTemperature = Number(next.temperature);
        const temperatureIsValid = Number.isFinite(rawTemperature)
          && rawTemperature > -126
          && rawTemperature <= 100
          && next.sensorOK !== false;
        if (temperatureIsValid) {
          lastValidTemperatureRef.current = rawTemperature;
          window.localStorage.setItem(lastValidTemperatureKey, String(rawTemperature));
        }
        const displayTemperature = temperatureIsValid ? rawTemperature : lastValidTemperatureRef.current;
        const now = Date.now();
        const uptimeSeconds = Number(next.uptimeSeconds);
        if (Number.isFinite(uptimeSeconds) && uptimeSeconds >= 0) {
          setSystemStartedAt(now - uptimeSeconds * 1000);
        }
        setData({ ...fallback, ...next, temperature: displayTemperature });
        setOnline(true);
        setLastUpdate(new Date(now));

        const historyBucket = Math.floor(now / historySampleInterval) * historySampleInterval;
        if (temperatureIsValid && lastSavedHistoryBucketRef.current !== historyBucket) {
          lastSavedHistoryBucketRef.current = historyBucket;
          const point = { temperature: rawTemperature, timestamp: now };
          setHistory(old => [...old.filter(item => Math.floor(item.timestamp / historySampleInterval) !== historyBucket), point].sort((a, b) => a.timestamp - b.timestamp));
          fetch(`${historyUrl}/${historyBucket}.json`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(point),
          }).catch(() => undefined);
        }
      } catch {
        if (active) setOnline(false);
      }
    };
    loadHistory();
    load();
    const timer = window.setInterval(load, 2000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    let active = true;
    const restoreShipment = async () => {
      const stored = window.localStorage.getItem(shipmentStorageKey);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as ShipmentData;
          if (parsed?.id === defaultShipment.id) setShipment({ ...defaultShipment, ...parsed });
        } catch {
          window.localStorage.removeItem(shipmentStorageKey);
        }
      }
      try {
        const response = await fetch(`${firebaseConfig.databaseURL}/Shipments/${defaultShipment.id}.json?ts=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) return;
        const remote = await response.json();
        if (active && remote) {
          const restored = { ...defaultShipment, ...remote } as ShipmentData;
          setShipment(restored);
          window.localStorage.setItem(shipmentStorageKey, JSON.stringify(restored));
        }
      } catch {
        // The local shipment remains usable during a temporary network outage.
      }
    };
    restoreShipment();
    return () => { active = false; };
  }, []);

  useEffect(() => () => {
    if (scanFrameRef.current !== null) window.cancelAnimationFrame(scanFrameRef.current);
    streamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  useEffect(() => {
    if (view !== "scan") {
      if (scanFrameRef.current !== null) window.cancelAnimationFrame(scanFrameRef.current);
      scanFrameRef.current = null;
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setCameraOn(false);
    }
  }, [view]);

  useEffect(() => {
    const updateGreeting = () => setGreeting(greetingForHour(new Date().getHours()));
    updateGreeting();
    const timer = window.setInterval(updateGreeting, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const status = data.temperatureStatus || (data.temperature > 8 ? "HIGH" : data.temperature < 2 ? "LOW" : "NORMAL");
  const chartPoints = useMemo(() => {
    const liveTimestamp = lastUpdate?.getTime() ?? Date.now();
    const livePoint = { temperature: data.temperature, timestamp: liveTimestamp };
    const combined = [...history];
    const lastPoint = combined.at(-1);
    if (!lastPoint || liveTimestamp > lastPoint.timestamp) combined.push(livePoint);
    return combined;
  }, [history, data.temperature, lastUpdate]);
  const shipmentPoints = useMemo(() => {
    const start = shipment.startedAt ?? 0;
    const filtered = chartPoints.filter(point => point.timestamp >= start && point.temperature >= 0 && point.temperature <= 40);
    return filtered.length ? filtered : chartPoints.slice(-1);
  }, [chartPoints, shipment.startedAt]);
  const coldChainMetrics = useMemo(() => {
    const values = shipmentPoints.map(point => point.temperature);
    const compliant = values.filter(value => value >= 2 && value <= 8).length;
    let excursions = 0;
    let wasOutside = false;
    values.forEach(value => {
      const outside = value < 2 || value > 8;
      if (outside && !wasOutside) excursions += 1;
      wasOutside = outside;
    });
    return {
      compliance: values.length ? (compliant / values.length) * 100 : 0,
      minimum: values.length ? Math.min(...values) : data.temperature,
      maximum: values.length ? Math.max(...values) : data.temperature,
      excursions,
    };
  }, [shipmentPoints, data.temperature]);
  const stageCopy: Record<ShipmentStage, string> = { READY: "รอรับสิ่งส่งตรวจ", IN_TRANSIT: "กำลังขนส่ง", DELIVERED: "ส่งมอบสำเร็จ" };
  const stageClass = shipment.stage === "DELIVERED" ? "delivered" : shipment.stage === "IN_TRANSIT" ? "transit" : "ready";
  const transitEnd = shipment.deliveredAt ?? lastUpdate?.getTime() ?? Date.now();
  const transitMinutes = shipment.startedAt ? Math.max(0, Math.floor((transitEnd - shipment.startedAt) / 60000)) : 0;
  const etaTimestamp = shipment.startedAt ? shipment.startedAt + 80 * 60000 : null;
  const formatClock = (timestamp: number | null) => timestamp ? new Date(timestamp).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : "—";
  const statusClass = status === "NORMAL" ? "normal" : status === "HIGH" ? "high" : "warning";
  const wifiLabel = data.wifiRSSI >= -50 ? "ดีมาก" : data.wifiRSSI >= -67 ? "ดี" : "อ่อน";
  const mapUrl = data.gpsValid ? `https://www.google.com/maps?q=${data.latitude},${data.longitude}` : "https://www.google.com/maps";
  const mapEmbedUrl = data.gpsValid
    ? `https://maps.google.com/maps?q=${data.latitude},${data.longitude}&z=16&output=embed`
    : "";
  const qrImageUrl = `${appBasePath}/medicool-box-qr.png`;

  function saveShipment(next: ShipmentData) {
    setShipment(next);
    window.localStorage.setItem(shipmentStorageKey, JSON.stringify(next));
    fetch(`${firebaseConfig.databaseURL}/Shipments/${next.id}.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    }).catch(() => undefined);
  }

  function startShipment() {
    const next = { ...shipment, stage: "IN_TRANSIT" as ShipmentStage, startedAt: Date.now(), deliveredAt: null, handoverCount: 1 };
    saveShipment(next);
    setView("delivery");
  }

  function completeShipment() {
    const next = { ...shipment, stage: "DELIVERED" as ShipmentStage, deliveredAt: Date.now(), handoverCount: 2 };
    saveShipment(next);
    setView("delivery");
  }

  function resetShipment() {
    saveShipment({ ...defaultShipment });
    setScanResult("");
  }

  const notifications = useMemo(() => {
    const items = [];
    if (shipment.stage === "IN_TRANSIT") items.push({ level: "success", title: "เริ่มการขนส่งแล้ว", detail: `${shipment.id} ออกจาก ${shipment.origin} เวลา ${formatClock(shipment.startedAt)} น.`, time: "การจัดส่ง" });
    if (shipment.stage === "DELIVERED") items.push({ level: "success", title: "ส่งมอบถึงปลายทางแล้ว", detail: `${shipment.id} ส่งถึง ${shipment.destination} เวลา ${formatClock(shipment.deliveredAt)} น.`, time: "สำเร็จ" });
    if (status === "HIGH") items.push({ level: "critical", title: "อุณหภูมิสูงเกินกำหนด", detail: `${data.temperature.toFixed(2)}°C — ตรวจสอบระบบทำความเย็น`, time: "ขณะนี้" });
    if (status === "LOW") items.push({ level: "warn", title: "อุณหภูมิต่ำกว่าเกณฑ์", detail: `${data.temperature.toFixed(2)}°C — ตรวจสอบสิ่งส่งตรวจ`, time: "ขณะนี้" });
    if (!data.gpsValid) items.push({ level: "info", title: "กำลังค้นหาสัญญาณ GPS", detail: "นำกล่องไปบริเวณที่มองเห็นท้องฟ้า", time: "ล่าสุด" });
    if (!online) items.push({ level: "critical", title: "ขาดการเชื่อมต่อ", detail: "เว็บไซต์ยังแสดงข้อมูลล่าสุดที่ได้รับ", time: "ขณะนี้" });
    if (!items.length) items.push({ level: "success", title: "ระบบทำงานปกติ", detail: "อุณหภูมิและตำแหน่งอยู่ในเกณฑ์", time: "ขณะนี้" });
    return items;
  }, [status, data.temperature, data.gpsValid, online, shipment]);

  function stopScanner() {
    if (scanFrameRef.current !== null) window.cancelAnimationFrame(scanFrameRef.current);
    scanFrameRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  async function startScanner() {
    stopScanner();
    setScanResult("");
    setScanMessage("กำลังเปิดกล้อง…");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setCameraOn(true);
      const video = videoRef.current;
      if (!video) throw new Error("Camera preview unavailable");
      video.srcObject = stream;
      await video.play();
      setScanMessage("กำลังสแกน… เล็ง QR ให้อยู่ในกรอบและถือให้นิ่ง");

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("QR canvas unavailable");

      let lastDecodeAt = 0;
      const scan = (timestamp: number) => {
        const currentVideo = videoRef.current;
        if (!streamRef.current || !currentVideo) return;

        if (
          timestamp - lastDecodeAt >= 120
          && currentVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
          && currentVideo.videoWidth > 0
          && currentVideo.videoHeight > 0
        ) {
          lastDecodeAt = timestamp;
          const scale = Math.min(1, 720 / currentVideo.videoWidth);
          canvas.width = Math.max(1, Math.round(currentVideo.videoWidth * scale));
          canvas.height = Math.max(1, Math.round(currentVideo.videoHeight * scale));
          context.drawImage(currentVideo, 0, 0, canvas.width, canvas.height);
          const frame = context.getImageData(0, 0, canvas.width, canvas.height);
          const decoded = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: "attemptBoth" });
          if (decoded?.data) {
            finishScan(decoded.data);
            return;
          }
        }

        scanFrameRef.current = window.requestAnimationFrame(scan);
      };
      scanFrameRef.current = window.requestAnimationFrame(scan);
    } catch {
      stopScanner();
      setScanMessage("เปิดกล้องไม่ได้ กรุณาอนุญาตใช้กล้อง หรือใช้ปุ่มโหมดสาธิตด้านล่าง");
    }
  }

  function finishScan(value: string) {
    stopScanner();
    const normalizedValue = value.trim();
    const normalizedUpper = normalizedValue.toUpperCase();
    let recognizedBox = normalizedUpper === defaultShipment.boxId;

    if (/^https?:\/\//i.test(normalizedValue)) {
      try {
        const scannedUrl = new URL(normalizedValue);
        const boxFromUrl = scannedUrl.searchParams.get("box")?.trim().toUpperCase();
        const recognizedHost = scannedUrl.hostname.includes("potterggeasy52-del.github.io")
          || scannedUrl.hostname.toLowerCase().includes("medicool");
        recognizedBox = recognizedHost && (!boxFromUrl || boxFromUrl === defaultShipment.boxId);
      } catch {
        recognizedBox = false;
      }
    }

    if (recognizedBox) {
      setScanResult(defaultShipment.boxId);
      setScanMessage(`พบ ${defaultShipment.boxId} แล้ว — ตรวจข้อมูลและกดยืนยันการส่งมอบ`);
    } else {
      setScanResult(`ไม่พบกล่อง: ${value}`);
      setScanMessage("QR นี้ไม่ใช่กล่องที่ลงทะเบียน กรุณาลองสแกนอีกครั้ง");
    }
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
          <section className="panel split-panel"><div><div className="section-head"><div><p className="eyebrow">TEMPERATURE TREND</p><h3>อุณหภูมิตั้งแต่เริ่มระบบ</h3></div><span className="range-chip">ทุก 5 นาที</span></div><MiniChart points={chartPoints} startedAt={systemStartedAt}/></div><div className="quick-panel"><p className="eyebrow">QUICK ACTION</p><h3>เริ่มการจัดส่งใหม่</h3><p>ตรวจสอบกล่องและสร้างรายการจัดส่งสำหรับสิ่งส่งตรวจ</p><button className="primary" onClick={() => setView("scan")}>สแกน QR กล่อง <span>→</span></button><button className="text-btn" onClick={() => setView("delivery")}>ดูการจัดส่งปัจจุบัน</button></div></section>
        </>}

        {view === "delivery" && <>
          <section className="delivery-banner">
            <div><p className="eyebrow">HEALTHCARE LOGISTICS TRACKING</p><h2>{shipment.id}</h2><p>{shipment.cargo} · {shipment.boxId}</p></div>
            <span className={`delivery-status ${stageClass}`}><i/>{stageCopy[shipment.stage]}</span>
          </section>
          <section className="logistics-stats">
            <article><span>Cold-chain compliance</span><b>{coldChainMetrics.compliance.toFixed(1)}%</b><small>เป้าหมาย 2–8°C</small></article>
            <article><span>อุณหภูมิต่ำสุด–สูงสุด</span><b>{coldChainMetrics.minimum.toFixed(1)}–{coldChainMetrics.maximum.toFixed(1)}°C</b><small>{coldChainMetrics.excursions} เหตุการณ์นอกช่วง</small></article>
            <article><span>เวลาขนส่ง</span><b>{shipment.startedAt ? `${transitMinutes} นาที` : "ยังไม่เริ่ม"}</b><small>ETA {etaTimestamp ? `${formatClock(etaTimestamp)} น.` : "—"}</small></article>
            <article><span>Chain of Custody</span><b>{shipment.handoverCount}/2</b><small>จุดรับ–ส่งที่ยืนยันแล้ว</small></article>
          </section>
          <section className="delivery-layout">
            <article className="panel map-panel">
              <div className="section-head"><div><p className="eyebrow">LIVE LOCATION</p><h3>ตำแหน่งกล่องระหว่างขนส่ง</h3></div><span className={data.gpsValid ? "gps-ok" : "gps-wait"}>{data.gpsValid ? `${data.satellites} ดาวเทียม` : "รอสัญญาณ GPS"}</span></div>
              {data.gpsValid ? <div className="google-map"><iframe title={`ตำแหน่ง ${data.device}`} src={mapEmbedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade"/><div className="map-card"><b>{data.device}</b><span>{data.latitude.toFixed(5)}, {data.longitude.toFixed(5)}</span></div></div> : <div className="map-placeholder"><div className="map-grid"/><span className="map-pin">M</span><div className="map-card"><b>{data.device}</b><span>ยังไม่มีตำแหน่ง — นำ GPS ออกที่โล่ง</span></div></div>}
              <a className="primary map-button" href={mapUrl} target="_blank" rel="noreferrer">เปิดเต็มจอใน Google Maps <span>↗</span></a>
            </article>
            <article className="panel custody-panel">
              <p className="eyebrow">CHAIN OF CUSTODY</p><h3>ลำดับการรับ–ส่งสิ่งส่งตรวจ</h3>
              <div className={`custody-step ${shipment.stage !== "READY" ? "complete" : "active"}`}><span>1</span><div><b>เตรียมกล่องและสิ่งส่งตรวจ</b><small>{shipment.origin}</small></div><time>พร้อม</time></div>
              <div className={`custody-step ${shipment.stage === "DELIVERED" ? "complete" : shipment.stage === "IN_TRANSIT" ? "active" : ""}`}><span>2</span><div><b>ผู้ขนส่งสแกนรับกล่อง</b><small>เริ่มติดตามอุณหภูมิและ GPS</small></div><time>{formatClock(shipment.startedAt)}</time></div>
              <div className={`custody-step ${shipment.stage === "DELIVERED" ? "complete" : ""}`}><span>3</span><div><b>ปลายทางยืนยันรับมอบ</b><small>{shipment.destination}</small></div><time>{formatClock(shipment.deliveredAt)}</time></div>
              <div className="shipment-temp"><span>อุณหภูมิปัจจุบัน</span><b>{data.temperature.toFixed(2)}°C</b><small className={statusClass}>{statusCopy[status]}</small></div>
              {shipment.stage === "READY" && <button className="primary full" onClick={() => setView("scan")}>สแกน QR เพื่อเริ่มขนส่ง <span>→</span></button>}
              {shipment.stage === "IN_TRANSIT" && <button className="primary full" onClick={() => setView("scan")}>สแกน QR ที่ปลายทาง <span>→</span></button>}
              {shipment.stage === "DELIVERED" && <button className="secondary full" onClick={resetShipment}>เริ่มรอบสาธิตใหม่</button>}
            </article>
          </section>
          <section className="panel"><div className="section-head"><div><p className="eyebrow">COLD-CHAIN RECORD</p><h3>หลักฐานอุณหภูมิระหว่างขนส่ง</h3></div><span className="range-chip">Compliance {coldChainMetrics.compliance.toFixed(1)}%</span></div><MiniChart points={chartPoints} startedAt={shipment.startedAt ?? systemStartedAt}/></section>
        </>}

        {view === "scan" && <section className="scanner-layout">
          <article className="panel scanner-card">
            <div className="scanner-title"><span className="scan-symbol">⌗</span><p className="eyebrow">LOGISTICS HANDOVER</p><h2>{shipment.stage === "READY" ? "สแกนรับกล่องที่ต้นทาง" : shipment.stage === "IN_TRANSIT" ? "สแกนส่งมอบที่ปลายทาง" : "ตรวจสอบ QR ของกล่อง"}</h2><p>การสแกนแต่ละครั้งจะบันทึกจุดส่งต่อใน Chain of Custody ของ {shipment.id}</p></div>
            <div className={`scanner-window ${cameraOn ? "camera" : ""}`}><video ref={videoRef} playsInline muted/><div className="scan-frame"><i/><i/><i/><i/></div>{!cameraOn && <div className="camera-placeholder"><span>⌗</span><small>กล้องยังไม่เปิด</small></div>}</div>
            <div className={`scan-feedback ${scanResult === "BOX-001" ? "success" : scanResult ? "error" : cameraOn ? "active" : ""}`} aria-live="polite"><span/>{scanMessage}</div>
            <button className="primary full" onClick={cameraOn ? stopScanner : startScanner}>{cameraOn ? "หยุดกล้อง" : "เปิดกล้องสแกน QR"}</button>
            <button className="text-btn" onClick={() => finishScan("BOX-001")}>โหมดสาธิต: จำลองการสแกน BOX-001</button>
          </article>
          <article className="panel scan-info">
            <p className="eyebrow">CHAIN OF CUSTODY</p><h3>{scanResult === "BOX-001" ? "ตรวจพบกล่องที่ลงทะเบียน" : "ข้อมูลสำหรับการรับ–ส่ง"}</h3>
            {scanResult === "BOX-001" ? <div className="box-result">
              <div className="handover-card"><span className={`shipment-stage ${stageClass}`}><i/>{stageCopy[shipment.stage]}</span><b>{shipment.id}</b><p>{shipment.origin} → {shipment.destination}</p></div>
              <div><span>รหัสกล่อง</span><b>{data.device}</b><small className={statusClass}>{statusCopy[status]}</small></div>
              <dl><div><dt>อุณหภูมิ</dt><dd>{data.temperature.toFixed(2)}°C</dd></div><div><dt>Cold-chain</dt><dd>{coldChainMetrics.compliance.toFixed(1)}%</dd></div><div><dt>GPS</dt><dd>{data.gpsValid ? "พร้อม" : "ค้นหา"}</dd></div></dl>
              {shipment.stage === "READY" && <button className="primary full" onClick={startShipment}>ยืนยันรับกล่องและเริ่มขนส่ง <span>→</span></button>}
              {shipment.stage === "IN_TRANSIT" && <button className="primary full" onClick={completeShipment}>ยืนยันส่งมอบถึงปลายทาง <span>✓</span></button>}
              {shipment.stage === "DELIVERED" && <><div className="delivery-proof"><b>ส่งมอบสำเร็จ</b><span>{formatClock(shipment.deliveredAt)} น. · ครบ {shipment.handoverCount}/2 จุด</span></div><button className="secondary full" onClick={() => setView("delivery")}>ดูสรุปการขนส่ง</button></>}
            </div> : <div className="qr-identity"><img src={qrImageUrl} alt="QR Code BOX-001" width="230" height="230"/><div><span>QR ประจำกล่อง</span><b>BOX-001</b><small>ใช้ QR เดียวกันเพื่อยืนยันรับของและส่งมอบ</small></div><a className="secondary qr-download" href={qrImageUrl} target="_blank" rel="noreferrer">เปิด QR เพื่อบันทึกหรือพิมพ์</a></div>}
          </article>
        </section>}

        {view === "notifications" && <section className="notifications-layout"><div className="notification-summary"><div><p className="eyebrow">SYSTEM EVENTS</p><h2>{notifications.length} รายการล่าสุด</h2></div><div className="summary-ring"><b>{notifications.filter(n => n.level === "critical").length}</b><span>เร่งด่วน</span></div></div><div className="notification-list">{notifications.map((item, index) => <article key={index} className={`notification ${item.level}`}><span className="notification-mark"/><div><b>{item.title}</b><p>{item.detail}</p></div><time>{item.time}</time></article>)}</div><article className="panel alert-guide"><p className="eyebrow">ACTION GUIDE</p><h3>เมื่อได้รับการแจ้งเตือน</h3><div className="guide-grid"><div><b>1</b><span>ตรวจสอบฝาและแหล่งจ่ายไฟ</span></div><div><b>2</b><span>ตรวจสอบพัดลมและ Peltier</span></div><div><b>3</b><span>ติดต่อผู้ขนส่งและปลายทาง</span></div></div></article></section>}

        {view === "profile" && <section className="profile-layout"><article className="profile-card"><div className="profile-cover"><span className="brand-mark large">M</span></div><div className="profile-body"><p className="eyebrow">MEDICOOL OPERATOR</p><h2>ผู้ดูแลระบบต้นแบบ</h2><p>Smart Cold Chain Transport System</p><div className="profile-stats"><div><b>1</b><span>กล่องที่ดูแล</span></div><div><b>99%</b><span>ระบบออนไลน์</span></div><div><b>{data.temperature.toFixed(1)}°</b><span>อุณหภูมิล่าสุด</span></div></div></div></article><article className="panel device-details"><p className="eyebrow">DEVICE DETAILS</p><h3>ข้อมูลกล่อง</h3><dl><div><dt>รหัสอุปกรณ์</dt><dd>{data.device}</dd></div><div><dt>ไมโครคอนโทรลเลอร์</dt><dd>ESP32</dd></div><div><dt>เซนเซอร์</dt><dd>DS18B20</dd></div><div><dt>ตำแหน่ง</dt><dd>NEO-6M GPS</dd></div><div><dt>การเชื่อมต่อ</dt><dd className={online ? "success-text" : "danger-text"}>{online ? "Firebase Online" : "Offline"}</dd></div></dl><button className="secondary" onClick={() => setView("notifications")}>ดูสถานะระบบ</button></article><article className="panel about-card"><p className="eyebrow">ABOUT PROJECT</p><h3>MediCool Box</h3><p>ต้นแบบกล่องควบคุมและติดตามอุณหภูมิสำหรับขนส่งสิ่งส่งตรวจทางการแพทย์ โดยแสดงข้อมูลแบบเรียลไทม์เพื่อช่วยเฝ้าระวัง Cold Chain</p><div className="safety-note"><b>หมายเหตุ</b><span>ระบบนี้เป็นต้นแบบเพื่อการศึกษา ยังไม่ใช่อุปกรณ์การแพทย์ที่ผ่านการรับรอง</span></div></article></section>}
      </section>

      <nav className="mobile-nav" aria-label="เมนูมือถือ">{([['home','home','หน้าแรก'],['delivery','delivery','จัดส่ง'],['scan','scan','สแกน'],['notifications','bell','แจ้งเตือน'],['profile','profile','โปรไฟล์']] as [View,string,string][]).map(([id, icon, label]) => <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}><Icon name={icon}/><span>{label}</span></button>)}</nav>
    </main>
  );
}
