import * as React from "react";
import { getQmsPageStyles, qmsStatusTone } from "../qms_shared/qmsTheme";
import { useMinistryBranding } from "../qms_shared/useMinistryBranding";

// ── Tiny bar-chart component (no external deps) ──────────────────────────
function MiniBar({ data, valueKey, labelKey, color = "#2490ef", height = 120 }) {
	const max = Math.max(...data.map((d) => d[valueKey] || 0), 1);
	return (
		<div style={{ display: "flex", alignItems: "flex-end", gap: 6, height, paddingTop: 8 }}>
			{data.map((d, i) => {
				const pct = (d[valueKey] / max) * 100;
				return (
					<div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 0 }}>
						<span style={{ fontSize: 10, color: "#8d99a6", fontWeight: 700 }}>{d[valueKey] || 0}</span>
						<div
							title={`${d[labelKey]}: ${d[valueKey]}`}
							style={{
								width: "100%", background: color, borderRadius: "4px 4px 0 0",
								height: `${Math.max(pct, 2)}%`, transition: "height .4s ease",
								opacity: .85,
							}}
						/>
						<span style={{ fontSize: 10, color: "#8d99a6", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%", textAlign: "center" }}>
							{d[labelKey]}
						</span>
					</div>
				);
			})}
		</div>
	);
}

// ── Star display ─────────────────────────────────────────────────────────
function Stars({ rating }) {
	return (
		<span>
			{[1, 2, 3, 4, 5].map(s => (
				<span key={s} style={{ color: s <= rating ? "#f59e0b" : "#e2e6e9", fontSize: 14 }}>★</span>
			))}
		</span>
	);
}

// ── Status pill ───────────────────────────────────────────────────────────
function Pill({ status }) {
	return <span className={`qms-badge ${qmsStatusTone(status)}`}>{status}</span>;
}

