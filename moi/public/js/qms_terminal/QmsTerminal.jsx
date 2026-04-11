import * as React from "react";
import { getQmsPageStyles } from "../qms_shared/qmsTheme";
import { useViewport } from "../qms_shared/useViewport";
import { useEposPrinter } from "../qms_shared/useEposPrinter";
import { useMinistryBranding } from "../qms_shared/useMinistryBranding";
import QRCode from "qrcode";

// ── Views: "service" | "checklist" | "ticket" | "feedback" | "feedback_entry" | "thanks"
export function QmsTerminal() {
  const [view, setView] = React.useState("service");
  const [services, setServices] = React.useState([]);
  const [ticketData, setTicketData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  const Icon = ({ name, className = "", style = {} }) => (
    <i className={`octicon octicon-${name} ${className}`} style={{ marginRight: 6, ...style }} aria-hidden="true" />
  );

  // Checklist state
  const [pendingService, setPendingService] = React.useState(null);
  const [checklistItems, setChecklistItems] = React.useState([]);
  const [checkedItems, setCheckedItems] = React.useState(new Set());

  // Feedback state
  const [fbTicket, setFbTicket] = React.useState("");
  const [fbRating, setFbRating] = React.useState(0);
  const [fbHover, setFbHover] = React.useState(0);
  const [fbComment, setFbComment] = React.useState("");
  const [fbError, setFbError] = React.useState("");
  const [fbSubmitting, setFbSubmitting] = React.useState(false);
  const [fbTicketInfo, setFbTicketInfo] = React.useState(null); // resolved ticket doc

  // Printer state
  const [printerConfig, setPrinterConfig] = React.useState(() => {
    try {
      return JSON.parse(localStorage.getItem("qms_printer_config") || "{}");
    } catch {
      return {};
    }
  });
  const [showPrinterSettings, setShowPrinterSettings] = React.useState(false);
  const epos = useEposPrinter(printerConfig);

  // Ministry branding
  const { logo: ministryLogo, name: ministryName } = useMinistryBranding();

  // Auto-return to service view timer
  const autoReturnRef = React.useRef(null);
  const scheduleReturn = (ms = 10000) => {
    if (autoReturnRef.current) clearTimeout(autoReturnRef.current);
    autoReturnRef.current = setTimeout(() => setView("service"), ms);
  };

  React.useEffect(() => {
    return () => {
      if (autoReturnRef.current) clearTimeout(autoReturnRef.current);
    };
  }, []);

  React.useEffect(() => {
    frappe.db.get_list("QMS Service", {
      fields: ["name", "image", "background_color"],
      filters: { is_active: 1 },
      order_by: "name asc",
    }).then(setServices).catch(console.error);
  }, []);

  // ── Checklist helpers ────────────────────────────────────────────────────
  const toggleItem = (itemName) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemName)) next.delete(itemName);
      else next.add(itemName);
      return next;
    });
  };

  const resetChecklist = () => {
    setPendingService(null);
    setChecklistItems([]);
    setCheckedItems(new Set());
  };

  // ── Ticket generation ────────────────────────────────────────────────────
  const createTicket = async (serviceName) => {
    setLoading(true);
    try {
      const res = await frappe.call({
        method: "moi.api.qms.create_ticket",
        args: { service_name: serviceName },
      });
      if (res.message) {
        const td = {
          fullNumber: res.message,
          displayNumber: res.message.slice(-3),
          service: serviceName,
          time: new Date().toLocaleString(),
        };
        setTicketData(td);
        setView("ticket");
        scheduleReturn(30000);
      }
    } catch (e) {
      frappe.show_alert({ message: "Error generating ticket", indicator: "red" });
    } finally {
      setLoading(false);
    }
  };

  const handleServiceSelect = async (serviceName) => {
    if (loading) return;
    setLoading(true);
    try {
      const svcDoc = await frappe.db.get_doc("QMS Service", serviceName);
      const items = svcDoc.checklist || [];
      if (items.length > 0) {
        setPendingService(serviceName);
        setChecklistItems(items);
        setCheckedItems(new Set());
        setView("checklist");
      } else {
        await createTicket(serviceName);
      }
    } catch (e) {
      frappe.show_alert({ message: "Error loading service", indicator: "red" });
    } finally {
      setLoading(false);
    }
  };

  const handleChecklistConfirm = async () => {
    const svc = pendingService;
    resetChecklist();
    await createTicket(svc);
  };

  const buildTicketPrintHtml = async (data) => {
    if (!data) return "";

    // Generate QR code as data URL
    let qrCodeDataUrl = "";
    try {
      qrCodeDataUrl = await QRCode.toDataURL(data.fullNumber, {
        errorCorrectionLevel: "M",
        type: "image/png",
        width: 120,
        margin: 1,
      });
    } catch (e) {
      console.warn("[buildTicketPrintHtml] QR code generation failed:", e);
    }

    return `<!doctype html>
      <html>
      <head>
        <title>QMS Ticket ${data.displayNumber}</title>
        <meta charset="UTF-8">
        <style>
          @page { size: 80mm 200mm; margin: 0; }
          html, body { width: 80mm; height: auto; margin: 0; padding: 0; }
          body { padding: 4mm; font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; width: 80mm; box-sizing: border-box; }
          .ticket { width: 100%; margin: 0 auto; text-align: center; padding: 4mm; box-sizing: border-box; }
          .header-logo { width: 100%; margin-bottom: 6px; max-width: 60px; margin-left: auto; margin-right: auto; }
          .ministry-name { font-size: 10pt; font-weight: 700; margin-bottom: 4px; letter-spacing: 0.05em; }
          .paper-info { font-size: 6pt; color: #999; margin-bottom: 4mm; border-bottom: 1px dotted #ccc; padding-bottom: 2mm; }
          .logo { font-size: 13px; font-weight: 900; letter-spacing: 0.08em; margin-bottom: 6px; }
          .title { font-size: 18pt; font-weight: 800; margin: 4px 0 10px; }
          .service { font-size: 11pt; margin-bottom: 10px; color: #444; }
          .num { font-size: 48pt; font-weight: 900; margin: 4px 0; }
          .sub { font-size: 9pt; margin: 4px 0; color: #222; }
          .barcode { margin: 12px 0; }
          .barcode-blob { width: 100%; height: 42px; display: flex; justify-content: center; align-items: center; gap: 1px; }
          .barcode-line { background: #000; height: 100%; }
          .narrow { width: 2px; }
          .wide { width: 4px; }
          .qr-code { margin: 12px auto; }
          .qr-code img { width: 100px; height: 100px; image-rendering: pixelated; }
          .footer { font-size: 8pt; border-top: 1px dashed #333; padding-top: 6px; margin-top: 12px; color: #333; }
          @media print {
            html, body { width: 80mm; height: auto; margin: 0; padding: 0; }
            .ticket { border: none; padding: 4mm; }
          }
        </style>
      </head>
      <body>
        <div class="ticket">
          ${ministryLogo ? `<img src="${ministryLogo}" class="header-logo" alt="Ministry Logo" />` : ""}
          <div class="ministry-name">${ministryName}</div>
          <div class="paper-info">POS Printer | 80mm</div>
          <div class="logo">QMS</div>
          <div class="title">Ticket #${data.displayNumber}</div>
          <div class="service">${data.service}</div>
          <div class="sub">${data.time}</div>
          <div class="num">${data.fullNumber}</div>
          <div class="barcode">
            <div class="barcode-blob">
              ${data.fullNumber.split("").map((char) => {
                const cls = char.charCodeAt(0) % 2 === 0 ? "wide" : "narrow";
                return `<div class="barcode-line ${cls}"></div>`;
              }).join("")}
            </div>
            <div style="font-size: 9pt; margin-top: 5px;">${data.fullNumber}</div>
          </div>
          ${qrCodeDataUrl ? `<div class="qr-code"><img src="${qrCodeDataUrl}" alt="QR Code" /></div>` : ""}
          <div class="footer">
            Present this ticket at the counter when called.<br />Thank you for your patience.
          </div>
        </div>
      </body>
      </html>`;
  };

  const printTicket = async () => {
    if (!ticketData) return;

    // Fallback: Browser popup print
    const printViaBrowser = async () => {
      const printWindow = window.open("", "_blank", "width=600,height=680");
      if (!printWindow) {
        frappe.show_alert({ message: "Unable to open print window. Please allow popups.", indicator: "red" });
        return;
      }

      const htmlContent = await buildTicketPrintHtml(ticketData);
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();

      // Wait for content to load then trigger print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 100);
      };

      // Timeout fallback
      setTimeout(() => {
        printWindow.print();
      }, 500);

      // Close window after print dialog closes
      printWindow.onafterprint = () => {
        printWindow.close();
      };

      scheduleReturn(20000);
    };

    // Strategy 1: Try EPSON ePOS SDK (if configured and SDK loaded)
    if (printerConfig.ip && epos.sdkReady) {
      try {
        await epos.printTicket(ticketData);
        frappe.show_alert({ message: "Ticket printed (EPSON)", indicator: "green" });
        scheduleReturn(5000);
        return;
      } catch (err) {
        console.warn("[QmsTerminal] EPSON print failed, trying next strategy:", err.message);
        // Fall through to next strategy
      }
    }

    // Strategy 2: Try local HTTP service at localhost:9100
    try {
      const response = await fetch("http://localhost:9100/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket_number: ticketData.fullNumber,
          display_number: ticketData.displayNumber,
          service: ticketData.service,
          time: ticketData.time,
          paper_width: "80mm"
        })
      });

      if (response.ok) {
        frappe.show_alert({ message: "Ticket printed (local service)", indicator: "green" });
        scheduleReturn(5000);
        return;
      }
    } catch (e) {
      console.log("[QmsTerminal] Local print service not available");
    }

    // Strategy 3: Browser popup fallback
    console.log("[QmsTerminal] Falling back to browser print");
    printViaBrowser();
  };

  // ── Feedback: look up ticket ─────────────────────────────────────────────
  const handleFeedbackLookup = async () => {
    setFbError("");
    if (!fbTicket.trim()) return setFbError("Please enter your ticket number.");
    setLoading(true);
    try {
      // Accept last-3-digits shorthand or full ticket name
      const filters = fbTicket.trim().length <= 3
        ? [["name", "like", `%${fbTicket.trim()}`]]
        : [["name", "=", fbTicket.trim()]];

      const res = await frappe.db.get_list("QMS Ticket", {
        filters: [...filters, ["status", "=", "Completed"]],
        fields: ["name", "service_requested", "status", "completed_at"],
        limit: 1,
      });

      if (!res || res.length === 0) {
        setFbError("Ticket not found or not yet completed. Please check your number.");
        setLoading(false);
        return;
      }

      // Check if already rated
      const existing = await frappe.db.get_list("QMS Feedback", {
        filters: [["ticket", "=", res[0].name]],
        limit: 1,
      });
      if (existing && existing.length > 0) {
        setFbError("This ticket has already been rated. Thank you!");
        setLoading(false);
        return;
      }

      setFbTicketInfo(res[0]);
      setFbRating(0);
      setFbComment("");
      setView("feedback_entry");
    } catch (e) {
      setFbError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Feedback: submit ─────────────────────────────────────────────────────
  const handleFeedbackSubmit = async () => {
    if (fbRating === 0) return setFbError("Please select a rating.");
    setFbError("");
    setFbSubmitting(true);
    try {
      await frappe.call({
        method: "moi.api.qms.submit_feedback",
        args: {
          ticket_id: fbTicketInfo.name,
          rating: fbRating,
          comment: fbComment,
        },
      });
      setView("thanks");
      scheduleReturn(8000);
    } catch (e) {
      setFbError("Failed to submit feedback. Please try again.");
    } finally {
      setFbSubmitting(false);
    }
  };

  const resetFeedback = () => {
    setFbTicket(""); setFbRating(0); setFbHover(0);
    setFbComment(""); setFbError(""); setFbTicketInfo(null);
  };

  // ── Grid sizing (responsive) ──────────────────────────────────────────────
  const vp = useViewport();
  const cols = (() => {
    if (vp.width < 600) return 1;
    if (vp.width < 1024) return services.length > 4 ? 3 : 2;
    return services.length > 4 ? 3 : 2;
  })();
  const cardH =
    vp.width < 600 ? "160px" :
    vp.width < 768 ? "180px" :
    vp.width < 1366 ? "220px" :
    "260px";
  const labelFs =
    vp.width < 600 ? "1.4rem" :
    vp.width < 768 ? "1.8rem" :
    vp.width < 1366 ? "2rem" :
    "2.6rem";

  const ratingLabels = ["", "Poor", "Fair", "Good", "Very Good", "Excellent"];
  const ratingColors = ["", "#ef4444", "#f97316", "#eab308", "#22c55e", "#15803d"];

  // ── Styles ────────────────────────────────────────────────────────────────
  const styles = `
    ${getQmsPageStyles("kt-root", { accent: "#1f7aec", surfaceTint: "#f8fafc" })}
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600;700;800&display=swap');

    /* ── Root ── */
    .kt-root {
      width: 100vw; height: 100vh;
      background: var(--qms-canvas);
      font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      display: flex; flex-direction: column;
      overflow: hidden;
    }

    /* ── Header ── */
    .kt-header {
      background: var(--qms-surface);
      border-bottom: 1px solid var(--qms-border);
      padding: 0 40px;
      height: 72px;
      display: flex; align-items: center; justify-content: space-between;
      flex-shrink: 0;
      box-shadow: var(--qms-shadow-soft);
    }
    .kt-header-left { display: flex; align-items: center; gap: 14px; }
    .kt-logo {
      width: 44px; height: 44px; border-radius: 10px;
      background: var(--qms-accent);
      display: flex; align-items: center; justify-content: center;
      font-weight: 900; font-size: 22px; color: #fff;
    }
    .kt-title { font-size: 18px; font-weight: 800; color: var(--qms-text); }
    .kt-subtitle { font-size: 12px; color: var(--qms-text-muted); margin-top: 1px; }
    .kt-header-right { display: flex; gap: 10px; }

    /* ── Frappe-style outlined button ── */
    .kt-btn {
      height: 36px; padding: 0 16px;
      border: 1px solid var(--qms-border-strong);
      border-radius: 12px;
      background: var(--qms-surface); color: var(--qms-text);
      font-size: 13px; font-weight: 600;
      cursor: pointer; display: flex; align-items: center; gap: 6px;
      transition: background .15s, border-color .15s;
    }
    .kt-btn:hover { background: var(--qms-surface-alt); border-color: var(--qms-border-strong); }
    .kt-btn.primary {
      background: var(--qms-accent); color: #fff; border-color: var(--qms-accent);
    }
    .kt-btn.primary:hover { background: #1a7fd4; border-color: #1a7fd4; }
    .kt-btn.primary:disabled { opacity: .5; cursor: not-allowed; }
    .kt-btn.danger { border-color: #feb2b2; color: #c0392b; }
    .kt-btn.danger:hover { background: #fdecea; }

    /* ── Body ── */
    .kt-body {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 40px 24px; overflow-y: auto;
    }

    .kt-ticket-card {
      width: min(480px, 100%);
      background: var(--qms-surface);
      border: 1px solid var(--qms-border);
      border-radius: 14px;
      box-shadow: var(--qms-shadow-soft);
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .kt-ticket-header { display: flex; align-items: center; gap: 12px; }
    .kt-ticket-logo {
      width: 44px; height: 44px; border-radius: 10px;
      background: var(--qms-accent); color: #fff;
      display: grid; place-items: center;
      font-weight: 900; font-size: 12px; letter-spacing: .06em;
    }
    .kt-ticket-title { font-size: 18px; font-weight: 700; }
    .kt-ticket-meta { color: var(--qms-text-muted); font-size: 12px; }

    .kt-ticket-main { text-align: center; }
    .kt-ticket-label { text-transform: uppercase; font-size: 10px; color: var(--qms-text-muted); letter-spacing: 0.08em; }
    .kt-ticket-number { font-size: 72px; font-weight: 900; letter-spacing: -0.04em; margin: 8px 0; }
    .kt-ticket-sub { font-size: 12px; color: var(--qms-text-muted); }
    .kt-ticket-time { font-size: 12px; color: var(--qms-text-muted); }

    .kt-ticket-barcode { border: 1px dashed var(--qms-border); border-radius: 8px; padding: 8px; }
    .kt-barcode-lines { display: flex; align-items: center; justify-content: center; gap: 1px; background: #fff; padding: 8px 2px;}
    .kt-barcode-line { display: inline-block; background: #333; height: 40px; }
    .kt-barcode-line.thin { width: 2px; }
    .kt-barcode-line.wide { width: 5px; }
    .kt-barcode-text { text-align: center; font-size: 10px; margin-top: 3px; color: #444; font-weight: 700; }

    .kt-ticket-actions { display: flex; justify-content: center; gap: 10px; }
    .kt-ticket-note { font-size: 12px; color: var(--qms-text-muted); text-align: center; }

    /* ── Section heading ── */
    .kt-heading {
      font-size: 2.4rem; font-weight: 800;
      color: var(--qms-text); text-align: center; margin-bottom: 36px;
    }
    .kt-heading span { color: var(--qms-accent); }

    /* ── Service grid ── */
    .kt-grid {
      display: grid;
      grid-template-columns: repeat(${cols}, 1fr);
      gap: 20px;
      width: 100%; max-width: 1100px;
    }
    .kt-service-card {
      position: relative;
      border-radius: 14px;
      height: ${cardH};
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; overflow: hidden;
      border: 2px solid rgba(0,0,0,.06);
      box-shadow: 0 4px 12px rgba(0,0,0,.08);
      transition: transform .12s ease, box-shadow .2s ease;
    }
    .kt-service-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,.13); }
    .kt-service-card:active { transform: scale(.97); }
    .kt-service-card .watermark {
      position: absolute; right: -5%; bottom: -5%;
      width: 55%; opacity: .09; pointer-events: none; z-index: 1;
      filter: grayscale(100%) brightness(0);
    }
    .kt-service-label {
      position: relative; z-index: 2;
      font-size: ${labelFs}; font-weight: 800;
      color: #1a365d; text-align: center;
      padding: 0 20px; line-height: 1.2;
      text-shadow: 0 1px 8px rgba(255,255,255,.6);
    }

    /* ── Ticket view ── */
    .kt-ticket-card {
      background: var(--qms-surface);
      border: 1px solid var(--qms-border);
      border-radius: 16px;
      padding: 48px 64px;
      text-align: center;
      box-shadow: 0 4px 20px rgba(0,0,0,.08);
      max-width: 520px; width: 100%;
      animation: slide-up .35s ease;
    }
    @keyframes slide-up {
      from { opacity: 0; transform: translateY(24px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .kt-ticket-tag {
      display: inline-block;
      background: var(--qms-info-soft); color: var(--qms-info);
      border-radius: 20px; padding: 4px 14px;
      font-size: 12px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .08em; margin-bottom: 16px;
    }
    .kt-ticket-big {
      font-size: 10rem; font-weight: 900; line-height: 1;
      color: var(--qms-accent); letter-spacing: -.02em;
    }
    .kt-ticket-prefix { font-size: 2.4rem; color: #d1d8dd; margin-right: 4px; }
    .kt-ticket-service { font-size: 1.2rem; color: #8d99a6; margin-top: 8px; font-weight: 500; }
    .kt-ticket-hint {
      margin-top: 24px; padding: 12px 16px;
      background: #f4f5f7; border-radius: 8px;
      font-size: 13px; color: #6b7280;
    }

    /* ── Feedback input view ── */
    .kt-feedback-card {
      background: var(--qms-surface);
      border: 1px solid var(--qms-border);
      border-radius: 16px;
      padding: 48px 56px;
      text-align: center;
      box-shadow: 0 4px 20px rgba(0,0,0,.08);
      max-width: 560px; width: 100%;
      animation: slide-up .35s ease;
    }
    .kt-fb-icon { font-size: 3rem; margin-bottom: 12px; }
    .kt-fb-title { font-size: 1.8rem; font-weight: 800; color: var(--qms-text); margin-bottom: 6px; }
    .kt-fb-sub { font-size: 14px; color: var(--qms-text-muted); margin-bottom: 28px; }

    .kt-input-wrap { text-align: left; margin-bottom: 20px; }
    .kt-input-wrap label {
      display: block; font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: .06em;
      color: var(--qms-text-muted); margin-bottom: 5px;
    }
    .kt-input {
      width: 100%; height: 48px; padding: 0 14px;
      border: 1px solid var(--qms-border-strong); border-radius: 12px;
      background: var(--qms-surface); font-size: 20px; font-weight: 700;
      color: var(--qms-text); letter-spacing: .1em; text-align: center;
      outline: none; font-family: inherit;
      transition: border-color .15s, box-shadow .15s;
    }
    .kt-input:focus {
      border-color: var(--qms-accent);
      box-shadow: 0 0 0 3px rgba(31,122,236,.15);
    }
    .kt-input.error { border-color: #ef4444; box-shadow: 0 0 0 3px rgba(239,68,68,.12); }

    .kt-textarea {
      width: 100%; padding: 12px 14px;
      border: 1px solid var(--qms-border-strong); border-radius: 12px;
      background: var(--qms-surface); font-size: 14px;
      color: var(--qms-text); outline: none; resize: none;
      font-family: inherit; line-height: 1.5;
      transition: border-color .15s, box-shadow .15s;
    }
    .kt-textarea:focus {
      border-color: var(--qms-accent);
      box-shadow: 0 0 0 3px rgba(31,122,236,.15);
    }

    /* ── Ticket info chip ── */
    .kt-ticket-chip {
      display: inline-flex; align-items: center; gap: 8px;
      background: var(--qms-surface-alt); border: 1px solid var(--qms-border);
      border-radius: 8px; padding: 8px 16px;
      font-size: 13px; margin-bottom: 24px;
    }
    .kt-ticket-chip .chip-num { font-weight: 800; color: var(--qms-accent); font-size: 16px; }
    .kt-ticket-chip .chip-svc { color: var(--qms-text-muted); }

    /* ── Star rating ── */
    .kt-stars { display: flex; justify-content: center; gap: 10px; margin: 8px 0 4px; }
    .kt-star {
      font-size: 3.2rem; cursor: pointer;
      transition: transform .12s ease, filter .12s ease;
      line-height: 1; user-select: none;
      filter: grayscale(1) opacity(.35);
    }
    .kt-star.active, .kt-star.hovered { filter: none; transform: scale(1.18); }
    .kt-star:hover { transform: scale(1.22); }
    .kt-rating-label {
      height: 22px; font-size: 14px; font-weight: 700;
      text-align: center; margin-bottom: 20px;
      transition: color .15s;
    }

    /* ── Error message ── */
    .kt-error {
      background: #fdecea; border: 1px solid #f5c6c2;
      border-radius: 7px; padding: 10px 14px;
      font-size: 13px; color: #c0392b;
      margin-bottom: 16px; text-align: left;
    }

    /* ── Thanks view ── */
    .kt-thanks-card {
      background: var(--qms-surface);
      border: 1px solid var(--qms-border);
      border-radius: 16px;
      padding: 64px 56px;
      text-align: center;
      box-shadow: 0 4px 20px rgba(0,0,0,.08);
      max-width: 480px; width: 100%;
      animation: slide-up .35s ease;
    }
    .kt-thanks-icon { font-size: 5rem; margin-bottom: 16px; animation: pop .4s ease; }
    @keyframes pop {
      0%   { transform: scale(0); }
      70%  { transform: scale(1.2); }
      100% { transform: scale(1); }
    }
    .kt-thanks-title { font-size: 2rem; font-weight: 800; color: var(--qms-text); margin-bottom: 8px; }
    .kt-thanks-sub { font-size: 15px; color: var(--qms-text-muted); }
    .kt-thanks-bar {
      height: 4px; background: #e2e6e9; border-radius: 4px;
      margin-top: 32px; overflow: hidden;
    }
    .kt-thanks-fill {
      height: 100%; background: #2490ef; border-radius: 4px;
      animation: shrink 8s linear forwards;
    }
    @keyframes shrink { from { width: 100%; } to { width: 0%; } }

    /* ── Checklist view ── */
    .kt-checklist-card {
      background: var(--qms-surface);
      border: 1px solid var(--qms-border);
      border-radius: 16px;
      padding: 48px 56px;
      box-shadow: 0 4px 20px rgba(0,0,0,.08);
      max-width: 640px; width: 100%;
      animation: slide-up .35s ease;
    }
    .kt-checklist-service-badge {
      display: inline-block;
      background: var(--qms-info-soft); color: var(--qms-info);
      border-radius: 20px; padding: 4px 14px;
      font-size: 12px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .08em; margin-bottom: 14px;
    }
    .kt-checklist-title {
      font-size: 1.8rem; font-weight: 800;
      color: var(--qms-text); margin-bottom: 6px;
    }
    .kt-checklist-sub {
      font-size: 14px; color: var(--qms-text-muted); margin-bottom: 28px;
    }
    .kt-checklist-items { display: flex; flex-direction: column; gap: 10px; margin-bottom: 28px; }
    .kt-check-row {
      display: flex; align-items: flex-start; gap: 16px;
      padding: 16px 18px;
      border: 2px solid var(--qms-border);
      border-radius: 12px;
      cursor: pointer;
      transition: border-color .15s, background .15s;
      user-select: none;
    }
    .kt-check-row:hover { border-color: var(--qms-accent); background: var(--qms-surface-alt); }
    .kt-check-row.checked { border-color: #22c55e; background: #f0fdf4; }
    .kt-check-box {
      width: 28px; height: 28px; min-width: 28px;
      border-radius: 8px; border: 2px solid var(--qms-border-strong);
      display: flex; align-items: center; justify-content: center;
      font-size: 15px; font-weight: 900;
      transition: background .15s, border-color .15s;
      color: transparent;
    }
    .kt-check-row.checked .kt-check-box { background: #22c55e; border-color: #22c55e; color: #fff; }
    .kt-check-label { flex: 1; }
    .kt-check-item-text { font-size: 15px; font-weight: 700; color: var(--qms-text); }
    .kt-check-required { color: #ef4444; margin-left: 3px; }
    .kt-check-desc { font-size: 13px; color: var(--qms-text-muted); margin-top: 3px; line-height: 1.4; }

    /* ── Responsive: small tablet portrait (7") ── */
    @media (max-width: 768px) {
      .kt-header { padding: 0 16px; height: 56px; }
      .kt-title { font-size: 15px; }
      .kt-subtitle { display: none; }
      .kt-body { padding: 24px 12px; }
      .kt-heading { font-size: 1.8rem; margin-bottom: 20px; }
      .kt-ticket-card { padding: 32px 24px; }
      .kt-ticket-big { font-size: 7rem; }
      .kt-feedback-card { padding: 32px 24px; }
      .kt-checklist-card { padding: 32px 24px; }
      .kt-star { font-size: 2.6rem; }
      .kt-btn { height: 44px; font-size: 15px; min-height: 48px; }
      .kt-check-row { padding: 14px 14px; }
      .kt-grid { gap: 12px; }
    }

    /* ── Responsive: large tablet landscape (iPad 10" / 12.9") ── */
    @media (min-width: 1024px) and (max-width: 1366px) {
      .kt-body { padding: 32px 24px; }
      .kt-grid { max-width: 960px; }
    }

    /* ── Responsive: kiosk desktop ── */
    @media (min-width: 1366px) {
      .kt-grid { max-width: 1400px; }
      .kt-service-card { border-radius: 18px; }
    }

    /* ── Portrait orientation forcing single column on narrow tablets ── */
    @media (max-width: 599px) {
      .kt-grid { grid-template-columns: 1fr !important; }
      .kt-service-card { height: 130px !important; }
      .kt-service-label { font-size: 1.4rem !important; }
    }

    /* ── Printer settings drawer ── */
    .kt-printer-panel-overlay {
      position: fixed; inset: 0; z-index: 199;
      background: rgba(0,0,0,0.3);
      opacity: 0; pointer-events: none;
      transition: opacity 0.2s;
    }
    .kt-printer-panel-overlay.open { opacity: 1; pointer-events: all; }

    .kt-printer-panel {
      position: fixed; top: 0; right: 0; bottom: 0;
      width: min(380px, 100vw);
      background: var(--qms-surface);
      border-left: 1px solid var(--qms-border);
      box-shadow: -8px 0 32px rgba(0,0,0,0.12);
      z-index: 200;
      display: flex; flex-direction: column;
      transform: translateX(100%);
      transition: transform 0.28s ease;
      padding: 24px;
      gap: 16px;
      overflow-y: auto;
    }
    .kt-printer-panel.open { transform: translateX(0); }

    .kt-printer-panel-title { font-size: 18px; font-weight: 700; color: var(--qms-text); }
    .kt-printer-panel-close {
      align-self: flex-end;
      background: none; border: none; cursor: pointer;
      font-size: 20px; color: var(--qms-text-muted);
      padding: 0; width: 28px; height: 28px;
      display: flex; align-items: center; justify-content: center;
    }
    .kt-printer-panel-close:hover { color: var(--qms-text); }

    .kt-printer-input-group { display: flex; flex-direction: column; gap: 6px; }
    .kt-printer-label { font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--qms-text-muted); }
    .kt-printer-input {
      height: 40px; padding: 0 12px;
      border: 1px solid var(--qms-border-strong); border-radius: 8px;
      background: var(--qms-surface); font-size: 14px;
      color: var(--qms-text); font-family: inherit;
      outline: none;
      transition: border-color 0.15s;
    }
    .kt-printer-input:focus { border-color: var(--qms-accent); box-shadow: 0 0 0 3px rgba(31,122,236,.15); }

    .kt-printer-status { display: flex; align-items: center; gap: 8px; padding: 12px; border-radius: 8px; background: var(--qms-surface-alt); }
    .kt-printer-status-dot { width: 8px; height: 8px; border-radius: 50%; }
    .kt-printer-status.ready .kt-printer-status-dot { background: #22c55e; }
    .kt-printer-status.error .kt-printer-status-dot { background: #ef4444; }
    .kt-printer-status.connecting .kt-printer-status-dot { background: #f59e0b; }
    .kt-printer-status.idle .kt-printer-status-dot { background: #9ca3af; }
    .kt-printer-status-text { font-size: 13px; font-weight: 600; color: var(--qms-text); flex: 1; text-transform: capitalize; }
    .kt-printer-status-error { font-size: 12px; color: #ef4444; margin-top: 4px; }

    .kt-printer-btn {
      height: 40px; padding: 0 16px;
      border: 1px solid var(--qms-border-strong);
      border-radius: 8px;
      background: var(--qms-accent); color: #fff;
      font-size: 13px; font-weight: 600;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: background 0.15s;
    }
    .kt-printer-btn:hover { background: #1a7fd4; }

    @media (max-width: 768px) {
      .kt-printer-panel { width: 100vw; border-left: none; border-top: 1px solid var(--qms-border); top: auto; height: 80vh; transform: translateY(100%); }
      .kt-printer-panel.open { transform: translateY(0); }
    }

    /* ── Print ── */
    @media print {
      body * { display: none !important; }
      #kt-print { display: block !important; width: 80mm; padding: 12px; text-align: center; font-family: "Helvetica", "Arial", sans-serif; color: black !important; background: white; }
      .pt-body { margin: 0; padding: 0; }
      .pt-logo { font-size: 13px; font-weight: 900; letter-spacing: 0.08em; margin-bottom: 4px; }
      .pt-title { font-size: 14pt; font-weight: 700; margin: 0 0 5px; }
      .pt-service { font-size: 10pt; margin-bottom: 10px; color: #444; }
      .pt-num { font-size: 38pt; font-weight: 900; margin: 4px 0; }
      .pt-sub { font-size: 8pt; margin: 6px 0 10px; }
      .pt-barcode { margin: 10px 0; }
      .pt-barcode-blob { width: 100%; height: 28px; display: flex; justify-content: center; align-items: center; gap: 1px; }
      .pt-barcode-line { background: #000; height: 100%; flex: 1; }
      .pt-barcode-line.narrow { width: 2px; }
      .pt-barcode-line.wide { width: 5px; }
      .pt-footer { font-size: 8pt; border-top: 1px dashed #333; padding-top: 6px; margin-top: 12px; color: #333; }
    }
    #kt-print { display: none; }
  `;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="kt-root">
      <style>{styles}</style>

      {/* Print template */}
      {ticketData && (
        <div id="kt-print" className="pt-body">
          <div className="pt-logo">MOI QMS</div>
          <div className="pt-title">Ticket #{ticketData.displayNumber}</div>
          <div className="pt-service">{ticketData.service}</div>
          <div className="pt-sub">{ticketData.time}</div>

          <div className="pt-barcode">
            <div className="pt-barcode-blob">
              {ticketData.fullNumber.split("").map((char, idx) => (
                <div
                  key={idx}
                  className={`pt-barcode-line ${char.charCodeAt(0) % 2 === 0 ? "wide" : "narrow"}`}
                />
              ))}
            </div>
            <div style={{ fontSize: "8pt", marginTop: 4 }}>{ticketData.fullNumber}</div>
          </div>

          <div className="pt-footer">
            <p>Present this ticket at the service counter when called.</p>
            <p>Thank you for your patience.</p>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="kt-header qms-shell-header">
        <div className="kt-header-left qms-shell-brand">
          <div className="kt-logo qms-shell-logo"><Icon name="device-desktop" style={{ marginRight: 0 }} /></div>
          <div>
            <div className="kt-title qms-shell-title"><Icon name="dashboard" /> Queue Management System</div>
            <div className="kt-subtitle qms-shell-subtitle">Ministry of Infrastructure · Self-Service Kiosk</div>
          </div>
        </div>
        <div className="kt-header-right qms-shell-actions">
          {view === "service" && (
            <button className="kt-btn qms-button btn btn-sm btn-light" onClick={() => setShowPrinterSettings(!showPrinterSettings)} title="Printer Settings">
              <Icon name="tools" style={{ marginRight: 6 }} />
              Printer
              {epos.status === "ready" && <span style={{ color: "#22c55e", marginLeft: 4, fontSize: 10, fontWeight: 700 }}>●</span>}
              {epos.status === "error" && <span style={{ color: "#ef4444", marginLeft: 4, fontSize: 10, fontWeight: 700 }}>●</span>}
            </button>
          )}
          {view !== "service" && (
            <button className="kt-btn qms-button btn btn-sm btn-light" onClick={() => {
              setTicketData(null);
              resetFeedback();
              resetChecklist();
              setView("service");
            }}>
              <Icon name="arrow-left" /> Back
            </button>
          )}
          {view === "service" && (
            <button className="kt-btn qms-button btn btn-sm btn-secondary" onClick={() => { resetFeedback(); setView("feedback"); }}>
              <Icon name="star" /> Rate My Experience
            </button>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="kt-body qms-content">

        {/* ── Service selection ── */}
        {view === "service" && (
          <>
            <div className="kt-heading">
              Select a <span>Service</span>
            </div>
            <div className="kt-grid">
              {services.map((s) => (
                <div
                  key={s.name}
                  className="kt-service-card"
                  style={{ backgroundColor: s.background_color || "#e8f4fd" }}
                  onClick={() => handleServiceSelect(s.name)}
                >
                  {s.image && <img src={s.image} className="watermark" alt="" />}
                  <span className="kt-service-label">{s.name}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Checklist ── */}
        {view === "checklist" && pendingService && (() => {
          const requiredItems = checklistItems.filter((i) => i.is_required);
          const allRequiredChecked =
            requiredItems.length === 0 ||
            requiredItems.every((i) => checkedItems.has(i.name));
          return (
            <div className="kt-checklist-card">
              <div className="kt-checklist-service-badge"><Icon name="checklist" /> {pendingService}</div>
              <div className="kt-checklist-title">Before You Proceed</div>
              <div className="kt-checklist-sub">
                Please confirm the following requirements. Items marked <span style={{ color: "#ef4444", fontWeight: 700 }}>*</span> are mandatory.
              </div>

              <div className="kt-checklist-items">
                {checklistItems.map((item) => {
                  const checked = checkedItems.has(item.name);
                  return (
                    <div
                      key={item.name}
                      className={`kt-check-row${checked ? " checked" : ""}`}
                      onClick={() => toggleItem(item.name)}
                    >
                      <div className="kt-check-box">{checked ? "✓" : ""}</div>
                      <div className="kt-check-label">
                        <div className="kt-check-item-text">
                          {item.checklist_item}
                          {item.is_required ? <span className="kt-check-required">*</span> : null}
                        </div>
                        {item.description ? (
                          <div className="kt-check-desc">{item.description}</div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                className="kt-btn qms-button primary"
                style={{ width: "100%", height: 48, fontSize: 15, justifyContent: "center" }}
                disabled={!allRequiredChecked || loading}
                onClick={handleChecklistConfirm}
              >
                {loading ? "Please wait…" : "Get Ticket →"}
              </button>
              <button
                className="kt-btn qms-button"
                style={{ width: "100%", height: 40, fontSize: 14, justifyContent: "center", marginTop: 10 }}
                onClick={() => { resetChecklist(); setView("service"); }}
              >
                ← Back
              </button>
            </div>
          );
        })()}

        {/* ── Ticket issued ── */}
        {view === "ticket" && ticketData && (
          <div className="kt-ticket-card">
            <div className="kt-ticket-header">
              <div className="kt-ticket-logo">MOI</div>
              <div>
                <div className="kt-ticket-title">Queue Management System</div>
                <div className="kt-ticket-meta">{ticketData.service}</div>
              </div>
            </div>

            <div className="kt-ticket-main">
              <div className="kt-ticket-label">Your number</div>
              <div className="kt-ticket-number">{ticketData.displayNumber}</div>
              <div className="kt-ticket-sub">Full Ticket ID: {ticketData.fullNumber}</div>
              <div className="kt-ticket-time">Issued at {ticketData.time}</div>
            </div>

            <div className="kt-ticket-barcode" aria-label="Barcode">
              <div className="kt-barcode-lines">
                {Array(24).fill(0).map((_, i) => (
                  <span key={i} className={`kt-barcode-line ${i % 7 === 0 ? "thick" : "thin"}`} />
                ))}
              </div>
              <div className="kt-barcode-text">{ticketData.fullNumber}</div>
            </div>

            <div className="kt-ticket-actions">
              <button className="kt-btn qms-button primary" onClick={printTicket} disabled={loading}>
                <Icon name="print" /> Print Ticket
              </button>
              <button className="kt-btn qms-button" onClick={() => { setTicketData(null); setView("service"); }}>
                <Icon name="x" /> Close
              </button>
            </div>

            <div className="kt-ticket-note">
              Please wait for your number to be displayed on the counter screen.
            </div>
          </div>
        )}

        {/* ── Feedback: enter ticket number ── */}
        {view === "feedback" && (
          <div className="kt-feedback-card">
            <div className="kt-fb-icon"><Icon name="star" /></div>
            <div className="kt-fb-title">Rate Your Experience</div>
            <div className="kt-fb-sub">Enter your ticket number to leave feedback</div>

            {fbError && <div className="kt-error">{fbError}</div>}

            <div className="kt-input-wrap">
              <label>Ticket Number</label>
              <input
                className={`kt-input${fbError ? " error" : ""}`}
                value={fbTicket}
                onChange={(e) => { setFbTicket(e.target.value.toUpperCase()); setFbError(""); }}
                placeholder="e.g. 042 or QMS-TICKET-0042"
                maxLength={30}
                onKeyDown={(e) => e.key === "Enter" && handleFeedbackLookup()}
              />
            </div>

            <button
              className="kt-btn qms-button primary"
              style={{ width: "100%", height: 44, fontSize: 15, justifyContent: "center" }}
              onClick={handleFeedbackLookup}
              disabled={loading}
            >
              {loading ? "Looking up…" : "Continue →"}
            </button>

            <button
              className="kt-btn qms-button"
              style={{ width: "100%", height: 40, fontSize: 14, justifyContent: "center", marginTop: 10 }}
              onClick={() => { resetFeedback(); setView("service"); }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* ── Feedback: star rating ── */}
        {view === "feedback_entry" && fbTicketInfo && (
          <div className="kt-feedback-card">
            <div className="kt-fb-icon">💬</div>
            <div className="kt-fb-title">How was your experience?</div>

            <div className="kt-ticket-chip">
              <span className="chip-num">#{fbTicketInfo.name.slice(-3)}</span>
              <span className="chip-svc">{fbTicketInfo.service_requested}</span>
            </div>

            {fbError && <div className="kt-error">{fbError}</div>}

            {/* Stars */}
            <div className="kt-stars">
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  className={`kt-star ${star <= (fbHover || fbRating) ? "active" : ""} ${star <= fbHover ? "hovered" : ""}`}
                  onMouseEnter={() => setFbHover(star)}
                  onMouseLeave={() => setFbHover(0)}
                  onClick={() => { setFbRating(star); setFbError(""); }}
                >
                  ★
                </span>
              ))}
            </div>

            <div
              className="kt-rating-label"
              style={{ color: fbRating ? ratingColors[fbRating] : "#d1d8dd" }}
            >
              {fbRating ? ratingLabels[fbRating] : "Tap a star to rate"}
            </div>

            {/* Optional comment */}
            <div className="kt-input-wrap">
              <label>Comments (optional)</label>
              <textarea
                className="kt-textarea"
                rows={3}
                value={fbComment}
                onChange={(e) => setFbComment(e.target.value)}
                placeholder="Tell us more about your visit…"
              />
            </div>

            <button
              className="kt-btn qms-button primary"
              style={{ width: "100%", height: 44, fontSize: 15, justifyContent: "center" }}
              onClick={handleFeedbackSubmit}
              disabled={fbSubmitting || fbRating === 0}
            >
              {fbSubmitting ? "Submitting…" : "Submit Feedback"}
            </button>

            <button
              className="kt-btn qms-button"
              style={{ width: "100%", height: 40, fontSize: 14, justifyContent: "center", marginTop: 10 }}
              onClick={() => { resetFeedback(); setView("feedback"); }}
            >
              ← Change Ticket
            </button>
          </div>
        )}

        {/* ── Thank you ── */}
        {view === "thanks" && (
          <div className="kt-thanks-card">
            <div className="kt-thanks-icon">🎉</div>
            <div className="kt-thanks-title">Thank You!</div>
            <div className="kt-thanks-sub">
              Your feedback has been submitted.<br />
              We appreciate you taking the time.
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 32 }}>
              <button
                className="kt-btn qms-button primary"
                onClick={() => { resetFeedback(); setView("service"); }}
              >
                Back to Home
              </button>
            </div>
            <div className="kt-thanks-bar">
              <div className="kt-thanks-fill" />
            </div>
          </div>
        )}

      </div>

      {/* ── Printer Settings Drawer ── */}
      <div className={`kt-printer-panel-overlay${showPrinterSettings ? " open" : ""}`} onClick={() => setShowPrinterSettings(false)} />
      <div className={`kt-printer-panel${showPrinterSettings ? " open" : ""}`}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="kt-printer-panel-title">Printer Settings</div>
          <button className="kt-printer-panel-close" onClick={() => setShowPrinterSettings(false)}>×</button>
        </div>

        <div className="kt-printer-input-group">
          <label className="kt-printer-label">IP Address</label>
          <input
            className="kt-printer-input"
            type="text"
            placeholder="e.g., 192.168.1.100"
            value={printerConfig.ip || ""}
            onChange={(e) => {
              const newConfig = { ...printerConfig, ip: e.target.value };
              setPrinterConfig(newConfig);
              localStorage.setItem("qms_printer_config", JSON.stringify(newConfig));
            }}
          />
        </div>

        <div className="kt-printer-input-group">
          <label className="kt-printer-label">Port</label>
          <input
            className="kt-printer-input"
            type="text"
            placeholder="8008"
            value={printerConfig.port || ""}
            onChange={(e) => {
              const newConfig = { ...printerConfig, port: e.target.value };
              setPrinterConfig(newConfig);
              localStorage.setItem("qms_printer_config", JSON.stringify(newConfig));
            }}
          />
        </div>

        <div className="kt-printer-input-group">
          <label className="kt-printer-label">Device ID</label>
          <input
            className="kt-printer-input"
            type="text"
            placeholder="local_printer"
            value={printerConfig.deviceId || ""}
            onChange={(e) => {
              const newConfig = { ...printerConfig, deviceId: e.target.value };
              setPrinterConfig(newConfig);
              localStorage.setItem("qms_printer_config", JSON.stringify(newConfig));
            }}
          />
        </div>

        {window.location.protocol === "https:" && printerConfig.port === "8008" && (
          <div style={{ padding: "10px 12px", background: "rgba(245, 158, 11, 0.1)", border: "1px solid #fbbf24", borderRadius: 8, fontSize: 12, color: "#92400e" }}>
            ⚠️ HTTPS detected but port is 8008 (HTTP). iOS will block this connection. Use port 8043 (HTTPS) instead.
          </div>
        )}

        <div className={`kt-printer-status ${epos.status}`}>
          <div className="kt-printer-status-dot" />
          <div className="kt-printer-status-text">{epos.status || "idle"}</div>
        </div>

        {epos.error && <div className="kt-printer-status-error">Error: {epos.error}</div>}

        <button className="kt-printer-btn" onClick={() => epos.testConnection()}>
          {epos.status === "connecting" ? "Testing..." : "Test Connection"}
        </button>
      </div>
    </div>
  );
}
