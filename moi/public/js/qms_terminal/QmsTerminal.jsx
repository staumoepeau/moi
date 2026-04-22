import * as React from "react";
import { getQmsPageStyles } from "../qms_shared/qmsTheme";
import { useViewport } from "../qms_shared/useViewport";
import { useMinistryBranding } from "../qms_shared/useMinistryBranding";
import QRCode from "qrcode";

// ── Views: "customer_type" | "payment_type" | "service" | "checklist" | "ticket" | "feedback" | "feedback_entry" | "thanks"
export function QmsTerminal() {
	const [view, setView] = React.useState("customer_type");
	const [services, setServices] = React.useState([]);
	const [ticketData, setTicketData] = React.useState(null);
	const [loading, setLoading] = React.useState(false);
	const [installPrompt, setInstallPrompt] = React.useState(null);
	const [isInstalled, setIsInstalled] = React.useState(false);
	const [isOnline, setIsOnline] = React.useState(navigator.onLine);

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

	// Pre-service selection state
	const [selectedCustomerType, setSelectedCustomerType] = React.useState(null);
	const [selectedPaymentMethod, setSelectedPaymentMethod] = React.useState(null);

	const resetPreService = () => {
		setSelectedCustomerType(null);
		setSelectedPaymentMethod(null);
	};

	// Ministry branding
	const { logo: ministryLogo, name: ministryName } = useMinistryBranding();

	// Auto-return to customer_type view timer
	const autoReturnRef = React.useRef(null);
	const scheduleReturn = (ms = 10000) => {
		if (autoReturnRef.current) clearTimeout(autoReturnRef.current);
		autoReturnRef.current = setTimeout(() => {
			resetPreService();
			setView("customer_type");
		}, ms);
	};

	React.useEffect(() => {
		return () => {
			if (autoReturnRef.current) clearTimeout(autoReturnRef.current);
		};
	}, []);

	// Load Font Awesome CSS early (before other styles)
	React.useEffect(() => {
		if (!document.querySelector('link[href*="font-awesome"]') && !document.querySelector('link[href*="fontawesome"]')) {
			const link = document.createElement('link');
			link.rel = 'stylesheet';
			link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
			// Insert at beginning of head
			if (document.head.firstChild) {
				document.head.insertBefore(link, document.head.firstChild);
			} else {
				document.head.appendChild(link);
			}
		}
	}, []);

	// ── PWA Installation Setup ──────────────────────────────────────────────
	React.useEffect(() => {
		// Register service worker
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.register('/assets/moi/service-worker.js', {
				scope: '/'
			})
				.then(registration => {
					console.log('[PWA] Service Worker registered:', registration);

					// Check for updates periodically
					const updateInterval = setInterval(() => {
						registration.update();
					}, 60000);

					return () => clearInterval(updateInterval);
				})
				.catch(error => {
					console.error('[PWA] Service Worker registration failed:', error);
				});
		}

		// Listen for install prompt
		const handleBeforeInstallPrompt = (e) => {
			e.preventDefault();
			setInstallPrompt(e);
			console.log('[PWA] Install prompt ready');
		};

		window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

		// Check if app is already installed
		if (window.navigator.standalone === true) {
			setIsInstalled(true);
			console.log('[PWA] App is installed (standalone mode)');
		}

		// Listen for online/offline events
		const handleOnline = () => {
			setIsOnline(true);
			frappe.show_alert({ message: 'Back online!', indicator: 'green' });
		};
		const handleOffline = () => {
			setIsOnline(false);
			frappe.show_alert({ message: 'You are offline', indicator: 'orange' });
		};

		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);

		return () => {
			window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
			window.removeEventListener('online', handleOnline);
			window.removeEventListener('offline', handleOffline);
		};
	}, []);

	// ── Install PWA Handler ──────────────────────────────────────────────────
	const handleInstallApp = async () => {
		if (!installPrompt) {
			frappe.show_alert({ message: 'App already installed or not available', indicator: 'blue' });
			return;
		}

		installPrompt.prompt();
		const { outcome } = await installPrompt.userChoice;

		if (outcome === 'accepted') {
			setInstallPrompt(null);
			setIsInstalled(true);
			frappe.show_alert({ message: 'App installed! You can use it offline now.', indicator: 'green' });
		}
	};



	React.useEffect(() => {
		frappe.db.get_list("QMS Service", {
			fields: ["name", "image", "background_color"],
			filters: { is_active: 1 },
			order_by: "name asc",
		}).then(setServices).catch(console.error);
	}, []);

	// Handle QR code scan - when ticket is scanned, navigate to feedback
	React.useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const ticketParam = params.get("ticket");
		const viewParam = params.get("view");

		if (ticketParam && viewParam === "feedback") {
			// QR was scanned, auto-populate feedback with ticket number
			setFbTicket(ticketParam);
			setView("feedback");
			// Clean up URL to avoid duplicate navigation
			window.history.replaceState({}, document.title, window.location.pathname);
		}
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
	// Preview ticket (generate number WITHOUT saving to DB)
	const previewTicket = async (serviceName) => {
		setLoading(true);
		try {
			const res = await frappe.call({
				method: "moi.api.qms.preview_ticket",
				args: { service_name: serviceName },
			});
			if (res.message) {
				const td = {
					fullNumber: res.message.predicted_name,
					displayNumber: res.message.display_number,
					service: serviceName,
					customerType: selectedCustomerType,
					paymentMethod: selectedPaymentMethod,
					time: new Date().toLocaleString(),
					isPending: true, // Mark as preview (not yet saved to DB)
				};
				setTicketData(td);
				setView("ticket");
				scheduleReturn(30000);
			}
		} catch (e) {
			frappe.show_alert({ message: "Error previewing ticket", indicator: "red" });
		} finally {
			setLoading(false);
		}
	};

	// Save ticket to database (ONLY called on print)
	const saveTicketToDB = async (serviceName) => {
		try {
			const res = await frappe.call({
				method: "moi.api.qms.create_ticket",
				args: {
					service_name: serviceName,
					customer_type: selectedCustomerType,
					payment_method: selectedPaymentMethod,
				},
			});
			return res.message; // Return the saved ticket name
		} catch (e) {
			console.error("[saveTicketToDB] Error:", e);
			throw e;
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
				// Preview the ticket (don't save yet)
				await previewTicket(serviceName);
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
		// Preview the ticket (don't save yet)
		await previewTicket(svc);
	};

	const buildTicketPrintHtml = async (data) => {
		if (!data) return "";

		// Generate QR code with feedback URL - when scanned, takes user to feedback page
		let qrCodeDataUrl = "";
		try {
			const baseUrl = window.location.origin;
			const feedbackUrl = `${baseUrl}${window.location.pathname}?ticket=${data.fullNumber}&view=feedback`;
			qrCodeDataUrl = await QRCode.toDataURL(feedbackUrl, {
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
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page { size: 80mm 200mm; margin: 0; }
          html, body { width: 100%; height: 100vh; font-family: 'Arial', sans-serif; background: #f5f5f5; }
          body { display: flex; align-items: center; justify-content: center; padding: 10px; }
          .ticket {
            width: 100%;
            max-width: 80mm;
            aspect-ratio: 80/200;
            text-align: center;
            padding: clamp(4mm, 5vw, 8mm);
            box-sizing: border-box;
            background: #fff;
            color: #000;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          .logo-area { margin: clamp(2mm, 3vw, 4mm) 0; }
          .logo-area img {
            width: clamp(30px, 8vw, 60px);
            height: auto;
            margin-bottom: clamp(2px, 2vw, 4px);
          }
          .ministry-name {
            font-size: clamp(8pt, 2.5vw, 12pt);
            font-weight: bold;
            letter-spacing: 0.05em;
            margin: clamp(1mm, 1.5vw, 3mm) 0;
            line-height: 1.2;
          }
          .service-name {
            font-size: clamp(10pt, 2vw, 12pt);
            margin: clamp(2mm, 2vw, 4mm) 0;
            font-weight: 500;
            line-height: 1.2;
          }
          .timestamp {
            font-size: clamp(8pt, 1.8vw, 10pt);
            color: #555;
            margin-bottom: clamp(3mm, 2vw, 6mm);
            border-bottom: 1px solid #ddd;
            padding-bottom: clamp(2mm, 1.5vw, 3mm);
          }
          .ticket-heading {
            font-size: clamp(24pt, 10vw, 40pt);
            font-weight: bold;
            letter-spacing: -1px;
            margin: clamp(3mm, 3vw, 6mm) 0 clamp(1mm, 1.5vw, 3mm) 0;
            line-height: 1;
            word-break: break-word;
          }
          .ticket-number {
            font-size: clamp(10pt, 2vw, 13pt);
            margin-bottom: clamp(3mm, 2vw, 6mm);
            color: #333;
            letter-spacing: 1px;
            font-family: 'Courier New', monospace;
            word-break: break-all;
          }
          .barcode-container { margin: clamp(6mm, 3vw, 10mm) 0; text-align: center; }
          .barcode-image {
            width: clamp(80px, 20vw, 120px);
            height: clamp(50px, 12vw, 80px);
            margin: 0 auto clamp(2px, 1vw, 4px);
            object-fit: contain;
          }
          .barcode-text {
            font-size: clamp(8pt, 1.5vw, 10pt);
            letter-spacing: 1px;
            font-weight: bold;
            margin-bottom: clamp(4mm, 2vw, 8mm);
          }
          .divider { border-top: 1px dashed #999; margin: clamp(2mm, 2vw, 4mm) 0; }
          .footer {
            font-size: clamp(7pt, 1.5vw, 9pt);
            line-height: 1.4;
            color: #444;
            margin-top: clamp(2mm, 1.5vw, 4mm);
          }
          @media print {
            body { background: #fff; padding: 0; }
            .ticket {
              box-shadow: none;
              border-radius: 0;
              aspect-ratio: unset;
              width: 80mm;
              max-width: unset;
              padding: 6mm;
            }
          }
        </style>
      </head>
      <body>
        <div class="ticket">
          <div class="logo-area">
            ${ministryLogo ? `<img src="${ministryLogo}" alt="Ministry Logo" />` : '<div style="font-size: 20pt; margin-bottom: 6px;">🏛️</div>'}
          </div>
          <div class="ministry-name">MINISTRY OF INFRASTRUCTURE</div>

          <div class="service-name">${data.service}</div>
          <div style="font-size: clamp(8pt,1.8vw,10pt); color: #555; margin-bottom: 2mm;">
            ${data.customerType || ''} ${data.customerType && data.paymentMethod ? '·' : ''} ${data.paymentMethod || ''}
          </div>
          <div class="timestamp">${data.time}</div>

          <div class="ticket-heading">Ticket #${data.displayNumber}</div>
          <div class="ticket-number">${data.fullNumber}</div>

          <div class="barcode-container">
            ${qrCodeDataUrl ? `<div class="barcode-image"><img src="${qrCodeDataUrl}" alt="QR Code" style="width: 100%; height: 100%; image-rendering: pixelated;" /></div>` : ""}
          </div>

          <div class="divider"></div>
          <div class="footer">
            Present this ticket at the counter<br />when called.<br /><br />Thank you for your patience.
          </div>
        </div>
      </body>
      </html>`;
	};

	// ── Detect if running as mobile app ──────────────────────────────────────
	const isMobileApp = () => {
		return /Android|iPhone|iPad|iPod/.test(navigator.userAgent) ||
			window.navigator.standalone === true;
	};

	// ── Mobile Printing (Direct to printer) ───────────────────────────────────
	const printTicketMobile = async (html) => {
		try {
			const printWindow = window.open("", "_blank");
			printWindow.document.write(html);
			printWindow.document.close();

			// For iOS (AirPrint)
			if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
				console.log('[Mobile Print] iOS - using AirPrint');
				setTimeout(() => {
					printWindow.print();
					setTimeout(() => {
						printWindow.close();
					}, 1000);
				}, 200);
				return;
			}

			// For Android
			if (/Android/.test(navigator.userAgent)) {
				console.log('[Mobile Print] Android - using Print Framework');
				setTimeout(() => {
					printWindow.print();
					setTimeout(() => {
						printWindow.close();
					}, 1000);
				}, 200);
				return;
			}

			// Fallback to regular print
			console.log('[Mobile Print] Fallback to regular print');
			printWindow.print();
		} catch (error) {
			console.error('[Mobile Print] Error:', error);
			frappe.show_alert({ message: 'Print failed: ' + error.message, indicator: 'red' });
		}
	};

	const printTicket = async () => {
		if (!ticketData) return;

		try {
			setLoading(true);

			// STEP 1: Save ticket to DB if pending
			if (ticketData.isPending) {
				const savedTicketName = await saveTicketToDB(ticketData.service);
				ticketData.fullNumber = savedTicketName;
				const lastNumber = savedTicketName.split("-").pop();
				ticketData.displayNumber = lastNumber.slice(-3).padStart(3, '0');
				ticketData.isPending = false;
			}

			setLoading(false);

			// STEP 2: Generate ticket HTML
			const ticketHtml = await buildTicketPrintHtml(ticketData);

			// STEP 3: Print - use mobile-optimized approach if on mobile
			if (isMobileApp()) {
				console.log('[Print] Using mobile printing');
				await printTicketMobile(ticketHtml);
			} else {
				console.log('[Print] Using web printing');
				const printWindow = window.open("", "_blank");
				printWindow.document.write(ticketHtml);
				printWindow.document.close();

				// Auto-trigger print
				printWindow.onload = function () {
					printWindow.print();
					setTimeout(() => {
						printWindow.close();
					}, 500);
				};
			}

			// Return to service view after print
			scheduleReturn(3000);

		} catch (err) {
			console.error("[printTicket] Error:", err);
			setLoading(false);
			frappe.show_alert({ message: "Error: " + err.message, indicator: "red" });
		}
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
    .kt-service-card .watermark-icon {
      position: absolute; right: -10%; bottom: -10%;
      font-size: 200px; opacity: .08; pointer-events: none; z-index: 1;
      color: #000;
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

    /* ── PWA Animations ── */
    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    /* ── Status Indicator ── */
    .status-online {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 4px;
      background: #e8f5e9;
      color: #2e7d32;
      font-size: 12px;
      font-weight: 600;
    }

    .status-offline {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 4px;
      background: #fce4ec;
      color: #c2185b;
      font-size: 12px;
      font-weight: 600;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .status-dot.online {
      background: #4caf50;
    }

    .status-dot.offline {
      background: #e91e63;
      animation: blink 1s infinite;
    }
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
				{/* PWA Status Bar */}
				{!isOnline && (
					<div style={{
						position: 'absolute',
						top: 0,
						left: 0,
						right: 0,
						height: '3px',
						background: '#e91e63',
						animation: 'blink 1s infinite',
					}} />
				)}

				<div className="kt-header-left qms-shell-brand">
					<div className="kt-logo qms-shell-logo"><Icon name="device-desktop" style={{ marginRight: 0 }} /></div>
					<div>
						<div className="kt-title qms-shell-title"><Icon name="dashboard" /> Queue Management System</div>
						<div className="kt-subtitle qms-shell-subtitle">Ministry of Infrastructure · Self-Service Kiosk</div>
					</div>
				</div>
				<div className="kt-header-right qms-shell-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
					{/* ── Online/Offline Status ── */}
					<div style={{
						display: 'flex',
						alignItems: 'center',
						gap: '6px',
						padding: '4px 10px',
						borderRadius: '4px',
						background: isOnline ? '#e8f5e9' : '#fce4ec',
						color: isOnline ? '#2e7d32' : '#c2185b',
						fontSize: '12px',
						fontWeight: '600',
					}}>
						<span style={{
							width: '8px',
							height: '8px',
							borderRadius: '50%',
							background: isOnline ? '#4caf50' : '#e91e63',
							animation: isOnline ? 'none' : 'blink 1s infinite',
						}} />
						{isOnline ? 'Online' : 'Offline'}
					</div>

					{/* ── Install App Button ── */}
					{installPrompt && !isInstalled && (
						<button
							onClick={handleInstallApp}
							style={{
								background: '#2490ef',
								color: 'white',
								border: 'none',
								padding: '6px 12px',
								borderRadius: '4px',
								fontSize: '12px',
								fontWeight: '600',
								cursor: 'pointer',
								display: 'flex',
								alignItems: 'center',
								gap: '6px',
								transition: 'all 0.2s',
							}}
							onMouseEnter={(e) => e.target.style.background = '#1a7fd4'}
							onMouseLeave={(e) => e.target.style.background = '#2490ef'}
							title="Install QMS as app for offline access"
						>
							<Icon name="download" /> Install App
						</button>
					)}


					{view !== "customer_type" && (
						<button className="kt-btn qms-button btn btn-sm btn-light" onClick={() => {
							setTicketData(null);
							resetFeedback();
							resetChecklist();
							if (view === "payment_type") {
								setSelectedCustomerType(null);
								setView("customer_type");
							} else if (view === "service") {
								setSelectedPaymentMethod(null);
								setView("payment_type");
							} else if (view === "checklist") {
								resetChecklist();
								setView("service");
							} else {
								resetPreService();
								resetChecklist();
								setView("customer_type");
							}
						}}>
							<Icon name="arrow-left" /> Back
						</button>
					)}
					{view === "customer_type" && (
						<button className="kt-btn qms-button btn btn-sm btn-secondary" onClick={() => { resetFeedback(); setView("feedback"); }}>
							<Icon name="star" /> Rate My Experience
						</button>
					)}
				</div>
			</div>

			{/* ── Body ── */}
			<div className="kt-body qms-content">

				{/* ── Customer Type selection ── */}
				{view === "customer_type" && (
					<div className="kt-checklist-card" style={{ maxWidth: 640, textAlign: "center" }}>
						<div className="kt-checklist-title">Welcome</div>
						<div className="kt-checklist-sub" style={{ marginBottom: 32 }}>
							Please select your customer type to get started.
						</div>
						<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
							{[
								{ label: "Individual", color: "#e8f4fd", subtitle: "" },
								{ label: "Business", color: "#fef3c7", subtitle: "Government Ministry" },
							].map(({ label, color, subtitle }) => (
								<div key={label} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
									<div
										className="kt-service-card"
										style={{ backgroundColor: color, height: cardH, cursor: "pointer" }}
										onClick={() => {
											setSelectedCustomerType(label);
											setView("payment_type");
										}}
									>
										<span className="kt-service-label">{label}</span>
									</div>
									{subtitle && (
										<div style={{ fontSize: "13px", color: "#666", fontWeight: 500 }}>
											{subtitle}
										</div>
									)}
								</div>
							))}
						</div>
					</div>
				)}

				{/* ── Payment Method selection ── */}
				{view === "payment_type" && (
					<div className="kt-checklist-card" style={{ maxWidth: 640, textAlign: "center" }}>
						<div className="kt-checklist-service-badge">
							<Icon name="person" /> {selectedCustomerType}
						</div>
						<div className="kt-checklist-title">Payment Method</div>
						<div className="kt-checklist-sub" style={{ marginBottom: 32 }}>
							How will you be paying today?
						</div>
						<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
							{[
								{ label: "Cash", color: "#f0fdf4" },
								{ label: "Cheque", color: "#f5f3ff" },
							].map(({ label, color }) => (
								<div
									key={label}
									className="kt-service-card"
									style={{ backgroundColor: color, height: cardH, cursor: "pointer" }}
									onClick={() => {
										setSelectedPaymentMethod(label);
										setView("service");
									}}
								>
									<span className="kt-service-label">{label}</span>
								</div>
							))}
						</div>
					</div>
				)}

				{/* ── Service selection ── */}
				{view === "service" && (
					<>
						{/* <div className="kt-heading">
							Select a <span>Service</span>
						</div> */}
						<div className="kt-grid">
							{services.map((s) => (
								<div
									key={s.name}
									className="kt-service-card"
									style={{ backgroundColor: s.background_color || "#e8f4fd" }}
									onClick={() => handleServiceSelect(s.name)}
								>
									{s.image && <i className={`fas ${s.image} watermark-icon`} aria-hidden="true" />}
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
					<div className="kt-ticket-card" style={{
						display: "flex",
						flexDirection: "column",
						gap: "clamp(12px, 4vw, 20px)",
						padding: "clamp(16px, 5vw, 32px)",
						maxWidth: "30%",
						margin: "0 auto"
					}}>
						{/* Header: Ministry branding */}
						<div style={{ textAlign: "center" }}>
							{ministryLogo ? (
								<img src={ministryLogo} style={{
									width: "clamp(40px, 10vw, 80px)",
									height: "auto",
									marginBottom: "clamp(6px, 2vw, 12px)"
								}} alt="Ministry Logo" />
							) : (
								<div style={{ fontSize: "clamp(32px, 10vw, 48px)", marginBottom: "clamp(6px, 2vw, 12px)" }}>🏛️</div>
							)}
							<div style={{
								fontSize: "clamp(11px, 3vw, 14px)",
								fontWeight: "bold",
								letterSpacing: "0.05em",
								color: "#333",
								lineHeight: "1.2"
							}}>
								MINISTRY OF INFRASTRUCTURE
							</div>
						</div>

						{/* Service and timestamp */}
						<div style={{ textAlign: "center" }}>
							<div style={{
								fontSize: "clamp(13px, 2.5vw, 16px)",
								color: "#666",
								marginBottom: "clamp(4px, 1vw, 8px)",
								lineHeight: "1.2"
							}}>{ticketData.service}</div>
							<div style={{
								fontSize: "clamp(11px, 2vw, 13px)",
								color: "#999",
								lineHeight: "1.2"
							}}>{ticketData.time}</div>
						</div>

						{/* Main ticket heading */}
						<div style={{ textAlign: "center" }}>
							<div style={{
								fontSize: "clamp(32px, 12vw, 56px)",
								fontWeight: "900",
								letterSpacing: "-2px",
								color: "#000",
								lineHeight: "1",
								wordBreak: "break-word"
							}}>
								Ticket #{ticketData.displayNumber}
							</div>
						</div>

						{/* Full ticket number */}
						<div style={{
							textAlign: "center",
							fontSize: "clamp(12px, 2.5vw, 16px)",
							color: "#333",
							fontFamily: "monospace",
							fontWeight: "bold",
							letterSpacing: "1px",
							wordBreak: "break-all"
						}}>
							{ticketData.fullNumber}
						</div>

						{/* QR Code - only shown in actual print output, hidden in preview */}

						{/* Divider */}
						<div style={{ borderTop: "1px dashed #999" }} />

						{/* Footer message */}
						<div style={{
							textAlign: "center",
							fontSize: "clamp(11px, 2vw, 13px)",
							color: "#666",
							lineHeight: "1.6"
						}}>
							Present this ticket at the counter<br />when called.<br /><br />Thank you for your patience.
						</div>

						{/* Action buttons */}
						<div className="kt-ticket-actions">
							<button className="kt-btn qms-button primary" onClick={printTicket} disabled={loading} style={{ flex: 1 }}>
								<Icon name="print" /> Print Ticket
							</button>
							<button className="kt-btn qms-button" onClick={() => { setTicketData(null); resetPreService(); setView("customer_type"); }} style={{ flex: 1 }}>
								<Icon name="x" /> Close
							</button>
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
							onClick={() => { resetFeedback(); setView("customer_type"); }}
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
								onClick={() => { resetFeedback(); resetPreService(); setView("customer_type"); }}
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
		</div>
	);
}
