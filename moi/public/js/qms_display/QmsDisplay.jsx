import * as React from "react";
import { getQmsPageStyles } from "../qms_shared/qmsTheme";
import { useMinistryBranding } from "../qms_shared/useMinistryBranding";

export function QmsDisplay() {
  const [nowServing, setNowServing] = React.useState({ ticket: "---", counter: "--", service: "" });
  const [history, setHistory] = React.useState([]);
  const [isStarted, setIsStarted] = React.useState(false);
  const [isRecall, setIsRecall] = React.useState(false); // flashes the recall badge
  const [queueCounts, setQueueCounts] = React.useState([]); // per-service waiting counts

  // Ministry branding
  const { logo: ministryLogo } = useMinistryBranding();

  const Icon = ({ name, className = "", style = {} }) => (
    <i className={`octicon octicon-${name} ${className}`} style={{ marginRight: 6, ...style }} aria-hidden="true" />
  );

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

    fetchQueueCounts();
    const interval = setInterval(fetchQueueCounts, 20000);

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

      // Refresh queue counts after a call
      setTimeout(fetchQueueCounts, 1500);
    };

    const handleTicketRecalled = (data) => {
      const short = String(data.ticket_id).slice(-3);
      setIsRecall(true);
      announce(short, data.counter_number, true);

      // Flash the recall state, then clear after 8s
      setTimeout(() => setIsRecall(false), 8000);
    };

    frappe.realtime.on("ticket_called", handleTicketCalled);
    frappe.realtime.on("ticket_recalled", handleTicketRecalled);

    return () => {
      frappe.realtime.off("ticket_called", handleTicketCalled);
      frappe.realtime.off("ticket_recalled", handleTicketRecalled);
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
  `;

  // ── Clock ────────────────────────────────────────────────────────────────
  const [time, setTime] = React.useState(new Date());
  React.useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
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
        <div className="ds-clock">{fmt(time)}</div>
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

        {/* History panel */}
        <div className="ds-history">
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
      </div>
    </div>
  );
}
