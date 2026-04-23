import * as React from "react";
import { getQmsPageStyles, qmsStatusTone } from "../qms_shared/qmsTheme";
import { useMinistryBranding } from "../qms_shared/useMinistryBranding";

export function QmsConsole() {
	const currentUser = frappe.session.user;
	const currentUserInfo = frappe.boot.user_info?.[currentUser] || {};
	const currentUserName = currentUserInfo.fullname || currentUser;
	const userImage = currentUserInfo.image || null;
	const userRole = frappe.session.user_roles?.[0] || "User";
	const initials = currentUserName.split(" ").filter(Boolean).map(w => w[0]).join("").toUpperCase().slice(0, 2);

	// Ministry branding
	const { logo: ministryLogo } = useMinistryBranding();

	const [userMenuOpen, setUserMenuOpen] = React.useState(false);
	const userMenuRef = React.useRef(null);

	const Icon = ({ name, className = "", style = {} }) => (
		<i className={`octicon octicon-${name} ${className}`} style={{ marginRight: 6, ...style }} aria-hidden="true" />
	);

	React.useEffect(() => {
		const handler = (e) => {
			if (userMenuRef.current && !userMenuRef.current.contains(e.target))
				setUserMenuOpen(false);
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, []);

	const handleLogout = () => {
		frappe.confirm("Are you sure you want to log out?", () => {
			window.location.href = "/logout";
		});
	};

	// Initialize activeTicket from localStorage (survives page refresh)
	const [activeTicket, setActiveTicketState] = React.useState(() => {
		const saved = localStorage.getItem("qms_activeTicket");
		return saved ? JSON.parse(saved) : null;
	});
	const setActiveTicket = (ticket) => {
		setActiveTicketState(ticket);
		if (ticket) {
			localStorage.setItem("qms_activeTicket", JSON.stringify(ticket));
		} else {
			localStorage.removeItem("qms_activeTicket");
		}
	};

	const [counter, setCounter] = React.useState(localStorage.getItem("qms_counter") || "");
	const [status, setStatus] = React.useState(localStorage.getItem("qms_status") || "Closed");
	const [stats, setStats] = React.useState({ served: 0, waiting: 0 });
	const [queueDashboard, setQueueDashboard] = React.useState([]);
	const [countersList, setCountersList] = React.useState([]);
	const [servicesList, setServicesList] = React.useState([]);
	const [loading, setLoading] = React.useState(false);
	const [calledTicket, setCalledTicket] = React.useState(null);

	// ── Fetch per-service queue counts ──────────────────────────────────────
	const fetchQueueDashboard = async (services) => {
		const list = services || servicesList;
		if (!list.length) return;
		try {
			const results = await Promise.all(
				list.map(async (svc) => {
					const waiting = await frappe.db.count("QMS Ticket", {
						filters: { service_requested: svc, status: "Waiting" },
					});
					const serving = await frappe.db.count("QMS Ticket", {
						filters: { service_requested: svc, status: "Serving" },
					});
					const todayStart = frappe.datetime.get_today();
					const completed = await frappe.db.count("QMS Ticket", {
						filters: {
							service_requested: svc,
							status: "Completed",
							completed_at: [">=", todayStart],
						},
					});
					return { service: svc, waiting, serving, completed };
				})
			);
			setQueueDashboard(results);
		} catch (e) {
			console.error("Queue dashboard fetch failed:", e);
		}
	};

	// ── Check if another ticket is being called ─────────────────────────────
	const checkCalledTicket = async () => {
		try {
			const called = await frappe.db.get_list("QMS Ticket", {
				filters: { status: "Called" },
				fields: ["name", "officer", "counter"],
				limit: 1
			});
			setCalledTicket(called.length > 0 ? called[0] : null);
		} catch (e) {
			console.error("Failed to check called ticket:", e);
		}
	};

	// ── Fetch officer stats ──────────────────────────────────────────────────
	const fetchStats = async () => {
		if (!counter) return;
		try {
			const todayStart = frappe.datetime.get_today();
			const servedCount = await frappe.db.count("QMS Ticket", {
				filters: {
					counter: counter,
					officer: currentUser,
					status: "Completed",
					completed_at: [">=", todayStart],
				},
			});
			const waitingCount = await frappe.db.count("QMS Ticket", {
				filters: { status: "Waiting" },
			});
			setStats({ served: servedCount, waiting: waitingCount });
			await checkCalledTicket();
		} catch (e) {
			console.error("Failed to fetch stats:", e);
		}
	};

	// ── Bootstrap: load counters + services ─────────────────────────────────
	React.useEffect(() => {
		const fetchData = async () => {
			try {
				const counterRes = await frappe.db.get_list("QMS Counter", {
					fields: ["counter_number"],
					order_by: "counter_number asc",
				});
				setCountersList(counterRes.map((c) => c.counter_number).filter(Boolean));

				const serviceRes = await frappe.db.get_list("QMS Service", {
					fields: ["name"],
					filters: { is_active: 1 },
					order_by: "name asc",
				});
				const names = serviceRes.map((s) => s.name);
				setServicesList(names);
				fetchQueueDashboard(names);
			} catch (e) {
				console.error("Failed to fetch data:", e);
			}
		};
		fetchData();
	}, []);

	// ── Auto-refresh ─────────────────────────────────────────────────────────
	React.useEffect(() => {
		fetchStats();
		fetchCompletedTickets();
		checkCalledTicket();
		const interval = setInterval(() => {
			fetchStats();
			fetchQueueDashboard();
			fetchCompletedTickets();
			checkCalledTicket();
		}, 20000);
		return () => clearInterval(interval);
	}, [counter, activeTicket?.name]);

	// ── Handlers ─────────────────────────────────────────────────────────────
	const handleStatusChange = async (newStatus) => {
		if (!counter) return frappe.msgprint("Please select a Counter first");
		setLoading(true);
		try {
			await frappe.call({
				method: "moi.api.qms.update_counter_status",
				args: { counter_number: counter, status: newStatus, service: "", officer: currentUser },
			});
			setStatus(newStatus);
			localStorage.setItem("qms_status", newStatus);
			frappe.show_alert({
				message: `Counter ${counter} is now ${newStatus}`,
				indicator: newStatus === "Open" ? "green" : "orange",
			});
		} catch (e) {
			console.error("Status Update Error:", e);
			frappe.msgprint("Error updating counter status.");
		} finally {
			setLoading(false);
		}
	};

	const handleCounterChange = (val) => {
		setCounter(val);
		if (val) localStorage.setItem("qms_counter", val);
		else localStorage.removeItem("qms_counter");
	};

	const handleCallNext = async () => {
		if (status !== "Open") return frappe.msgprint("Counter must be OPEN to call customers");
		if (!counter) return frappe.msgprint("Please select a Counter");
		if (calledTicket) {
			frappe.msgprint(`Ticket ${calledTicket.name} is already being served. Please finish before calling the next customer.`);
			return;
		}
		setLoading(true);
		try {
			const res = await frappe.call({
				method: "moi.api.qms.call_next_ticket",
				args: { counter_number: counter, officer: currentUser },
			});
			if (res.message) {
				const ticketDetail = await frappe.db.get_doc("QMS Ticket", res.message);
				setActiveTicket(ticketDetail);
				await checkCalledTicket();
			} else {
				frappe.msgprint("No customers waiting in queue");
			}
		} catch (e) {
			console.error(e);
			await checkCalledTicket();
		} finally {
			setLoading(false);
		}
	};

	const [recallCount, setRecallCount] = React.useState(0);
	const [recalling, setRecalling] = React.useState(false);

	const [completedTickets, setCompletedTickets] = React.useState([]);
	const [recallPanelOpen, setRecallPanelOpen] = React.useState(false);
	const [recallingId, setRecallingId] = React.useState(null);

	const handleRecall = async () => {
		if (!activeTicket) return;
		setRecalling(true);
		try {
			await frappe.call({
				method: "moi.api.qms.recall_ticket",
				args: {
					ticket_id: activeTicket.name,
					counter_number: counter,
					officer: currentUser,
				},
			});
		} finally {
			setRecallCount((c) => c + 1);
			frappe.show_alert({
				message: `Ticket ${activeTicket.name} recalled (×${recallCount + 1})`,
				indicator: "orange",
			});
			setRecalling(false);
		}
	};

	const handleNoShow = async () => {
		if (!activeTicket) return;
		const confirm = await new Promise((resolve) => {
			frappe.confirm(
				`Mark ticket <b>${activeTicket.name}</b> as No Show?`,
				() => resolve(true),
				() => resolve(false)
			);
		});
		if (!confirm) return;

		setLoading(true);
		try {
			await frappe.call({
				method: "moi.api.qms.no_show",
				args: {
					ticket_id: activeTicket.name,
					officer: currentUser,
					counter_number: counter,
				},
			});
			setActiveTicket(null);
			setRecallCount(0);
			fetchStats();
			fetchQueueDashboard();
			await checkCalledTicket();
			frappe.show_alert({ message: `Ticket ${activeTicket.name} marked as No Show`, indicator: "red" });
		} catch (e) {
			console.error(e);
		} finally {
			setLoading(false);
		}
	};

	const fetchCompletedTickets = async () => {
		if (!counter) return;
		try {
			const result = await frappe.call({
				method: "moi.api.qms.get_completed_tickets",
				args: { counter_number: counter, limit: 5 },
			});
			setCompletedTickets(result.message || []);
		} catch (e) {
			console.error("fetchCompletedTickets failed:", e);
		}
	};

	const handleComplete = async () => {
		if (!activeTicket) return;
		if (!activeTicket.customer_id || !activeTicket.customer_name)
			return frappe.msgprint("Please enter ID and Name");
		setLoading(true);
		try {
			await frappe.call({
				method: "moi.api.qms.complete_service",
				args: {
					ticket_id: activeTicket.name,
					customer_name: activeTicket.customer_name,
					customer_id: activeTicket.customer_id,
					officer: currentUser,
				},
			});
			setActiveTicket(null);
			setRecallCount(0);
			await checkCalledTicket();
			fetchStats();
			fetchQueueDashboard();
			fetchCompletedTickets();
			frappe.show_alert({ message: "Service Completed", indicator: "green" });
		} finally {
			setLoading(false);
		}
	};

	const handleCompleteWithRecall = () => {
		if (!activeTicket) return;
		if (!activeTicket.customer_id || !activeTicket.customer_name)
			return frappe.msgprint("Please enter ID and Name before marking for recall");

		frappe.prompt(
			[{ fieldname: "recall_reason", fieldtype: "Small Text", label: "Recall Reason", reqd: 1 }],
			async ({ recall_reason }) => {
				setLoading(true);
				try {
					await frappe.call({
						method: "moi.api.qms.complete_with_recall",
						args: {
							ticket_id: activeTicket.name,
							customer_name: activeTicket.customer_name,
							customer_id: activeTicket.customer_id,
							recall_reason,
						},
					});
					setActiveTicket(null);
					setRecallCount(0);
					fetchStats();
											await checkCalledTicket();
					fetchQueueDashboard();
					fetchCompletedTickets();
					frappe.show_alert({ message: "Ticket marked for recall", indicator: "orange" });
				} finally {
					setLoading(false);
				}
			},
			"Mark for Recall",
			"Confirm"
		);
	};

	const handleRecallCompleted = async (ticket) => {
		setRecallingId(ticket.name);
		try {
			await frappe.call({
				method: "moi.api.qms.recall_ticket",
				args: {
					ticket_id: ticket.name,
					counter_number: counter,
					officer: currentUser,
				},
			});
			frappe.show_alert({
				message: `${ticket.customer_name || ticket.name} recalled to counter ${counter}`,
				indicator: "orange",
			});
		} finally {
			setRecallingId(null);
		}
	};

	const handleCloseRecall = async (ticket) => {
		setRecallingId(ticket.name);
		try {
			await frappe.call({
				method: "moi.api.qms.close_recall",
				args: {
					ticket_id: ticket.name,
				},
			});
			fetchCompletedTickets();
			frappe.show_alert({
				message: `Recall closed for ${ticket.customer_name || ticket.name}`,
				indicator: "green",
			});
		} finally {
			setRecallingId(null);
		}
	};

	// ── Status helpers ────────────────────────────────────────────────────────
	const statusIndicator = qmsStatusTone(status);

	// ── Styles ────────────────────────────────────────────────────────────────
	const styles = `
    ${getQmsPageStyles("qms-root", { accent: "#1f7aec", surfaceTint: "#f7fafc" })}

    /* ── Root: Fill viewport without scroll ── */
    .qms-root {
      display: flex;
      flex-direction: column;
      height: 100vh;
      width: 100vw;
      overflow: hidden;
    }

    /* ── Topbar ── */
    .qms-topbar {
      background: var(--qms-surface);
      border-bottom: 1px solid var(--qms-border);
      padding: 0 12px;
      display: flex; align-items: center; justify-content: space-between;
      height: 48px; flex-shrink: 0;
      box-shadow: var(--qms-shadow-soft);
      gap: 8px;
      flex-wrap: nowrap;
    }
    .qms-topbar-left { display: flex; align-items: center; gap: 8px; min-width: 200px; }
    .qms-topbar-logo {
      width: 28px; height: 28px; border-radius: 4px;
      background: var(--qms-accent);
      display: flex; align-items: center; justify-content: center;
      color: white; font-weight: 700; font-size: 14px; flex-shrink: 0;
    }
    .qms-topbar-title { font-weight: 600; font-size: 13px; white-space: nowrap; }
    .qms-topbar-sub { font-size: 10px; color: var(--qms-text-muted); white-space: nowrap; display: none; }
    .qms-topbar-right { display: flex; align-items: center; gap: 6px; overflow: visible; }
    .qms-toolbar-group {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: nowrap;
    }
    .qms-inline-field {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }
    .qms-inline-label {
      font-size: 10px;
      font-weight: 600;
      color: #4f5d75;
      white-space: nowrap;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* Frappe-style select */
    .qms-select {
      height: 32px;
      min-width: 70px;
      padding: 0 28px 0 10px;
      border: 1px solid #cfd7e3;
      border-radius: 0px;
      background: var(--qms-surface);
      color: var(--qms-text);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      outline: none;
      box-shadow: 0 1px 1px rgba(15, 23, 42, 0.02);
    }
    .qms-select:hover { border-color: #b9c4d3; }
    .qms-select:focus {
      border-color: var(--qms-accent);
      box-shadow: 0 0 0 3px rgba(31,122,236,.12), 0 1px 2px rgba(15, 23, 42, 0.04);
    }
    .qms-select.service { min-width: 130px; }
    .qms-select.counter { min-width: 70px; }
    .qms-select.status { min-width: 90px; }

    /* Frappe indicator badge */
    .indicator-pill {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 3px 10px; border-radius: 20px;
      font-size: 12px; font-weight: 500;
    }
    .indicator-pill::before {
      content: ''; width: 6px; height: 6px;
      border-radius: 50%; flex-shrink: 0;
    }
    .indicator-pill.green { background: #e4f5e9; color: #2c7a45; }
    .indicator-pill.green::before { background: #2c7a45; }
    .indicator-pill.orange { background: #fef3e2; color: #c07a00; }
    .indicator-pill.orange::before { background: #c07a00; }
    .indicator-pill.red { background: #fdecea; color: #c0392b; }
    .indicator-pill.red::before { background: #c0392b; }
    .indicator-pill.gray { background: #f0f0f0; color: #777; }
    .indicator-pill.gray::before { background: #aaa; }
    .indicator-pill.blue { background: #e3f2fd; color: #1565c0; }
    .indicator-pill.blue::before { background: #1565c0; }

    /* ── Workspace ── */
    .qms-body {
      flex: 1;
      overflow: hidden;
      padding: 8px;
      display: flex;
      flex-direction: column;
    }
    .qms-workspace {
      display: grid;
      grid-template-columns: 1fr 1.2fr;
      gap: 8px;
      height: 100%;
      width: 100%;
      min-height: 0;
    }
    .qms-panel {
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
      background: var(--qms-surface);
      border: 1px solid var(--qms-border);
      border-radius: 8px;
      box-shadow: var(--qms-shadow-soft);
    }
    .qms-panel.dashboard-panel { order: 1; }
    .qms-panel.console-panel { order: 2; }
    .qms-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--qms-border);
      flex-shrink: 0;
    }
    .qms-panel-title {
      margin: 0;
      font-size: 13px;
      font-weight: 700;
      color: var(--qms-text);
    }
    .qms-panel-subtitle {
      margin-top: 1px;
      font-size: 10px;
      color: var(--qms-text-muted);
    }
    .qms-panel-content {
      flex: 1;
      min-height: 0;
      overflow: auto;
      padding: 10px 12px;
    }

    /* ── Stats bar ── */
    .qms-statsbar {
      display: flex;
      gap: 14px;
      flex-shrink: 0;
      margin-bottom: 18px;
    }
    .stat-block { display: flex; flex-direction: column; gap: 2px; }
    .stat-block .label {
      font-size: 11px; font-weight: 600; text-transform: uppercase;
      letter-spacing: .06em; color: var(--text-muted, #8d99a6);
    }
    .stat-block .value { font-size: 22px; font-weight: 700; line-height: 1; }
    .value.green { color: #2c7a45; }
    .value.red { color: #c0392b; }
    .value.blue { color: var(--primary, #2490ef); }

    /* ── Frappe card ── */
    .frappe-card {
      background: var(--card-bg, #fff);
      border: 1px solid var(--border-color, #e2e6e9);
      border-radius: var(--border-radius-lg, 8px);
      box-shadow: var(--card-shadow, 0 1px 3px rgba(0,0,0,.06));
      padding: var(--padding-xl, 24px);
    }

    /* ── Console view ── */
    .console-center {
      display: flex; align-items: center; justify-content: center;
      flex: 1;
      overflow: auto;
      padding: clamp(12px, 2vw, 20px);
    }
    .ticket-card { max-width: 100%; width: 100%; text-align: center; }
    .ticket-number {
      font-size: 52px; font-weight: 800; line-height: 1;
      color: var(--primary, #2490ef); margin: 6px 0 12px;
    }
    .ticket-subtitle { font-size: 10px; color: var(--text-muted, #8d99a6); text-transform: uppercase; letter-spacing: .08em; }
    .ticket-name { font-size: 13px; color: var(--text-color, #1f272e); font-weight: 500; margin-top: 2px; word-break: break-word; }

    /* Frappe-style input */
    .frappe-control { margin-bottom: 10px; text-align: left; }
    .frappe-control label {
      display: block; font-size: 10px; font-weight: 600;
      color: var(--text-muted, #8d99a6); margin-bottom: 3px;
      text-transform: uppercase; letter-spacing: .04em;
    }
    .frappe-control input {
      width: 100%; height: 32px; padding: 0 8px;
      border: 1px solid var(--border-color, #d1d8dd);
      border-radius: 4px;
      background: var(--control-bg, #fff);
      font-size: 12px; color: var(--text-color, #1f272e);
      outline: none; box-sizing: border-box;
      transition: border-color .15s, box-shadow .15s;
    }
    .frappe-control input:focus {
      border-color: var(--primary, #2490ef);
      box-shadow: 0 0 0 2px rgba(36,144,239,.15);
    }

    /* Buttons */
    .btn-primary {
      background: var(--primary, #2490ef); color: #fff;
      border: none; border-radius: var(--border-radius, 6px);
      padding: 8px 16px; font-size: 13px; font-weight: 500;
      cursor: pointer; transition: background .15s, transform .1s;
    }
    .btn-primary:hover:not(:disabled) { background: #1a7fd4; }
    .btn-primary:active:not(:disabled) { transform: scale(.98); }
    .btn-primary:disabled { opacity: .5; cursor: not-allowed; }

    .btn-success {
      background: #2c7a45; color: #fff;
      border: none; border-radius: 4px;
      width: 100%; padding: 8px; font-size: 13px; font-weight: 600;
      cursor: pointer; margin-top: 6px; transition: background .15s;
    }
    .btn-success:hover:not(:disabled) { background: #236339; }
    .btn-success:disabled { opacity: .5; cursor: not-allowed; }

    .btn-call-giant {
      background: var(--primary, #2490ef); color: #fff;
      border: none; border-radius: 6px;
      padding: 12px 24px;
      font-size: 16px; font-weight: 700;
      cursor: pointer; letter-spacing: .03em;
      box-shadow: 0 4px 14px rgba(36,144,239,.35);
      transition: background .15s, transform .15s, box-shadow .15s;
      white-space: nowrap;
      min-height: 44px;
    }
    .btn-call-giant:hover:not(:disabled) {
      background: #1a7fd4; transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(36,144,239,.4);
    }
    .btn-call-giant:disabled { opacity: .45; cursor: not-allowed; transform: none; box-shadow: none; }

    /* ── Dashboard grid ── */
    .dashboard-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 6px;
      height: 100%;
      overflow-y: auto;
    }
    .service-card {
      background: var(--card-bg, #fff);
      border: 1px solid var(--border-color, #e2e6e9);
      border-radius: 6px;
      padding: 10px;
      box-shadow: var(--card-shadow, 0 1px 3px rgba(0,0,0,.06));
      transition: box-shadow .2s;
      flex-shrink: 0;
    }
    .service-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,.1); }
    .service-card-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 8px;
      gap: 6px;
    }
    .service-card-name { font-weight: 600; font-size: 12px; word-break: break-word; }
    .service-metrics { display: flex; gap: 6px; margin-top: 8px; }
    .metric-box {
      flex: 1; text-align: center; padding: 6px 4px;
      border-radius: 4px;
    }
    .metric-box .m-label { font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted, #8d99a6); }
    .metric-box .m-value { font-size: 18px; font-weight: 800; line-height: 1.1; }
    .metric-box.waiting { background: #fdecea; }
    .metric-box.waiting .m-value { color: #c0392b; }
    .metric-box.serving { background: #e3f2fd; }
    .metric-box.serving .m-value { color: #1565c0; }
    .metric-box.done { background: #e4f5e9; }
    .metric-box.done .m-value { color: #2c7a45; }

    .refresh-btn {
      background: none; border: 1px solid var(--border-color, #d1d8dd);
      border-radius: 5px; padding: 4px 10px; font-size: 12px;
      color: var(--text-muted, #8d99a6); cursor: pointer;
      transition: background .15s;
    }
    .refresh-btn:hover { background: var(--bg-color, #f4f5f7); }

    .empty-state {
      text-align: center; padding: 64px 24px;
      color: var(--text-muted, #8d99a6); font-size: 14px;
    }
    .empty-icon { font-size: 40px; margin-bottom: 12px; }

    .btn-danger {
      background: #fff; color: #c0392b;
      border: 1.5px solid #feb2b2;
      border-radius: var(--border-radius, 6px);
      width: 100%; padding: 9px; font-size: 14px; font-weight: 600;
      cursor: pointer; margin-top: 8px;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      transition: background .15s;
    }
    .btn-danger:hover:not(:disabled) { background: #fdecea; }
    .btn-danger:disabled { opacity: .5; cursor: not-allowed; }

    .btn-recall {
      background: #fff; color: #c07a00;
      border: 1.5px solid #f6c96b;
      border-radius: var(--border-radius, 6px);
      width: 100%; padding: 9px; font-size: 14px; font-weight: 600;
      cursor: pointer; margin-top: 8px;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      transition: background .15s, transform .1s;
      position: relative; overflow: hidden;
    }
    .btn-recall:hover:not(:disabled) { background: #fef3e2; transform: translateY(-1px); }
    .btn-recall:active:not(:disabled) { transform: scale(.98); }
    .btn-recall:disabled { opacity: .5; cursor: not-allowed; }

    .recall-badge {
      display: inline-flex; align-items: center; justify-content: center;
      background: #c07a00; color: #fff;
      width: 18px; height: 18px; border-radius: 50%;
      font-size: 11px; font-weight: 700; flex-shrink: 0;
    }

    @keyframes ring-pulse {
      0%   { box-shadow: 0 0 0 0 rgba(192,122,0,.5); }
      70%  { box-shadow: 0 0 0 10px rgba(192,122,0,0); }
      100% { box-shadow: 0 0 0 0 rgba(192,122,0,0); }
    }
    .btn-recall.ringing { animation: ring-pulse 0.6s ease-out; }

    .recall-completed-panel {
      margin-top: 16px; width: 100%;
    }
    .recall-completed-toggle {
      background: none; border: 1.5px solid #d0d7de; border-radius: 6px;
      width: 100%; padding: 8px 14px; font-size: 13px; color: #57606a;
      cursor: pointer; display: flex; align-items: center; justify-content: space-between;
      transition: background .15s;
    }
    .recall-completed-toggle:hover { background: #f6f8fa; }
    .recall-completed-list {
      border: 1.5px solid #d0d7de; border-top: none; border-radius: 0 0 6px 6px;
      overflow: hidden;
    }
    .recall-completed-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 12px; border-bottom: 1px solid #eaecef; font-size: 13px;
      background: #fff;
    }
    .recall-completed-row:last-child { border-bottom: none; }
    .recall-completed-row:hover { background: #f6f8fa; }
    .recall-completed-info { display: flex; flex-direction: column; gap: 2px; }
    .recall-completed-name { font-weight: 600; color: #24292f; }
    .recall-completed-meta { color: #57606a; font-size: 11px; }
    .recall-completed-reason { color: #c07a00; font-size: 11px; font-style: italic; display: block; margin-top: 2px; }
    .btn-recall-completed {
      background: #fff8e1; color: #c07a00; border: 1px solid #f6c96b;
      border-radius: 5px; padding: 4px 10px; font-size: 12px; font-weight: 600;
      cursor: pointer; white-space: nowrap;
      transition: background .15s;
    }
    .btn-recall-completed:hover:not(:disabled) { background: #fef3e2; }
    .btn-recall-completed:disabled { opacity: .5; cursor: not-allowed; }

    .status-warning {
      display: flex; align-items: center; gap: 8px;
      margin-top: 16px; padding: 10px 14px;
      background: #fef3e2; border-radius: 6px; border: 1px solid #f6c96b;
      font-size: 13px; color: #7a4f00;
    }

    /* ── User avatar + dropdown ── */
    .qms-user-wrap { position: relative; }
    .qms-user-btn {
      display: flex; align-items: center; gap: 8px;
      min-height: 40px;
      padding: 4px 10px 4px 4px;
      border: 1px solid #d8dee8;
      border-radius: 12px; background: var(--qms-surface);
      cursor: pointer; transition: background .12s, border-color .12s;
      box-shadow: 0 1px 1px rgba(15, 23, 42, 0.02);
    }
    .qms-user-btn:hover { background: #f8fafc; border-color: #bcc7d6; }
    .qms-avatar {
      width: 28px; height: 28px; border-radius: 50%;
      background: var(--qms-accent); color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 800; flex-shrink: 0; overflow: hidden;
    }
    .qms-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .qms-user-name { font-size: 12px; font-weight: 600; color: var(--qms-text); max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .qms-user-role { font-size: 10px; color: var(--qms-text-muted); }
    .qms-chevron { font-size: 10px; color: var(--qms-text-muted); transition: transform .2s; }
    .qms-chevron.open { transform: rotate(180deg); }

    .qms-dropdown {
      position: absolute; top: calc(100% + 8px); right: 0;
      background: var(--qms-surface); border: 1px solid var(--qms-border);
      border-radius: 10px; min-width: 200px;
      box-shadow: 0 8px 24px rgba(0,0,0,.12);
      z-index: 200; overflow: hidden;
      animation: qms-dd-in .15s ease;
    }
    @keyframes qms-dd-in {
      from { opacity: 0; transform: translateY(-6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .qms-dd-header {
      padding: 14px 16px; border-bottom: 1px solid #f4f5f7;
      background: var(--qms-surface-alt);
    }
    .qms-dd-name  { font-size: 13px; font-weight: 700; color: var(--qms-text); }
    .qms-dd-email { font-size: 11px; color: var(--qms-text-muted); margin-top: 2px; word-break: break-all; }
    .qms-dd-item {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 16px; font-size: 13px; font-weight: 500;
      color: var(--qms-text); cursor: pointer; border: none; background: none;
      width: 100%; text-align: left;
      transition: background .1s;
    }
    .qms-dd-item:hover { background: var(--qms-surface-alt); }
    .qms-dd-item.danger { color: #c0392b; }
    .qms-dd-item.danger:hover { background: #fdecea; }
    .qms-dd-divider { height: 1px; background: #f4f5f7; margin: 2px 0; }
    .qms-dd-icon {
      width: 16px;
      text-align: center;
      color: #7c8aa5;
      flex-shrink: 0;
    }

    @media (max-width: 1080px) {
      .qms-workspace {
        grid-template-columns: 1fr;
        height: 100%;
      }
      .qms-panel.dashboard-panel { order: 1; }
      .qms-panel.console-panel { order: 2; }
      .qms-statsbar { flex-wrap: wrap; }
      .qms-toolbar-group { flex-wrap: wrap; }
    }
  `;

	// ── Render ────────────────────────────────────────────────────────────────
	return (
		<div className="qms-root">
			<style>{styles}</style>

			{/* ── Resume Banner (if ticket from previous session) ── */}
			{activeTicket && (
				<div style={{
					background: "#e0f2fe",
					border: "1px solid #7dd3fc",
					borderRadius: 4,
					padding: "6px 10px",
					margin: "4px 4px 0",
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					gap: 8,
					fontSize: 11,
				}}>
					<div style={{ display: "flex", alignItems: "center", gap: 6 }}>
						<i className="octicon octicon-info" style={{ color: "#0084c7", fontSize: 12 }} />
						<span style={{ color: "#0c4a6e" }}>
							<strong>Resumed:</strong> #{activeTicket.name?.slice(-3) || "---"} @ {activeTicket.counter || "TBD"}
						</span>
					</div>
					<button
						onClick={() => setActiveTicket(null)}
						style={{
							background: "transparent",
							border: "1px solid #7dd3fc",
							color: "#0084c7",
							padding: "2px 8px",
							borderRadius: 3,
							cursor: "pointer",
							fontSize: 10,
							fontWeight: 600,
						}}
					>
						Clear
					</button>
				</div>
			)}

			{/* ── Topbar ── */}
			<div className="qms-topbar qms-shell-header">
				<div className="qms-topbar-left qms-shell-brand">
					{ministryLogo ? (
						<img src={ministryLogo} style={{ height: 38, width: "auto", borderRadius: 6, flexShrink: 0 }} alt="Ministry Logo" />
					) : (
						<div className="qms-topbar-logo qms-shell-logo"><Icon name="organization" style={{ marginRight: 0 }} /></div>
					)}
					<div>
						<div className="qms-topbar-title qms-shell-title"><Icon name="graph" /> Queue Management System</div>
						<div className="qms-topbar-sub qms-shell-subtitle">Ministry of Infrastructure · Officer Console</div>
					</div>
				</div>

				<div className="qms-topbar-right qms-shell-actions">
					<div className="qms-toolbar-group">

						{/* Counter */}
						<div className="qms-inline-field">
							<span className="qms-inline-label">Counter</span>
							<select className="qms-select counter" value={counter} onChange={(e) => handleCounterChange(e.target.value)}>
								<option value="">Select...</option>
								{countersList.map((n) => <option key={n} value={n}>{n}</option>)}
							</select>
						</div>

						{/* Status */}
						<div className="qms-inline-field">
							<span className="qms-inline-label">Status</span>
							<select
								className="qms-select status"
								value={status}
								onChange={(e) => handleStatusChange(e.target.value)}
								disabled={loading}
							>
								<option value="Open">Open</option>
								<option value="Break">Break</option>
								<option value="Closed">Closed</option>
							</select>
						</div>

						<span className={`qms-badge ${statusIndicator}`}>{status}</span>
					</div>

					{/* User avatar + dropdown */}
					<div className="qms-user-wrap" ref={userMenuRef}>
						<button className="qms-user-btn" onClick={() => setUserMenuOpen(o => !o)}>
							<div className="qms-avatar">
								{userImage ? <img src={userImage} alt={currentUserName} /> : initials}
							</div>
							<div style={{ textAlign: "left" }}>
								<div className="qms-user-name">{currentUserName}</div>
							</div>
							<span className={`qms-chevron${userMenuOpen ? " open" : ""}`}>▼</span>
						</button>

						{userMenuOpen && (
							<div className="qms-dropdown">
								<div className="qms-dd-header">
									<div className="qms-dd-name">{currentUserName}</div>
									<div className="qms-dd-email">{userRole}</div>
								</div>
								<button className="qms-dd-item" onClick={() => { setUserMenuOpen(false); window.location.href = "/app/user/" + currentUser; }}>
									<Icon name="person" />
									<span>My Profile</span>
								</button>
								<button className="qms-dd-item" onClick={() => { setUserMenuOpen(false); window.location.href = "/app"; }}>
									<Icon name="home" />
									<span>Back to Desk</span>
								</button>
								<div className="qms-dd-divider" />
								<button className="qms-dd-item danger" onClick={() => { setUserMenuOpen(false); handleLogout(); }}>
									<Icon name="sign-out" />
									<span>Log Out</span>
								</button>
							</div>
						)}
					</div>


				</div>
			</div>

			{/* ── Body ── */}
			<div className="qms-body qms-content">
				<div className="qms-workspace">
					<section className="qms-panel dashboard-panel">
						<div className="qms-panel-header">
							<div>
								<h2 className="qms-panel-title">Dashboard</h2>
								<div className="qms-panel-subtitle">Live queue load across all services</div>
							</div>
							<button className="refresh-btn btn btn-sm btn-secondary" onClick={() => fetchQueueDashboard()}>
								<Icon name="sync" /> Refresh
							</button>
						</div>
						<div className="qms-panel-content">
							{queueDashboard.length === 0 ? (
								<div className="empty-state">
									<div className="empty-icon"><Icon name="inbox" style={{ fontSize: 24 }} /></div>
									<div>No services found or still loading…</div>
								</div>
							) : (
								<div className="dashboard-grid">
									{queueDashboard.map((item) => {
										const totalActivity = item.waiting + item.serving + item.completed;
										const waitPct = totalActivity ? Math.round((item.waiting / totalActivity) * 100) : 0;
										const busyIndicator = item.waiting > 10 ? "red" : item.waiting > 4 ? "orange" : "green";
										return (
											<div className="service-card" key={item.service}>
												<div className="service-card-header">
													<div className="service-card-name">{item.service}</div>
													<span className={`qms-badge ${busyIndicator === "green" ? "success" : busyIndicator === "orange" ? "warning" : "danger"}`}>
														{item.waiting > 10 ? "Busy" : item.waiting > 4 ? "Moderate" : "Clear"}
													</span>
												</div>

												<div className="service-metrics">
													<div className="metric-box waiting">
														<div className="m-label">Waiting</div>
														<div className="m-value">{item.waiting}</div>
													</div>
													<div className="metric-box serving">
														<div className="m-label">Serving</div>
														<div className="m-value">{item.serving}</div>
													</div>
													<div className="metric-box done">
														<div className="m-label">Done Today</div>
														<div className="m-value">{item.completed}</div>
													</div>
												</div>

												{totalActivity > 0 && (
													<div style={{ marginTop: 14 }}>
														<div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
															<span>Queue load</span><span>{waitPct}%</span>
														</div>
														<div style={{ height: 4, background: "#eee", borderRadius: 4, overflow: "hidden" }}>
															<div style={{
																height: "100%", borderRadius: 4,
																width: `${waitPct}%`,
																background: waitPct > 60 ? "#c0392b" : waitPct > 30 ? "#c07a00" : "#2c7a45",
																transition: "width .4s ease"
															}} />
														</div>
													</div>
												)}
											</div>
										);
									})}
								</div>
							)}
						</div>
					</section>

					<section className="qms-panel console-panel">
						<div className="qms-panel-header">
							<div>
								<h2 className="qms-panel-title">Console</h2>
								<div className="qms-panel-subtitle">Serve the next customer and complete active tickets</div>
							</div>
						</div>
						<div className="qms-panel-content">
							<div className="qms-statsbar">
								<div className="stat-block">
									<span className="label">Served Today</span>
									<span className="value green">{stats.served}</span>
								</div>
								<div className="stat-block">
									<span className="label">Waiting in Queue</span>
									<span className="value red">{stats.waiting}</span>
								</div>
								{counter && (
									<div className="stat-block">
										<span className="label">Counter</span>
										<span className="value blue">{counter}</span>
									</div>
								)}
							</div>

							<div className="console-center">
								{!activeTicket ? (
									<div style={{ textAlign: "center" }}>
										<button
											className="btn-call-giant"
											onClick={handleCallNext}
											disabled={loading || status !== "Open" || calledTicket}
										>
											{loading ? "Calling…" : "Call Next Customer"}
										</button>
										{status !== "Open" && (
											<div className="status-warning">
												<Icon name="alert" />
												<span>Set status to <strong>Open</strong> to call tickets.</span>
											</div>
										)}
										{calledTicket && (
											<div className="status-warning" style={{ background: "#fef3e2", borderColor: "#f6c96b", marginTop: 12 }}>
												<Icon name="megaphone" />
												<span>Ticket <strong>#{calledTicket.name.slice(-3)}</strong> is being served. Please finish before calling next.</span>
											</div>
										)}
										{calledTicket && (
											<button
												style={{
													background: "#ffcccc", 
													color: "#c0392b",
													border: "1px solid #f08080",
													borderRadius: "6px",
													padding: "10px 16px",
													marginTop: 12,
													fontSize: "13px",
													fontWeight: "600",
													cursor: "pointer",
													width: "100%"
												}}
												onClick={async () => {
													if (confirm("Reset stuck tickets back to queue? This will move any 'Called' tickets back to Waiting.")) {
														try {
															const result = await frappe.call({
																method: "moi.api.qms.reset_stuck_tickets"
															});
															await checkCalledTicket();
															frappe.show_alert({
																message: result.message.message,
																indicator: "green"
															});
														} catch (e) {
															console.error(e);
														}
													}
												}}
											>
												<i className="octicon octicon-refresh" style={{ marginRight: 6 }} />
												Reset Stuck Tickets
											</button>
										)}
										{completedTickets.length > 0 && (
											<div className="recall-completed-panel">
												<button
													className="recall-completed-toggle"
													onClick={() => setRecallPanelOpen(o => !o)}
												>
													<span><Icon name="history" /> Recall Completed Customer</span>
													<Icon name={recallPanelOpen ? "chevron-up" : "chevron-down"} style={{ marginRight: 0 }} />
												</button>
												{recallPanelOpen && (
													<div className="recall-completed-list">
														{completedTickets.map(t => (
															<div key={t.name} className="recall-completed-row">
																<div className="recall-completed-info">
																	<span className="recall-completed-name">
																		#{t.name} — {t.customer_name || "Unknown"}
																		{t.recall_count > 0 && (
																			<span className="recall-badge" style={{ marginLeft: 8, background: "#c07a00" }}>
																				×{t.recall_count}
																			</span>
																		)}
																	</span>
																	<span className="recall-completed-meta">
																		{t.service_requested} · {frappe.datetime.prettyDate(t.completed_at)}
																	</span>
																	{t.recall_reason && (
																		<span className="recall-completed-reason">{t.recall_reason}</span>
																	)}
																</div>
																<div style={{ display: "flex", gap: "6px" }}>
																	<button
																		className="btn-recall-completed"
																		disabled={recallingId === t.name}
																		onClick={() => handleRecallCompleted(t)}
																		title="Re-announce this customer to the display screen"
																	>
																		{recallingId === t.name ? "…" : <><Icon name="megaphone" style={{ marginRight: 4 }} />Recall</>}
																	</button>
																	<button
																		className="btn-close-recall"
																		disabled={recallingId === t.name}
																		onClick={() => handleCloseRecall(t)}
																		title="Close recall - customer has completed service"
																		style={{
																			background: "#d4edda", color: "#155724", border: "1px solid #c3e6cb",
																			borderRadius: "5px", padding: "4px 10px", fontSize: "12px", fontWeight: "600",
																			cursor: "pointer", whiteSpace: "nowrap",
																			transition: "background .15s"
																		}}
																	>
																		<Icon name="check" style={{ marginRight: 4 }} />Close
																	</button>
																</div>
															</div>
														))}
													</div>
												)}
											</div>
										)}
									</div>
								) : (
									<div className="frappe-card qms-card ticket-card">
										<div className="ticket-subtitle">Now Serving</div>
										<div className="ticket-name" style={{ marginTop: 4 }}>{activeTicket.name}</div>
										<div className="ticket-number">#{activeTicket.name.slice(-3)}</div>

										<div style={{ borderTop: "1px solid var(--border-color)", paddingTop: 20 }}>
											<div className="frappe-control">
												<label>ID</label>
												<input
													value={activeTicket.customer_id || ""}
													onChange={(e) => setActiveTicket({ ...activeTicket, customer_id: e.target.value })}
													placeholder="Enter ID"
												/>
											</div>
											<div className="frappe-control">
												<label>Full Name</label>
												<input
													value={activeTicket.customer_name || ""}
													onChange={(e) => setActiveTicket({ ...activeTicket, customer_name: e.target.value })}
													placeholder="Enter Full Name"
												/>
											</div>
											<button
												className={`btn-recall qms-button warning${recalling ? " ringing" : ""}`}
												onClick={handleRecall}
												disabled={recalling}
												title="Announce this ticket number again at the counter display"
											>
												<Icon name="megaphone" /> Recall Customer
												{recallCount > 0 && (
													<span className="recall-badge">{recallCount}</span>
												)}
											</button>

											<button
												className="btn-danger qms-button danger"
												onClick={handleNoShow}
												disabled={loading}
												title="Customer did not arrive — mark as No Show"
											>
												<Icon name="x" /> No Show
											</button>

											<button
												className="btn-recall qms-button warning"
												onClick={handleCompleteWithRecall}
												disabled={loading}
												title="Complete this ticket and flag it for customer recall later"
											>
												<Icon name="bookmark" /> Mark for Recall
											</button>

											<button className="btn-success qms-button success" onClick={handleComplete} disabled={loading}>
												{loading ? "Saving…" : <><Icon name="check" /> Complete & Save</>}
											</button>
										</div>
									</div>
								)}
							</div>
						</div>
					</section>
				</div>
			</div>
		</div>
	);
}
