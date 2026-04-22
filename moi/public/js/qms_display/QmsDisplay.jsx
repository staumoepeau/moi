import * as React from "react";
import { getQmsPageStyles } from "../qms_shared/qmsTheme";
import { useMinistryBranding } from "../qms_shared/useMinistryBranding";

export function QmsDisplay() {
  const [nowServing, setNowServing] = React.useState({ ticket: "---", counter: "--", service: "" });
  const [history, setHistory] = React.useState([]);
  const [isStarted, setIsStarted] = React.useState(false);
  const [isRecall, setIsRecall] = React.useState(false); // flashes the recall badge
  const [queueCounts, setQueueCounts] = React.useState([]); // per-service waiting counts
  const [counterStatus, setCounterStatus] = React.useState([]); // counter status (Open/Closed/Break)
  const [markedForRecall, setMarkedForRecall] = React.useState([]); // tickets marked for recall
  const [isFullscreen, setIsFullscreen] = React.useState(false); // track fullscreen state

  // Ministry branding
  const { logo: ministryLogo } = useMinistryBranding();

  const Icon = ({ name, className = "", style = {} }) => (
    <i className={`octicon octicon-${name} ${className}`} style={{ marginRight: 6, ...style }} aria-hidden="true" />
  );

  // ── Pre-fetch counter status on mount ──────────────────────────────────────
  React.useEffect(() => {
    fetchCounterStatus();
  }, []);

  // ── Fetch live queue counts for the ticker bar ───────────────────────────
  const fetchQueueCounts = async () => {
    try {
      const serviceRes = await frappe.db.get_list("QMS Service", {
        fields: ["name"],
        filters: { is_active: 1 },
        order_by: "name asc",
      });
      const counts = await Promise.all(
        serviceRes.map(async (s) => {
          const waiting = await frappe.db.count("QMS Ticket", {
            filters: { service_requested: s.name, status: "Waiting" },
          });
          return { service: s.name, waiting };
        })
      );
      setQueueCounts(counts);
    } catch (e) {
      console.error("Queue count fetch failed:", e);
    }
  };

  // ── Fetch counter status ──────────────────────────────────────────────────
  const fetchCounterStatus = async () => {
    try {
      const counters = await frappe.db.get_list("QMS Counter", {
        fields: ["name", "status"],
        order_by: "name asc",
      });
      setCounterStatus(counters);
    } catch (e) {
      console.error("Counter status fetch failed:", e);
    }
  };

  // ── Fetch marked for recall tickets ────────────────────────────────────────
  const fetchMarkedForRecall = async () => {
    try {
      // Get tickets marked for recall directly from database
      const tickets = await frappe.db.get_list("QMS Ticket", {
        filters: { status: "Completed", marked_for_recall: 1 },
        fields: ["name", "customer_name", "service_requested", "recall_reason", "counter"],
        order_by: "completed_at desc",
        limit: 8,
      });

      // Add counter number for each ticket
      const withCounterNum = await Promise.all(
        tickets.map(async (t) => {
          if (t.counter) {
            const counter = await frappe.db.get_value("QMS Counter", t.counter, "counter_number");
            t.counter_number = counter.message?.counter_number || t.counter;
          }
          return t;
        })
      );

      setMarkedForRecall(withCounterNum);
    } catch (e) {
      console.error("Marked for recall fetch failed:", e);
    }
  };

  // ── Announce ticket via speech synthesis ─────────────────────────────────
  const announce = (ticketShort, counterNumber, recall = false) => {
    // Chime first
    try {
      const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
      audio.play().catch(() => {});
    } catch (_) {}

    // Voice after chime
    const delay = recall ? 300 : 1000;
    setTimeout(() => {
      const prefix = recall ? "Reminder. " : "";
      const msg = `${prefix}Ticket Number ${ticketShort}, please proceed to Counter ${counterNumber}`;
      if (!("speechSynthesis" in window)) return;
      const utterance = new SpeechSynthesisUtterance(msg);
      utterance.lang = "en-US";
      utterance.rate = 0.92;
      window.speechSynthesis.cancel(); // stop any ongoing speech
      window.speechSynthesis.speak(utterance);
    }, delay);
  };

  // ── Realtime listeners ───────────────────────────────────────────────────
  React.useEffect(() => {
    if (!isStarted) return;

    // Initial fetch
    fetchQueueCounts();
    fetchCounterStatus();
    fetchMarkedForRecall();

    // Periodic refresh every 15 seconds (more frequent for smoother updates)
    const interval = setInterval(() => {
      fetchQueueCounts();
      fetchCounterStatus();
      fetchMarkedForRecall();
    }, 15000);

    const handleTicketCalled = (data) => {
      const short = String(data.ticket_id).slice(-3);
      setIsRecall(false);

      announce(short, data.counter_number, false);

      setNowServing((prev) => {
        if (prev.ticket !== "---" && prev.ticket !== short) {
          setHistory((h) => [
            { ticket: prev.ticket, counter: prev.counter, service: prev.service },
            ...h,
          ].slice(0, 6));
        }
        return { ticket: short, counter: data.counter_number, service: data.service || "" };
      });

      // Immediately refresh queue counts and counter status when ticket is called
      fetchQueueCounts();
      fetchCounterStatus();
      fetchMarkedForRecall();
    };

    const handleTicketRecalled = (data) => {
      const short = String(data.ticket_id).slice(-3);
      setIsRecall(true);
      announce(short, data.counter_number, true);

      // Flash the recall state, then clear after 8s
      setTimeout(() => setIsRecall(false), 8000);

      // Refresh queue counts, counter status, and recall list on recall
      fetchQueueCounts();
      fetchCounterStatus();
      fetchMarkedForRecall();
    };

    // Listen to real-time events
    frappe.realtime.on("ticket_called", handleTicketCalled);
    frappe.realtime.on("ticket_recalled", handleTicketRecalled);

    // Also listen for general QMS updates
    frappe.realtime.on("qms_update", () => {
      fetchQueueCounts();
      fetchCounterStatus();
      fetchMarkedForRecall();
    });

    // Listen for real-time counter status updates
    const handleCounterStatusUpdate = (data) => {
      console.log("Counter status updated:", data);
      setCounterStatus((prev) => {
        const updated = prev.map((c) =>
          c.name === data.counter ? { ...c, status: data.status } : c
        );
        console.log("New counter status:", updated);
        return updated;
      });
    };
    frappe.realtime.on("counter_status_updated", handleCounterStatusUpdate);
    console.log("Counter status listener registered");

    return () => {
      frappe.realtime.off("ticket_called", handleTicketCalled);
      frappe.realtime.off("ticket_recalled", handleTicketRecalled);
      frappe.realtime.off("qms_update");
      frappe.realtime.off("counter_status_updated", handleCounterStatusUpdate);
      clearInterval(interval);
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isStarted]);

  // ── Styles ────────────────────────────────────────────────────────────────
  const styles = `
    ${getQmsPageStyles("ds-root", { accent: "#38bdf8", appearance: "dark", surfaceTint: "#172554" })}
    ${getQmsPageStyles("ds-overlay", { accent: "#38bdf8", appearance: "dark", surfaceTint: "#172554" })}

    /* ── Root ── */
    .ds-root {
      width: 100vw; height: 100vh;
      background: #0f172a;
      font-family: Inter, "Segoe UI", sans-serif;
      display: flex; flex-direction: column;
      overflow: hidden; color: #f8fafc;
    }

    /* ── Header bar ── */
    .ds-header {
      background: #1e293b;
      border-bottom: 1px solid #334155;
      padding: 0 40px;
      height: 64px;
      display: flex; align-items: center; justify-content: space-between;
      flex-shrink: 0;
    }
    .ds-header-left { display: flex; align-items: center; gap: 14px; }
    .ds-logo {
      width: 38px; height: 38px; border-radius: 8px;
      background: #2490ef;
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 18px; color: #fff; flex-shrink: 0;
    }
    .ds-title { font-size: 17px; font-weight: 700; color: #f1f5f9; }
    .ds-subtitle { font-size: 12px; color: #94a3b8; margin-top: 1px; }
    .ds-clock { font-size: 28px; font-weight: 700; color: #38bdf8; font-variant-numeric: tabular-nums; letter-spacing: .04em; }

    /* ── Ticker bar (queue counts) ── */
    .ds-ticker {
      background: #1e3a5f;
      border-bottom: 1px solid #2d5080;
      padding: 0 40px; height: 42px;
      display: flex; align-items: center; gap: 28px;
      flex-shrink: 0; overflow: hidden;
    }
    .ds-ticker-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: #7dd3fc; flex-shrink: 0; }
    .ds-ticker-items { display: flex; gap: 24px; align-items: center; overflow: hidden; flex: 1; }
    .ds-ticker-item { display: flex; align-items: center; gap: 6px; font-size: 13px; flex-shrink: 0; }
    .ds-ticker-svc { color: #cbd5e1; }
    .ds-ticker-count {
      background: #dc2626; color: #fff;
      border-radius: 10px; padding: 1px 8px;
      font-size: 12px; font-weight: 700;
      min-width: 22px; text-align: center;
    }
    .ds-ticker-count.zero { background: #166534; }

    /* ── Body ── */
    .ds-body { flex: 1; display: flex; overflow: hidden; }

    /* ── Main serving panel ── */
    .ds-main {
      flex: 3; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 40px; position: relative;
      border-right: 1px solid #1e293b;
    }
    .ds-now-label {
      font-size: 13px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .2em; color: #94a3b8; margin-bottom: 8px;
    }

    .ds-ticket-wrap { position: relative; display: inline-block; }
    .ds-ticket {
      font-size: 18vw; font-weight: 900; line-height: 1;
      color: #f8fafc; letter-spacing: -.02em;
      transition: all .3s ease;
    }
    .ds-ticket.recall-flash { color: #fbbf24; }

    @keyframes pulse-glow {
      0%, 100% { text-shadow: 0 0 40px rgba(36,144,239,.3); }
      50%       { text-shadow: 0 0 80px rgba(36,144,239,.7); }
    }
    .ds-ticket { animation: pulse-glow 3s ease-in-out infinite; }
    .ds-ticket.recall-flash { animation: none; text-shadow: 0 0 60px rgba(251,191,36,.6); }

    .recall-badge {
      position: absolute; top: -10px; right: -60px;
      background: #f59e0b; color: #1c1400;
      padding: 4px 12px; border-radius: 20px;
      font-size: 13px; font-weight: 800; text-transform: uppercase;
      letter-spacing: .06em;
      animation: bounce-in .3s ease-out;
    }
    @keyframes bounce-in {
      0%   { transform: scale(0); opacity: 0; }
      70%  { transform: scale(1.15); }
      100% { transform: scale(1); opacity: 1; }
    }

    .ds-divider { width: 80px; height: 3px; background: #2490ef; border-radius: 2px; margin: 24px 0; }

    .ds-counter-label {
      font-size: 13px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .2em; color: #94a3b8; margin-bottom: 12px;
    }
    .ds-counter-box {
      background: #1e3a5f;
      border: 2px solid #2490ef;
      border-radius: 16px;
      padding: 16px 56px;
      font-size: 5vw; font-weight: 800; color: #38bdf8;
      letter-spacing: .04em;
      transition: all .3s ease;
    }
    .ds-counter-box.recall-flash { border-color: #f59e0b; color: #fbbf24; background: #1c1400; }

    .ds-service-tag {
      margin-top: 18px;
      background: #1e293b; border: 1px solid #334155;
      border-radius: 20px; padding: 5px 16px;
      font-size: 13px; color: #94a3b8;
    }

    /* ── History panel ── */
    .ds-history {
      flex: 1.1; background: #0f172a;
      display: flex; flex-direction: column;
      padding: 32px 28px; overflow: hidden;
    }
    .ds-history-title {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .15em; color: #475569; margin-bottom: 20px;
      padding-bottom: 12px; border-bottom: 1px solid #1e293b;
    }
    .ds-history-list { display: flex; flex-direction: column; gap: 10px; flex: 1; overflow: hidden; }
    .ds-history-item {
      display: flex; justify-content: space-between; align-items: center;
      padding: 14px 18px;
      background: #1e293b; border-radius: 10px;
      border: 1px solid #334155;
      transition: opacity .3s;
    }
    .ds-history-item:nth-child(2) { opacity: .8; }
    .ds-history-item:nth-child(3) { opacity: .65; }
    .ds-history-item:nth-child(4) { opacity: .5; }
    .ds-history-item:nth-child(5) { opacity: .35; }
    .ds-history-item:nth-child(6) { opacity: .2; }
    .ds-h-ticket { font-size: 2.2rem; font-weight: 800; color: #38bdf8; }
    .ds-h-counter { font-size: 1rem; color: #64748b; font-weight: 600; }
    .ds-h-service { font-size: 11px; color: #475569; margin-top: 2px; }

    /* ── Overlay ── */
    .ds-overlay {
      position: fixed; inset: 0;
      background: #0f172a;
      z-index: 9999;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 24px;
    }
    .ds-overlay-logo {
      width: 72px; height: 72px; border-radius: 16px;
      background: #2490ef;
      display: flex; align-items: center; justify-content: center;
      font-weight: 900; font-size: 36px; color: #fff; margin-bottom: 8px;
    }
    .ds-overlay h1 { font-size: 28px; font-weight: 700; color: #f1f5f9; }
    .ds-overlay p { font-size: 14px; color: #64748b; text-align: center; max-width: 340px; line-height: 1.6; }
    .ds-btn-start {
      background: #2490ef; color: #fff; border: none;
      border-radius: 10px; padding: 16px 48px;
      font-size: 18px; font-weight: 700; cursor: pointer;
      transition: background .15s, transform .1s;
      box-shadow: 0 4px 20px rgba(36,144,239,.4);
    }
    .ds-btn-start:hover { background: #1a7fd4; transform: translateY(-2px); }
    .ds-btn-start:active { transform: scale(.98); }

    /* ── Counter Status Panel ── */
    .ds-counter-status {
      flex: 0.9; background: #0f172a;
      display: flex; flex-direction: column;
      padding: 24px 20px; overflow: auto;
      border-top: 1px solid #1e293b;
    }
    .ds-counter-status-title {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .15em; color: #475569; margin-bottom: 16px;
    }
    .ds-counter-grid {
      display: grid; grid-template-columns: 1fr; gap: 8px;
    }
    .ds-counter-item {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 14px; background: #1e293b; border-radius: 8px;
      border: 1px solid #334155; font-size: 12px;
    }
    .ds-counter-num { font-weight: 700; color: #e2e8f0; }
    .ds-status-badge {
      padding: 2px 10px; border-radius: 12px; font-size: 10px;
      font-weight: 700; text-transform: uppercase; letter-spacing: .05em;
    }
    .ds-status-badge.open { background: #166534; color: #86efac; }
    .ds-status-badge.closed { background: #7c2d12; color: #fdba74; }
    .ds-status-badge.break { background: #1e3a8a; color: #60a5fa; }

    /* ── Marked for Recall Panel ── */
    .ds-recall-panel {
      flex: 0.8; background: #0f172a;
      display: flex; flex-direction: column;
      padding: 20px; overflow: auto;
      border-top: 1px solid #1e293b;
    }
    .ds-recall-title {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .15em; color: #f59e0b; margin-bottom: 12px;
      display: flex; align-items: center; gap: 6px;
    }
    .ds-recall-list { display: flex; flex-direction: column; gap: 6px; }
    .ds-recall-item {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 12px; background: #7c2d12;
      border: 1px solid #f59e0b; border-radius: 6px;
      font-size: 11px;
    }
    .ds-recall-ticket { font-weight: 700; color: #fbbf24; font-size: 13px; }
    .ds-recall-customer { color: #fdba74; margin-top: 2px; }
    .ds-recall-empty { color: #475569; font-size: 12px; text-align: center; padding: 16px; }
  `;

  // ── Clock ────────────────────────────────────────────────────────────────
  const [time, setTime] = React.useState(new Date());
  React.useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Fullscreen handler ─────────────────────────────────────────────────────
  const handleFullscreen = () => {
    if (document.fullscreenElement) {
      // Exit fullscreen
      document.exitFullscreen().catch(err => {
        console.error('Exit fullscreen failed:', err);
      });
    } else {
      // Request fullscreen
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(err => {
          console.error('Fullscreen request failed:', err);
          frappe.show_alert({ message: "Fullscreen not supported", indicator: "red" });
        });
      } else {
        frappe.show_alert({ message: "Fullscreen not supported in this browser", indicator: "orange" });
      }
    }
  };

  // ── Listen for fullscreen changes ───────────────────────────────────────────
  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const fmt = (d) =>
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  // ── Overlay ───────────────────────────────────────────────────────────────
  if (!isStarted) {
    return (
      <div className="ds-overlay">
        <style>{styles}</style>
        <div className="ds-overlay-logo">Q</div>
        <h1>MOI Queue Display</h1>
        <p>Click the button below to initialize the display screen and enable audio announcements.</p>
        <button className="ds-btn-start" onClick={() => setIsStarted(true)}>
          Initialize Display
        </button>
        <p style={{ fontSize: 12, color: "#334155" }}>
          Audio requires a user interaction before browsers allow playback.
        </p>
      </div>
    );
  }

  // ── Main display ──────────────────────────────────────────────────────────
  return (
    <div className="ds-root">
      <style>{styles}</style>

      {/* Header */}
      <div className="ds-header qms-shell-header">
        <div className="ds-header-left qms-shell-brand">
          {ministryLogo ? (
            <img src={ministryLogo} style={{ height: 40, width: "auto", borderRadius: 8, flexShrink: 0 }} alt="Ministry Logo" />
          ) : (
            <div className="ds-logo qms-shell-logo"><Icon name="broadcast" style={{ marginRight: 0 }} /></div>
          )}
          <div>
            <div className="ds-title qms-shell-title"><Icon name="dashboard" /> Queue Management System</div>
            <div className="ds-subtitle qms-shell-subtitle">Ministry of Infrastructure · Public Display</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="ds-clock">{fmt(time)}</div>
          <button
            onClick={handleFullscreen}
            style={{
              background: "none",
              border: "1px solid #7dd3fc",
              color: "#38bdf8",
              padding: "6px 12px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              transition: "background .15s",
            }}
            onMouseEnter={(e) => e.target.style.background = "#1e3a5f"}
            onMouseLeave={(e) => e.target.style.background = "none"}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? "⛶ Exit" : "⛶ Fullscreen"}
          </button>
        </div>
      </div>

      {/* Ticker — live queue counts */}
      <div className="ds-ticker">
        <span className="ds-ticker-label">Waiting</span>
        <div className="ds-ticker-items">
          {queueCounts.length === 0 ? (
            <span style={{ fontSize: 12, color: "#475569" }}>Loading services…</span>
          ) : (
            queueCounts.map((q) => (
              <div className="ds-ticker-item" key={q.service}>
                <span className="ds-ticker-svc">{q.service}</span>
                <span className={`ds-ticker-count ${q.waiting === 0 ? "zero" : ""}`}>
                  {q.waiting}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Body */}
      <div className="ds-body">

        {/* Main panel */}
        <div className="ds-main">
          {isRecall && <div className="recall-badge"><Icon name="megaphone" /> Recall</div>}

          <div className="ds-now-label">Now Serving</div>

          <div className="ds-ticket-wrap">
            <div className={`ds-ticket${isRecall ? " recall-flash" : ""}`}>
              {nowServing.ticket}
            </div>
          </div>

          <div className="ds-divider" />

          <div className="ds-counter-label">Please Proceed to</div>
          <div className={`ds-counter-box${isRecall ? " recall-flash" : ""}`}>
            Counter {nowServing.counter}
          </div>

          {nowServing.service && (
            <div className="ds-service-tag">{nowServing.service}</div>
          )}
        </div>

        {/* History & Counter Status panel */}
        <div style={{ flex: "2.1", display: "flex", flexDirection: "column", background: "#0f172a", overflow: "hidden" }}>
          {/* History */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "32px 28px", overflow: "auto", borderRight: "1px solid #1e293b" }}>
            <div className="ds-history-title">Previously Called</div>
            <div className="ds-history-list">
              {history.length === 0 ? (
                <div style={{ color: "#334155", fontSize: 13, textAlign: "center", marginTop: 32 }}>
                  No previous tickets yet
                </div>
              ) : (
                history.map((item, i) => (
                  <div className="ds-history-item" key={i}>
                    <div>
                      <div className="ds-h-ticket">{item.ticket}</div>
                      {item.service && <div className="ds-h-service">{item.service}</div>}
                    </div>
                    <div className="ds-h-counter">C-{item.counter}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Counter Status & Marked for Recall */}
          <div style={{ flex: 1.7, display: "flex", overflow: "hidden" }}>
            {/* Counter Status */}
            <div className="ds-counter-status" style={{ flex: 1, borderRight: "1px solid #1e293b" }}>
              <div className="ds-counter-status-title">Counter Status</div>
              <div className="ds-counter-grid">
                {counterStatus.length === 0 ? (
                  <div style={{ fontSize: 12, color: "#475569", textAlign: "center" }}>
                    No counters configured
                  </div>
                ) : (
                  counterStatus.map((counter) => (
                    <div className="ds-counter-item" key={counter.name}>
                      <span className="ds-counter-num">Counter {counter.name}</span>
                      <span className={`ds-status-badge ${(counter.status || "Open").toLowerCase()}`}>
                        {counter.status || "Open"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Marked for Recall */}
            <div className="ds-recall-panel" style={{ flex: 1 }}>
              <div className="ds-recall-title">
                <Icon name="megaphone" style={{ marginRight: 4, color: "#f59e0b" }} />
                For Recall
              </div>
              <div className="ds-recall-list">
                {markedForRecall.length === 0 ? (
                  <div className="ds-recall-empty">No customers marked for recall</div>
                ) : (
                  markedForRecall.map((item) => (
                    <div className="ds-recall-item" key={item.name}>
                      <div>
                        <div className="ds-recall-ticket">{item.name.slice(-3)}</div>
                        <div className="ds-recall-customer">
                          {item.customer_name || "(No name)"} · C-{item.counter_number || "?"}
                        </div>
                      </div>
                      <div style={{ fontSize: "10px", color: "#fdba74", fontWeight: 600 }}>
                        {item.service_requested}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