// ── CSV export utility ────────────────────────────────────────────────────
function exportCSV(rows, filename) {
	if (!rows.length) return;
	const headers = Object.keys(rows[0]);
	const csv = [
		headers.join(","),
		...rows.map(r => headers.map(h => `"${(r[h] ?? "").toString().replace(/"/g, '""')}"`).join(","))
	].join("\n");
	const blob = new Blob([csv], { type: "text/csv" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url; a.download = filename; a.click();
	URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────
export function QmsDashboard() {
	const currentUser = frappe.session.user;
	const currentUserInfo = frappe.boot.user_info?.[currentUser] || {};
	const fullName = currentUserInfo.fullname || currentUser;
	const userImage = currentUserInfo.image || null;
	const initials = fullName.split(" ").filter(Boolean).map(w => w[0]).join("").toUpperCase().slice(0, 2);

	// Ministry branding
	const { logo: ministryLogo } = useMinistryBranding();

	const [view, setView] = React.useState("dashboard"); // "dashboard" | "live" | "report" | "feedback"
	const [reportDateFrom, setReportDateFrom] = React.useState(frappe.datetime.get_today());
	const [reportDateTo, setReportDateTo] = React.useState(frappe.datetime.get_today());
	const [loading, setLoading] = React.useState(false);
	const [userMenuOpen, setUserMenuOpen] = React.useState(false);
	const userMenuRef = React.useRef(null);

	// Live Monitor data
	const [counters, setCounters] = React.useState([]);
	const [liveTickets, setLiveTickets] = React.useState([]);
	const [selectedTicket, setSelectedTicket] = React.useState(null);

	// Close dropdown when clicking outside
	React.useEffect(() => {
		const handler = (e) => {
			if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
				setUserMenuOpen(false);
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, []);

	const handleLogout = () => {
		frappe.confirm(
			"Are you sure you want to log out?",
			() => { window.location.href = "/logout"; }
		);
	};

	// Dashboard data
	const [summary, setSummary] = React.useState({ total: 0, completed: 0, noshow: 0, waiting: 0, serving: 0, avgRating: 0, feedbackCount: 0 });
	const [byService, setByService] = React.useState([]);
	const [byOfficer, setByOfficer] = React.useState([]);
	const [byHour, setByHour] = React.useState([]);
	const [recentTickets, setRecentTickets] = React.useState([]);
	const [avgServiceDuration, setAvgServiceDuration] = React.useState(0);
	const [predictedQueueTime, setPredictedQueueTime] = React.useState(0);

	// Report data
	const [reportRows, setReportRows] = React.useState([]);
	const [feedbackRows, setFeedbackRows] = React.useState([]);

	// ── Fetch dashboard ────────────────────────────────────────────────────
	const fetchDashboard = React.useCallback(async () => {
		setLoading(true);
		try {
			const today = frappe.datetime.get_today();

			const [allTickets, feedbacks] = await Promise.all([
				frappe.db.get_list("QMS Ticket", {
					fields: ["name", "status", "service_requested", "officer", "creation", "completed_at"],
					filters: [["creation", ">=", today]],
					limit: 500,
					order_by: "creation desc",
				}),
				frappe.db.get_list("QMS Feedback", {
					fields: ["rating", "service", "submitted_at"],
					filters: [["submitted_at", ">=", today]],
					limit: 500,
				}),
			]);

			// Summary counts
			const completed = allTickets.filter(t => t.status === "Completed").length;
			const noshow = allTickets.filter(t => t.status === "No Show").length;
			const waiting = allTickets.filter(t => t.status === "Waiting").length;
			const serving = allTickets.filter(t => t.status === "Serving").length;
			const avgRating = feedbacks.length
				? (feedbacks.reduce((s, f) => s + (f.rating || 0), 0) / feedbacks.length).toFixed(1)
				: 0;

			setSummary({ total: allTickets.length, completed, noshow, waiting, serving, avgRating, feedbackCount: feedbacks.length });

			// By service with average handling time (mins)
			const svcMap = {};
			allTickets.forEach(t => {
				if (!svcMap[t.service_requested]) {
					svcMap[t.service_requested] = { total: 0, completed: 0, durations: [] };
				}
				svcMap[t.service_requested].total++;

				if (t.status === "Completed") {
					svcMap[t.service_requested].completed++;
					if (t.creation && t.completed_at) {
						const duration = (new Date(t.completed_at) - new Date(t.creation)) / 60000;
						if (Number.isFinite(duration) && duration >= 0) {
							svcMap[t.service_requested].durations.push(duration);
						}
					}
				}
			});

			const serviceList = Object.entries(svcMap).map(([k, v]) => {
				const avg = v.durations.length ? v.durations.reduce((a, b) => a + b, 0) / v.durations.length : 0;
				return {
					service: k,
					total: v.total,
					completed: v.completed,
					pending: v.total - v.completed,
					avgMinutes: Number(avg.toFixed(1)),
				};
			});
			setByService(serviceList);

			const allDurations = serviceList.flatMap((s) => (s.avgMinutes > 0 ? [s.avgMinutes] : []));
			const overallAvg = allDurations.length ? +(allDurations.reduce((a, b) => a + b, 0) / allDurations.length).toFixed(1) : 0;
			setAvgServiceDuration(overallAvg);

			const waitingTotal = allTickets.filter((t) => t.status === "Waiting").length;
			setPredictedQueueTime(Math.round(overallAvg * waitingTotal));

			// By officer
			const offMap = {};
			allTickets.filter(t => t.officer).forEach(t => {
				if (!offMap[t.officer]) offMap[t.officer] = 0;
				if (t.status === "Completed") offMap[t.officer]++;
			});
			setByOfficer(Object.entries(offMap).map(([k, v]) => ({ officer: k.split("@")[0], served: v })).sort((a, b) => b.served - a.served).slice(0, 8));

			// By hour
			const hourMap = {}
			for (let h = 7; h <= 17; h++) hourMap[`${h}:00`] = 0;
			allTickets.forEach(t => {
				const h = new Date(t.creation).getHours();
				const key = `${h}:00`;
				if (hourMap[key] !== undefined) hourMap[key]++;
			});
			setByHour(Object.entries(hourMap).map(([k, v]) => ({ hour: k, tickets: v })));

			setRecentTickets(allTickets.slice(0, 12));
		} catch (e) {
			console.error("Dashboard fetch error:", e);
			frappe.show_alert({ message: "Failed to load dashboard data", indicator: "red" });
		} finally {
			setLoading(false);
		}
	}, []);

	// ── Fetch report for date range ────────────────────────────────────
	const fetchReport = React.useCallback(async () => {
		setLoading(true);
		try {
			const endDay = frappe.datetime.add_days(reportDateTo, 1);
			const [tickets, feedbacks] = await Promise.all([
				frappe.db.get_list("QMS Ticket", {
					fields: ["name", "status", "service_requested", "officer", "creation", "completed_at", "customer_name", "customer_id"],
					filters: [["creation", ">=", reportDateFrom], ["creation", "<", endDay]],
					limit: 1000,
					order_by: "creation asc",
				}),
				frappe.db.get_list("QMS Feedback", {
					fields: ["ticket", "rating", "comment", "service", "submitted_at"],
					filters: [["submitted_at", ">=", reportDateFrom], ["submitted_at", "<", endDay]],
					limit: 1000,
					order_by: "submitted_at asc",
				}),
			]);
			setReportRows(tickets);
			setFeedbackRows(feedbacks);
		} catch (e) {
			console.error("Report fetch error:", e);
			frappe.show_alert({ message: "Failed to load report", indicator: "red" });
		} finally {
			setLoading(false);
		}
	}, [reportDateFrom, reportDateTo]);

	React.useEffect(() => { fetchDashboard(); }, []);
	React.useEffect(() => { if (view === "report" || view === "feedback") fetchReport(); }, [view, reportDateFrom, reportDateTo, fetchReport]);

	const downloadTicketsCSV = () => {
		const rows = reportRows.map(t => ({
			"Ticket ID": t.name,
			"Service": t.service_requested,
			"Officer": t.officer || "",
			"Customer Name": t.customer_name || "",
			"Customer ID": t.customer_id || "",
			"Status": t.status,
			"Created": t.creation,
			"Completed At": t.completed_at || "",
		}));
		exportCSV(rows, `QMS_Tickets_${reportDateFrom}_to_${reportDateTo}.csv`);
	};

	const downloadFeedbackCSV = () => {
		const rows = feedbackRows.map(f => ({
			"Ticket": f.ticket,
			"Service": f.service,
			"Rating": f.rating,
			"Comment": f.comment || "",
			"Submitted At": f.submitted_at,
		}));
		exportCSV(rows, `QMS_Feedback_${reportDateFrom}_to_${reportDateTo}.csv`);
	};

	const downloadBIReport = () => {
		const rows = byService.map(s => ({
			"Service": s.service,
			"Total Tickets": s.total,
			"Completed": s.completed,
			"Pending": s.pending,
			"Avg Handling Time (min)": s.avgMinutes,
		}));
		exportCSV(rows, `QMS_BI_ServiceKPIs_${reportDateFrom}_to_${reportDateTo}.csv`);
	};

	// ── Fetch live counters and tickets ────────────────────────────────────
	const fetchLive = React.useCallback(async () => {
		try {
			const [ctrs, tickets] = await Promise.all([
				frappe.db.get_list("QMS Counter", {
					fields: ["name", "counter_number", "status"],
					limit: 50
				}),
				frappe.db.get_list("QMS Ticket", {
					fields: ["name", "status", "service_requested", "officer", "counter", "called_at", "creation", "customer_name"],
					filters: [["status", "in", ["Waiting", "Called", "Serving"]]],
					limit: 200,
					order_by: "creation asc"
				})
			]);
			setCounters(ctrs);
			setLiveTickets(tickets);
		} catch (e) {
			console.error("Live fetch error:", e);
		}
	}, []);

	// ── Fetch counters for dashboard ────────────────────────────────────────
	React.useEffect(() => {
		if (view === "dashboard") {
			fetchLive();
		}
	}, [view, fetchLive]);

	// ── Realtime subscriptions for Live Monitor ────────────────────────────
	React.useEffect(() => {
		if (view !== "live") return;

		fetchLive();
		const liveInterval = setInterval(fetchLive, 20000);

		const handleCounterStatusUpdate = ({ counter, status }) => {
			setCounters(prev => prev.map(c => c.name === counter ? { ...c, status } : c));
		};

		frappe.realtime.on("counter_status_updated", handleCounterStatusUpdate);
		frappe.realtime.on("ticket_called", fetchLive);
		frappe.realtime.on("ticket_recalled", fetchLive);
		frappe.realtime.on("qms_update", fetchLive);

		return () => {
			clearInterval(liveInterval);
			frappe.realtime.off("counter_status_updated", handleCounterStatusUpdate);
			frappe.realtime.off("ticket_called", fetchLive);
			frappe.realtime.off("ticket_recalled", fetchLive);
			frappe.realtime.off("qms_update", fetchLive);
		};
	}, [view, fetchLive]);

	// ── Ticket action handlers ──────────────────────────────────────────────
	const handleRecall = (ticket) => {
		frappe.confirm(
			`Re-call ticket ${ticket.name}?`,
			() => {
				frappe.call({
					method: "moi.api.qms.recall_ticket",
					args: {
						ticket_id: ticket.name,
						counter_number: ticket.counter || "",
						officer: currentUser
					},
					callback: () => {
						frappe.show_alert({ message: "Ticket recalled", indicator: "green" });
						fetchLive();
						setSelectedTicket(null);
					},
					error: () => frappe.show_alert({ message: "Failed to recall ticket", indicator: "red" })
				});
			}
		);
	};

	const handleComplete = (ticket) => {
		frappe.confirm(
			`Mark ticket ${ticket.name} as completed?`,
			() => {
				frappe.call({
					method: "moi.api.qms.complete_service",
					args: { ticket_id: ticket.name },
					callback: () => {
						frappe.show_alert({ message: "Ticket completed", indicator: "green" });
						fetchLive();
						setSelectedTicket(null);
					},
					error: () => frappe.show_alert({ message: "Failed to complete ticket", indicator: "red" })
				});
			}
		);
	};

	const handleNoShow = (ticket) => {
		frappe.confirm(
			`Mark ticket ${ticket.name} as no-show?`,
			() => {
				frappe.call({
					method: "moi.api.qms.no_show",
					args: {
						ticket_id: ticket.name,
						officer: currentUser,
						counter_number: ticket.counter || ""
					},
					callback: () => {
						frappe.show_alert({ message: "Ticket marked as no-show", indicator: "green" });
						fetchLive();
						setSelectedTicket(null);
					},
					error: () => frappe.show_alert({ message: "Failed to mark as no-show", indicator: "red" })
				});
			}
		);
	};

	const handleToggleCounterStatus = (counter, newStatus) => {
		frappe.call({
			method: "moi.api.qms.update_counter_status",
			args: {
				counter_number: counter.counter_number,
				status: newStatus,
				service: "", // admin view doesn't specify service
				officer: currentUser
			},
			callback: () => {
				frappe.show_alert({ message: `Counter ${counter.counter_number} set to ${newStatus}`, indicator: "green" });
				fetchLive();
			},
			error: () => frappe.show_alert({ message: "Failed to update counter status", indicator: "red" })
		});
	};

	// ── Styles ──────────────────────────────────────────────────────────────
	const styles = `
    ${getQmsPageStyles("adm-root", { accent: "#1f7aec", surfaceTint: "#f8fafc" })}
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,600;0,700;0,800;1,400&display=swap');

    .adm-root {
      width: 100vw; min-height: 100vh;
      background: var(--qms-canvas);
      font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 14px; color: var(--qms-text);
      display: flex; flex-direction: column;
    }

    /* ── User menu ── */
    .adm-user-wrap { position: relative; }
    .adm-user-btn {
      display: flex; align-items: center; gap: 8px;
      padding: 4px 8px 4px 4px;
      border: 1px solid var(--qms-border); border-radius: 12px;
      background: var(--qms-surface); cursor: pointer;
      transition: background .12s, border-color .12s;
    }
    .adm-user-btn:hover { background: var(--qms-surface-alt); border-color: var(--qms-border-strong); }
    .adm-avatar {
      width: 30px; height: 30px; border-radius: 50%;
      background: var(--qms-accent); color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 800; flex-shrink: 0;
      overflow: hidden;
    }
    .adm-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .adm-user-name { font-size: 13px; font-weight: 600; color: var(--qms-text); max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .adm-user-role { font-size: 10px; color: var(--qms-text-muted); }
    .adm-chevron { font-size: 10px; color: var(--qms-text-muted); transition: transform .2s; }
    .adm-chevron.open { transform: rotate(180deg); }

    .adm-dropdown {
      position: absolute; top: calc(100% + 8px); right: 0;
      background: var(--qms-surface); border: 1px solid var(--qms-border);
      border-radius: 10px; min-width: 200px;
      box-shadow: 0 8px 24px rgba(0,0,0,.12);
      z-index: 200; overflow: hidden;
      animation: dropdown-in .15s ease;
    }
    @keyframes dropdown-in {
      from { opacity: 0; transform: translateY(-6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .adm-dropdown-header {
      padding: 14px 16px; border-bottom: 1px solid #f4f5f7;
      background: var(--qms-surface-alt);
    }
    .adm-dropdown-name { font-size: 13px; font-weight: 700; color: var(--qms-text); }
    .adm-dropdown-email { font-size: 11px; color: var(--qms-text-muted); margin-top: 2px; word-break: break-all; }
    .adm-dropdown-item {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 16px; font-size: 13px; font-weight: 500;
      color: var(--qms-text); cursor: pointer; border: none; background: none;
      width: 100%; text-align: left;
      transition: background .1s;
    }
    .adm-dropdown-item:hover { background: var(--qms-surface-alt); }
    .adm-dropdown-item.danger { color: #c0392b; }
    .adm-dropdown-item.danger:hover { background: #fdecea; }
    .adm-dropdown-divider { height: 1px; background: #f4f5f7; margin: 2px 0; }

    /* ── Header ── */
    .adm-header {
      background: color-mix(in srgb, var(--qms-surface) 90%, transparent); border-bottom: 1px solid var(--qms-border);
      padding: 0 32px; height: 60px;
      display: flex; align-items: center; justify-content: space-between;
      flex-shrink: 0; box-shadow: var(--qms-shadow-soft);
      position: sticky; top: 0; z-index: 100;
    }
    .adm-header-left { display: flex; align-items: center; gap: 12px; }
    .adm-logo {
      width: 36px; height: 36px; border-radius: 8px;
      background: var(--qms-accent);
      display: flex; align-items: center; justify-content: center;
      font-weight: 900; font-size: 18px; color: #fff;
    }
    .adm-title { font-size: 16px; font-weight: 800; }
    .adm-sub { font-size: 11px; color: var(--qms-text-muted); }

    /* ── Tabs ── */
    .adm-tabs {
      background: transparent; border-bottom: none;
      padding: 0 32px; display: flex; gap: 0;
    }
    .adm-tab {
      padding: 12px 20px; font-size: 13px; font-weight: 600;
      color: var(--qms-text-muted); border: none; background: none; cursor: pointer;
      border-bottom: 2px solid transparent; transition: color .15s, border-color .15s;
      display: flex; align-items: center; gap: 6px;
    }
    .adm-tab.active { color: var(--qms-accent); border-bottom-color: var(--qms-accent); }
    .adm-tab:hover:not(.active) { color: var(--qms-text); }

    /* ── Page body ── */
    .adm-body { flex: 1; padding: 28px 32px; overflow-y: auto; }

    /* ── KPI cards row ── */
    .adm-kpi-row { display: grid; grid-template-columns: repeat(7, 1fr); gap: 10px; margin-bottom: 14px; }
    .adm-kpi {
      background: #fff; border: 1px solid #e2e6e9;
      border-radius: 10px; padding: 16px 18px;
      box-shadow: 0 1px 3px rgba(0,0,0,.04);
    }
    .adm-kpi .k-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #8d99a6; margin-bottom: 6px; }
    .adm-kpi .k-value { font-size: 28px; font-weight: 900; line-height: 1; }
    .adm-kpi .k-sub   { font-size: 11px; color: #8d99a6; margin-top: 3px; }
    .kv-total     { color: #1f272e; }
    .kv-completed { color: #2c7a45; }
    .kv-waiting   { color: #c07a00; }
    .kv-serving   { color: #1565c0; }
    .kv-noshow    { color: #c0392b; }
    .kv-rating    { color: #f59e0b; }
    .kv-feedback  { color: #7c3aed; }

    /* ── Section card ── */
    .adm-card {
      background: #fff; border: 1px solid #e2e6e9;
      border-radius: 10px; padding: 16px 18px;
      box-shadow: 0 1px 3px rgba(0,0,0,.04); margin-bottom: 12px;
    }
    .adm-card-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 16px; padding-bottom: 12px;
      border-bottom: 1px solid #f4f5f7;
    }
    .adm-card-title { font-size: 14px; font-weight: 700; }
    .adm-card-sub   { font-size: 12px; color: #8d99a6; margin-top: 2px; }

    /* ── Two-col grid ── */
    .adm-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 12px; }
    .adm-three-col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin-bottom: 12px; }

    /* ── Table ── */
    .adm-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .adm-table th {
      text-align: left; padding: 8px 10px;
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .06em; color: #8d99a6;
      border-bottom: 1px solid #e2e6e9; white-space: nowrap;
    }
    .adm-table td { padding: 9px 10px; border-bottom: 1px solid #f4f5f7; vertical-align: middle; }
    .adm-table tr:last-child td { border-bottom: none; }
    .adm-table tr:hover td { background: #f9fafb; }
    .adm-table .mono { font-family: monospace; font-size: 12px; color: #8d99a6; }

    /* ── Buttons ── */
    .adm-btn {
      height: 32px; padding: 0 14px;
      border: 1px solid #d1d8dd; border-radius: 6px;
      background: #fff; color: #1f272e;
      font-size: 12px; font-weight: 600; cursor: pointer;
      display: inline-flex; align-items: center; gap: 5px;
      transition: background .12s;
    }
    .adm-btn:hover { background: #f4f5f7; }
    .adm-btn.primary { background: #2490ef; color: #fff; border-color: #2490ef; }
    .adm-btn.primary:hover { background: #1a7fd4; }
    .adm-btn.success { background: #2c7a45; color: #fff; border-color: #2c7a45; }
    .adm-btn.success:hover { background: #236339; }
    .adm-btn:disabled { opacity: .5; cursor: not-allowed; }

    /* ── Date picker row ── */
    .adm-report-bar {
      display: flex; align-items: center; gap: 12px; margin-bottom: 20px;
      background: #fff; padding: 14px 18px; border-radius: 10px;
      border: 1px solid #e2e6e9;
    }
    .adm-date-input {
      height: 32px; padding: 0 10px; border: 1px solid #d1d8dd;
      border-radius: 6px; font-size: 13px; color: #1f272e;
      font-family: inherit; outline: none;
    }
    .adm-date-input:focus { border-color: #2490ef; box-shadow: 0 0 0 2px rgba(36,144,239,.15); }

    /* ── Officer bar chart ── */
    .officer-bars { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
    .officer-bar-row { display: flex; align-items: center; gap: 10px; }
    .officer-bar-label { font-size: 12px; color: #1f272e; width: 110px; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .officer-bar-track { flex: 1; height: 20px; background: #f4f5f7; border-radius: 4px; overflow: hidden; }
    .officer-bar-fill { height: 100%; background: #2490ef; border-radius: 4px; transition: width .4s ease; }
    .officer-bar-val { font-size: 12px; font-weight: 700; color: #2490ef; width: 28px; text-align: right; flex-shrink: 0; }

    /* ── Service table ── */
    .svc-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }

    /* ── Empty state ── */
    .adm-empty { text-align: center; padding: 48px; color: #8d99a6; font-size: 13px; }
    .adm-empty-icon { font-size: 36px; margin-bottom: 10px; }

    /* ── Loading spinner ── */
    .adm-spinner {
      display: inline-block; width: 16px; height: 16px;
      border: 2px solid #e2e6e9; border-top-color: #2490ef;
      border-radius: 50%; animation: spin .6s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Report summary pills ── */
    .report-summary { display: flex; gap: 10px; flex-wrap: wrap; }
    .rsummary-pill {
      background: #f4f5f7; border: 1px solid #e2e6e9;
      border-radius: 20px; padding: 4px 12px;
      font-size: 12px; font-weight: 600; color: #1f272e;
    }
    .rsummary-pill span { color: #2490ef; }

    /* ── Counter Grid (Compact - for Dashboard) ── */
    .counter-grid-compact {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px;
      margin-top: 8px;
    }
    .counter-card-compact {
      align-items: center; justify-content: space-between;
      padding: 10px 16px; background: #f9fafb; border: 1px solid #e2e6e9;
      border-radius: 6px; gap: 8px;
    }
    .counter-name-compact {
      font-size: 12px; font-weight: 600; color: #1f272e; flex: 1;
    }

    /* ── Counter Grid (Full - for Live Monitor) ── */
    .counter-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px;
      margin-top: 12px;
    }
    .counter-card {
      background: #fff; border: 1px solid #e2e6e9; border-radius: 10px;
      padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.04);
    }
    .counter-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 14px; gap: 8px; flex-wrap: wrap;
    }
    .counter-name {
      font-size: 14px; font-weight: 700; color: #1f272e; flex: 1;
    }
    .counter-actions {
      display: flex; gap: 6px; flex-wrap: wrap; width: 100%;
    }
    .counter-btn {
      flex: 1; min-width: 65px; padding: 8px 10px;
      font-size: 12px; font-weight: 600; border: 1px solid #d1d8dd;
      border-radius: 6px; background: #fff; color: #1f272e; cursor: pointer;
      transition: all .12s; white-space: nowrap; text-overflow: ellipsis;
    }
    .counter-btn:hover:not(:disabled) { background: #f4f5f7; border-color: #2490ef; }
    .counter-btn:disabled { opacity: .5; cursor: not-allowed; background: #e2e6e9; }
    .counter-btn.active { background: #2490ef; color: #fff; border-color: #2490ef; font-weight: 700; }

    /* ── Live Queue ── */
    .ticket-row {
      transition: background .1s;
    }
    .ticket-row.status-waiting { }
    .ticket-row.status-called { background: #fffbf0; }
    .ticket-row.status-serving { background: #f0f7ff; }
    .ticket-row:hover { background: rgba(36, 144, 239, .05); }

    .action-row {
      background: #f9fafb; border-top: 1px solid #e2e6e9;
    }
    .ticket-actions {
      display: flex; gap: 8px; padding: 12px; align-items: center;
    }
    .ticket-actions .adm-btn { flex-shrink: 0; }

    @media (max-width: 1100px) {
      .adm-kpi-row { grid-template-columns: repeat(4, 1fr); }
      .adm-two-col, .adm-three-col { grid-template-columns: 1fr; }
      .counter-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
    }
  `;

	const svcColors = ["#2490ef", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#ec4899"];
	const maxOfficer = Math.max(...byOfficer.map(o => o.served), 1);

	const Icon = ({ name, className = "", style = {} }) => (
		<i className={`octicon octicon-${name} ${className}`} style={{ marginRight: 6, ...style }} aria-hidden="true" />
	);

	// ── Render ────────────────────────────────────────────────────────────────
	return (
		<div className="adm-root">
			<style>{styles}</style>

			{/* Header */}
			<div className="adm-header qms-shell-header">
				<div className="adm-header-left qms-shell-brand">
					{ministryLogo ? (
						<img src={ministryLogo} style={{ height: 40, width: "auto", borderRadius: 8, flexShrink: 0 }} alt="Ministry Logo" />
					) : (
						<div className="adm-logo qms-shell-logo">Q</div>
					)}
					<div>
						<div className="adm-title qms-shell-title">QMS Dashboard</div>
						<div className="adm-sub qms-shell-subtitle">Ministry of Infrastructure · Queue Management</div>
					</div>
				</div>
				<div className="qms-shell-actions">
					{loading && <div className="adm-spinner" />}
					<button className="adm-btn btn btn-sm btn-secondary" onClick={fetchDashboard} disabled={loading}>
						<Icon name="sync" /> Refresh
					</button>
					<button className="adm-btn btn btn-sm btn-primary" onClick={downloadBIReport} disabled={!byService.length}>
						<Icon name="download" /> Export BI CSV
					</button>

					{/* User menu */}
					<div className="adm-user-wrap" ref={userMenuRef}>
						<button className="adm-user-btn" onClick={() => setUserMenuOpen(o => !o)}>
							<div className="adm-avatar">
								{userImage
									? <img src={userImage} alt={fullName} />
									: initials
								}
							</div>
							<div style={{ textAlign: "left" }}>
								<div className="adm-user-name">{fullName}</div>
								<div className="adm-user-role">Administrator</div>
							</div>
							<span className={`adm-chevron${userMenuOpen ? " open" : ""}`}>▼</span>
						</button>

						{userMenuOpen && (
							<div className="adm-dropdown">
								<div className="adm-dropdown-header">
									<div className="adm-dropdown-name">{fullName}</div>
									<div className="adm-dropdown-email">{currentUser}</div>
								</div>
								<button className="adm-dropdown-item" onClick={() => { setUserMenuOpen(false); window.location.href = "/app/user/" + currentUser; }}>
									<Icon name="person" /> My Profile
								</button>
								<button className="adm-dropdown-item" onClick={() => { setUserMenuOpen(false); window.location.href = "/app"; }}>
									<Icon name="home" /> Back to Desk
								</button>
								<div className="adm-dropdown-divider" />
								<button className="adm-dropdown-item danger" onClick={() => { setUserMenuOpen(false); handleLogout(); }}>
									<Icon name="sign-out" /> Log Out
								</button>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Tabs */}
			<div className="adm-tabs qms-panel-tabs">
				{[
					{ id: "dashboard", icon: "graph", label: "Dashboard" },
					{ id: "report", icon: "file-text", label: "Tickets Report" },
					{ id: "feedback", icon: "star", label: "Feedback Report" },
				].map(t => (
					<button
						key={t.id}
						className={`adm-tab qms-tab-button ${view === t.id ? "active" : ""}`}
						onClick={() => setView(t.id)}
					>
						<Icon name={t.icon} /> {t.label}
					</button>
				))}
			</div>

			<div className="adm-body qms-content">

				{/* ══════════════════════════════════════════════════════════════
            DASHBOARD TAB
        ══════════════════════════════════════════════════════════════ */}
				{view === "dashboard" && (
					<>
						{/* KPI row */}
						<div className="adm-kpi-row">
							{[
								{ label: "Total Today", value: summary.total, cls: "kv-total", sub: "tickets issued" },
								{ label: "Completed", value: summary.completed, cls: "kv-completed", sub: "served" },
								{ label: "Waiting", value: summary.waiting, cls: "kv-waiting", sub: "in queue" },
								{ label: "Serving", value: summary.serving, cls: "kv-serving", sub: "at counter" },
								{ label: "No Show", value: summary.noshow, cls: "kv-noshow", sub: "missed" },
								{ label: "Avg Rating", value: summary.avgRating, cls: "kv-rating", sub: `from ${summary.feedbackCount} reviews` },
								{ label: "Feedback", value: summary.feedbackCount, cls: "kv-feedback", sub: "submitted" },
							].map((k, i) => (
								<div className="adm-kpi" key={i}>
									<div className="k-label">{k.label}</div>
									<div className={`k-value ${k.cls}`}>{k.value}</div>
									<div className="k-sub">{k.sub}</div>
								</div>
							))}
						</div>

						{/* Counter Status Panel */}
						<div className="adm-card" style={{ marginBottom: 14 }}>
							<div className="adm-card-header">
								<div>
									<div className="adm-card-title">Service Counters</div>
									<div className="adm-card-sub">Status of all active counters</div>
								</div>
							</div>
							{counters.length === 0 ? (
								<div className="adm-empty"><div className="adm-empty-icon">🏪</div>No counters found</div>
							) : (
								<div className="counter-grid-compact">
									{counters.map((counter) => (
										<div key={counter.name} className="counter-card-compact">
											<div className="counter-name-compact">Counter {counter.counter_number}</div>
											<span className={`qms-badge ${qmsStatusTone(counter.status)}`}>{counter.status}</span>
										</div>
									))}
								</div>
							)}
						</div>

						{/* Advanced analytics + BI stats */}
						<div className="adm-three-col" style={{ marginBottom: 12 }}>
							<div className="adm-card">
								<div className="adm-card-header">
									<div>
										<div className="adm-card-title">Predicted Queue Wait Time</div>
										<div className="adm-card-sub">Based on current waiting volume and recent service durations</div>
									</div>
								</div>
								<div className="adm-card-content" style={{ padding: '16px 20px' }}>
									<strong style={{ fontSize: '1.55rem' }}>{predictedQueueTime} min</strong>
									<div style={{ marginTop: 8, color: '#66768a' }}>Average service time {avgServiceDuration} min</div>
								</div>
							</div>
							<div className="adm-card">
								<div className="adm-card-header">
									<div>
										<div className="adm-card-title">Service-level KPIs</div>
										<div className="adm-card-sub">Ticket completion performance per service</div>
									</div>
								</div>
								<div className="adm-card-content" style={{ padding: '16px 20px' }}>
									<strong>{byService.length} services tracked</strong>
									<div style={{ marginTop: 8, color: '#66768a' }}>Pending across services: {byService.reduce((a, s) => a + s.pending, 0)}</div>
								</div>
							</div>
							<div className="adm-card">
								<div className="adm-card-header">
									<div>
										<div className="adm-card-title">Historical Trend</div>
										<div className="adm-card-sub">Hourly ticket load today</div>
									</div>
								</div>
								<div className="adm-card-content" style={{ padding: '16px 20px' }}>
									<MiniBar data={byHour} valueKey="tickets" labelKey="hour" color="#1f7aec" height={110} />
								</div>
							</div>
						</div>

						{/* Hourly volume + service breakdown */}
						<div className="adm-two-col">
							<div className="adm-card">
								<div className="adm-card-header">
									<div>
										<div className="adm-card-title">Hourly Volume</div>
										<div className="adm-card-sub">Tickets issued per hour today</div>
									</div>
								</div>
								<MiniBar data={byHour} valueKey="tickets" labelKey="hour" color="#2490ef" height={130} />
							</div>

							<div className="adm-card">
								<div className="adm-card-header">
									<div>
										<div className="adm-card-title">By Service</div>
										<div className="adm-card-sub">Total vs completed</div>
									</div>
								</div>
								{byService.length === 0 ? (
									<div className="adm-empty"><div className="adm-empty-icon">📭</div>No data</div>
								) : (
									<table className="adm-table">
										<thead>
											<tr>
												<th>Service</th>
												<th style={{ textAlign: "right" }}>Total</th>
												<th style={{ textAlign: "right" }}>Done</th>
												<th style={{ textAlign: "right" }}>Pending</th>
												<th style={{ textAlign: "right" }}>Avg (min)</th>
												<th style={{ textAlign: "right" }}>Rate</th>
											</tr>
										</thead>
										<tbody>
											{byService.map((s, i) => {
												const rate = s.total ? Math.round((s.completed / s.total) * 100) : 0;
												return (
													<tr key={i}>
														<td>
															<span className="svc-dot" style={{ background: svcColors[i % svcColors.length] }} />
															{s.service}
														</td>
														<td style={{ textAlign: "right", fontWeight: 700 }}>{s.total}</td>
														<td style={{ textAlign: "right", color: "#2c7a45", fontWeight: 700 }}>{s.completed}</td>
														<td style={{ textAlign: "right", fontWeight: 700 }}>{s.pending}</td>
														<td style={{ textAlign: "right", fontWeight: 700 }}>{s.avgMinutes || 0}</td>
														<td style={{ textAlign: "right" }}>
															<span style={{ color: rate >= 80 ? "#2c7a45" : rate >= 50 ? "#c07a00" : "#c0392b", fontWeight: 700 }}>
																{rate}%
															</span>
														</td>
													</tr>
												);
											})}
										</tbody>
									</table>
								)}
							</div>
						</div>

						{/* Officer performance + recent tickets */}
						<div className="adm-two-col">
							<div className="adm-card">
								<div className="adm-card-header">
									<div>
										<div className="adm-card-title">Officer Performance</div>
										<div className="adm-card-sub">Completed tickets per officer today</div>
									</div>
								</div>
								{byOfficer.length === 0 ? (
									<div className="adm-empty"><div className="adm-empty-icon"><Icon name="person" /></div>No officer data yet</div>
								) : (
									<div className="officer-bars">
										{byOfficer.map((o, i) => (
											<div className="officer-bar-row" key={i}>
												<span className="officer-bar-label" title={o.officer}>{o.officer}</span>
												<div className="officer-bar-track">
													<div className="officer-bar-fill" style={{ width: `${(o.served / maxOfficer) * 100}%` }} />
												</div>
												<span className="officer-bar-val">{o.served}</span>
											</div>
										))}
									</div>
								)}
							</div>

							<div className="adm-card">
								<div className="adm-card-header">
									<div>
										<div className="adm-card-title">Recent Tickets</div>
										<div className="adm-card-sub">Latest activity today</div>
									</div>
								</div>
								{recentTickets.length === 0 ? (
									<div className="adm-empty"><div className="adm-empty-icon">🎫</div>No tickets yet today</div>
								) : (
									<table className="adm-table">
										<thead>
											<tr>
												<th>#</th>
												<th>Service</th>
												<th>Officer</th>
												<th>Status</th>
											</tr>
										</thead>
										<tbody>
											{recentTickets.map((t, i) => (
												<tr key={i}>
													<td className="mono">…{t.name.slice(-4)}</td>
													<td>{t.service_requested}</td>
													<td style={{ color: "#8d99a6", fontSize: 12 }}>{(t.officer || "—").split("@")[0]}</td>
													<td><Pill status={t.status} /></td>
												</tr>
											))}
										</tbody>
									</table>
								)}
							</div>
						</div>
					</>
				)}

				{/* ══════════════════════════════════════════════════════════════
            TICKETS REPORT TAB
        ══════════════════════════════════════════════════════════════ */}
				{view === "report" && (
					<>
						<div className="adm-report-bar">
							<span style={{ fontSize: 13, fontWeight: 600, color: "#8d99a6" }}>From</span>
							<input
								type="date"
								className="adm-date-input"
								value={reportDateFrom}
								onChange={e => setReportDateFrom(e.target.value)}
							/>
							<span style={{ fontSize: 13, fontWeight: 600, color: "#8d99a6" }}>To</span>
							<input
								type="date"
								className="adm-date-input"
								value={reportDateTo}
								onChange={e => setReportDateTo(e.target.value)}
							/>
							<button className="adm-btn primary" onClick={fetchReport} disabled={loading}>
								{loading ? "Loading…" : "↻ Load"}
							</button>
							<div style={{ flex: 1 }} />
							<div className="report-summary">
								{[
									{ label: "Total", val: reportRows.length },
									{ label: "Completed", val: reportRows.filter(r => r.status === "Completed").length },
									{ label: "No Show", val: reportRows.filter(r => r.status === "No Show").length },
									{ label: "Waiting", val: reportRows.filter(r => r.status === "Waiting").length },
								].map((s, i) => (
									<span className="rsummary-pill" key={i}>{s.label}: <span>{s.val}</span></span>
								))}
							</div>
							<button className="adm-btn success btn btn-sm btn-primary" onClick={downloadTicketsCSV} disabled={!reportRows.length}>
								<Icon name="download" /> Download CSV
							</button>
						</div>

						<div className="adm-card" style={{ padding: 0, overflow: "hidden" }}>
							{reportRows.length === 0 ? (
								<div className="adm-empty">
									<div className="adm-empty-icon"><Icon name="file" /></div>
									<div>No tickets found for {reportDateFrom} to {reportDateTo}</div>
								</div>
							) : (
								<div style={{ overflowX: "auto" }}>
									<table className="adm-table">
										<thead>
											<tr>
												<th>Ticket ID</th>
												<th>Service</th>
												<th>Customer Name</th>
												<th>Civil ID</th>
												<th>Officer</th>
												<th>Status</th>
												<th>Created</th>
												<th>Completed At</th>
											</tr>
										</thead>
										<tbody>
											{reportRows.map((t, i) => (
												<tr key={i}>
													<td className="mono">{t.name}</td>
													<td>{t.service_requested}</td>
													<td>{t.customer_name || <span style={{ color: "#d1d8dd" }}>—</span>}</td>
													<td className="mono">{t.customer_id || <span style={{ color: "#d1d8dd" }}>—</span>}</td>
													<td style={{ color: "#8d99a6", fontSize: 12 }}>{(t.officer || "—").split("@")[0]}</td>
													<td><Pill status={t.status} /></td>
													<td style={{ fontSize: 12, color: "#8d99a6" }}>{t.creation ? new Date(t.creation).toLocaleTimeString() : "—"}</td>
													<td style={{ fontSize: 12, color: "#8d99a6" }}>{t.completed_at ? new Date(t.completed_at).toLocaleTimeString() : "—"}</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							)}
						</div>
					</>
				)}

				{/* ══════════════════════════════════════════════════════════════
            FEEDBACK REPORT TAB
        ══════════════════════════════════════════════════════════════ */}
				{view === "feedback" && (
					<>
						<div className="adm-report-bar">
							<span style={{ fontSize: 13, fontWeight: 600, color: "#8d99a6" }}>From</span>
							<input
								type="date"
								className="adm-date-input"
								value={reportDateFrom}
								onChange={e => setReportDateFrom(e.target.value)}
							/>
							<span style={{ fontSize: 13, fontWeight: 600, color: "#8d99a6" }}>To</span>
							<input
								type="date"
								className="adm-date-input"
								value={reportDateTo}
								onChange={e => setReportDateTo(e.target.value)}
							/>
							<button className="adm-btn primary" onClick={fetchReport} disabled={loading}>
								{loading ? "Loading…" : "↻ Load"}
							</button>
							<div style={{ flex: 1 }} />
							{feedbackRows.length > 0 && (
								<div className="report-summary">
									{[1, 2, 3, 4, 5].map(r => {
										const count = feedbackRows.filter(f => f.rating === r).length;
										return count > 0 ? (
											<span className="rsummary-pill" key={r}>
												{"★".repeat(r)}: <span>{count}</span>
											</span>
										) : null;
									})}
									<span className="rsummary-pill">
										Avg: <span>
											{feedbackRows.length
												? (feedbackRows.reduce((s, f) => s + (f.rating || 0), 0) / feedbackRows.length).toFixed(1)
												: "—"}
										</span>
									</span>
								</div>
							)}
							<button className="adm-btn success" onClick={downloadFeedbackCSV} disabled={!feedbackRows.length}>
								⬇ Download CSV
							</button>
						</div>

						{/* Rating distribution mini chart */}
						{feedbackRows.length > 0 && (
							<div className="adm-card" style={{ marginBottom: 20 }}>
								<div className="adm-card-header">
									<div>
										<div className="adm-card-title">Rating Distribution</div>
										<div className="adm-card-sub">{feedbackRows.length} responses on {reportDate}</div>
									</div>
								</div>
								<MiniBar
									data={[1, 2, 3, 4, 5].map(r => ({
										star: ["★", "★★", "★★★", "★★★★", "★★★★★"][r - 1],
										count: feedbackRows.filter(f => f.rating === r).length,
									}))}
									valueKey="count"
									labelKey="star"
									color="#f59e0b"
									height={110}
								/>
							</div>
						)}

						<div className="adm-card" style={{ padding: 0, overflow: "hidden" }}>
							{feedbackRows.length === 0 ? (
								<div className="adm-empty">
									<div className="adm-empty-icon"><Icon name="star" /></div>
									<div>No feedback found for {reportDateFrom} to {reportDateTo}</div>
								</div>
							) : (
								<div style={{ overflowX: "auto" }}>
									<table className="adm-table">
										<thead>
											<tr>
												<th>Ticket</th>
												<th>Service</th>
												<th>Rating</th>
												<th>Comment</th>
												<th>Submitted At</th>
											</tr>
										</thead>
										<tbody>
											{feedbackRows.map((f, i) => (
												<tr key={i}>
													<td className="mono">{f.ticket}</td>
													<td>{f.service}</td>
													<td>
														<Stars rating={f.rating} />
														<span style={{ marginLeft: 4, fontSize: 12, color: "#8d99a6" }}>{f.rating}/5</span>
													</td>
													<td style={{ fontSize: 13, color: f.comment ? "#1f272e" : "#d1d8dd", fontStyle: f.comment ? "normal" : "italic", maxWidth: 260 }}>
														{f.comment || "No comment"}
													</td>
													<td style={{ fontSize: 12, color: "#8d99a6", whiteSpace: "nowrap" }}>
														{f.submitted_at ? new Date(f.submitted_at).toLocaleTimeString() : "—"}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							)}
						</div>
					</>
				)}

			</div>
		</div>
	);
}
