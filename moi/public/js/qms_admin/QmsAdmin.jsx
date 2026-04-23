import * as React from "react";
import { getQmsPageStyles } from "../qms_shared/qmsTheme";
import { useMinistryBranding } from "../qms_shared/useMinistryBranding";

export function QmsAdmin() {
	const currentUser = frappe.session.user;
	const currentUserInfo = frappe.boot.user_info?.[currentUser] || {};
	const fullName = currentUserInfo.fullname || currentUser;
	const userImage = currentUserInfo.image || null;
	const initials = fullName.split(" ").filter(Boolean).map(w => w[0]).join("").toUpperCase().slice(0, 2);

	// Ministry branding
	const { logo: ministryLogo } = useMinistryBranding();

	const [userMenuOpen, setUserMenuOpen] = React.useState(false);
	const userMenuRef = React.useRef(null);

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

	const Icon = ({ name, className = "", style = {} }) => (
		<i className={`octicon octicon-${name} ${className}`} style={{ marginRight: 6, ...style }} aria-hidden="true" />
	);

	// ── CSS Styles ────────────────────────────────────────────────────────
	const styles = `
		.qms-admin-root {
			background: #f9fafb;
			display: flex;
			flex-direction: column;
			height: 100%;
		}

		.qms-admin-header {
			background: white;
			border-bottom: 1px solid #e5e7eb;
			padding: 1rem 2rem;
			display: flex;
			align-items: center;
			justify-content: space-between;
		}

		.qms-admin-header-left {
			display: flex;
			align-items: center;
			gap: 1rem;
		}

		.qms-admin-header-content h1 {
			margin: 0;
			font-size: 1.5rem;
			font-weight: 600;
			color: #1f2937;
		}

		.qms-admin-header-content p {
			margin: 0;
			font-size: 0.875rem;
			color: #6b7280;
		}

		.qms-admin-header-right {
			display: flex;
			align-items: center;
			gap: 1rem;
		}

		.qms-admin-btn {
			padding: 0.5rem 1rem;
			border: none;
			border-radius: 0.375rem;
			font-size: 0.875rem;
			cursor: pointer;
			display: flex;
			align-items: center;
			gap: 0.5rem;
			transition: all 0.2s;
		}

		.qms-admin-btn-primary {
			background: #2490ef;
			color: white;
		}

		.qms-admin-btn-primary:hover {
			background: #1d7cd3;
		}

		.qms-admin-btn-secondary {
			background: #e5e7eb;
			color: #1f2937;
		}

		.qms-admin-btn-secondary:hover {
			background: #d1d5db;
		}

		.qms-admin-body {
			flex: 1;
			padding: 2rem;
			overflow-y: auto;
		}

		.qms-admin-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
			gap: 1.5rem;
		}

		.qms-admin-card {
			background: white;
			border-radius: 0.5rem;
			padding: 2rem;
			box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
			display: flex;
			flex-direction: column;
			align-items: center;
			text-align: center;
			gap: 1rem;
			cursor: pointer;
			transition: all 0.3s;
		}

		.qms-admin-card:hover {
			box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1);
			transform: translateY(-4px);
		}

		.qms-admin-card-icon {
			font-size: 3rem;
			color: #2490ef;
		}

		.qms-admin-card-title {
			font-size: 1.25rem;
			font-weight: 600;
			color: #1f2937;
			margin: 0;
		}

		.qms-admin-card-desc {
			font-size: 0.875rem;
			color: #6b7280;
			margin: 0;
		}

		.qms-admin-btn-large {
			width: 100%;
			padding: 0.75rem 1.5rem;
			background: #2490ef;
			color: white;
			border: none;
			border-radius: 0.375rem;
			font-size: 1rem;
			font-weight: 500;
			cursor: pointer;
			transition: all 0.2s;
		}

		.qms-admin-btn-large:hover {
			background: #1d7cd3;
		}

		.qms-user-wrap {
			position: relative;
		}

		.qms-user-btn {
			display: flex;
			align-items: center;
			gap: 0.75rem;
			background: none;
			border: none;
			cursor: pointer;
		}

		.qms-avatar {
			width: 40px;
			height: 40px;
			border-radius: 50%;
			background: #2490ef;
			color: white;
			display: flex;
			align-items: center;
			justify-content: center;
			font-weight: 600;
			font-size: 0.875rem;
			overflow: hidden;
		}

		.qms-avatar img {
			width: 100%;
			height: 100%;
			object-fit: cover;
		}

		.qms-user-info {
			text-align: right;
		}

		.qms-user-name {
			font-size: 0.875rem;
			font-weight: 500;
			color: #1f2937;
		}

		.qms-user-role {
			font-size: 0.75rem;
			color: #6b7280;
		}

		.qms-dropdown {
			position: absolute;
			top: 100%;
			right: 0;
			background: white;
			border: 1px solid #e5e7eb;
			border-radius: 0.375rem;
			margin-top: 0.5rem;
			min-width: 200px;
			box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1);
			z-index: 100;
		}

		.qms-dropdown-item {
			display: flex;
			align-items: center;
			width: 100%;
			padding: 0.75rem 1rem;
			border: none;
			background: none;
			cursor: pointer;
			font-size: 0.875rem;
			color: #374151;
			transition: all 0.2s;
		}

		.qms-dropdown-item:hover {
			background: #f3f4f6;
		}

		.qms-dropdown-item.danger {
			color: #dc2626;
		}

		.qms-dropdown-item.danger:hover {
			background: #fee2e2;
		}

		.qms-dropdown-divider {
			height: 1px;
			background: #e5e7eb;
			margin: 0.5rem 0;
		}

		.qms-chevron {
			display: inline-block;
			transition: transform 0.2s;
		}

		.qms-chevron.open {
			transform: rotate(180deg);
		}
	`;

	// ── Handlers ────────────────────────────────────────────────────────
	const handleAddCounter = () => {
		frappe.new_doc("QMS Counter", {}, (doc) => {
			frappe.ui.form.FormPage(doc);
		});
	};

	const handleAddService = () => {
		frappe.new_doc("QMS Service", {}, (doc) => {
			frappe.ui.form.FormPage(doc);
		});
	};

	// ── Render ────────────────────────────────────────────────────────────
	return (
		<div className="qms-admin-root">
			<style>{styles}</style>

			{/* Header */}
			<div className="qms-admin-header">
				<div className="qms-admin-header-left">
					{ministryLogo ? (
						<img src={ministryLogo} style={{ height: 40, width: "auto", borderRadius: 8, flexShrink: 0 }} alt="Ministry Logo" />
					) : (
						<div style={{ width: 40, height: 40, background: "#2490ef", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "1.5rem", fontWeight: "bold" }}>Q</div>
					)}
					<div className="qms-admin-header-content">
						<h1>QMS Administration</h1>
						<p>Manage counters and services</p>
					</div>
				</div>

				<div className="qms-admin-header-right">
					{/* User menu */}
					<div className="qms-user-wrap" ref={userMenuRef}>
						<button className="qms-user-btn" onClick={() => setUserMenuOpen(o => !o)}>
							<div className="qms-avatar">
								{userImage
									? <img src={userImage} alt={fullName} />
									: initials
								}
							</div>
							<div className="qms-user-info">
								<div className="qms-user-name">{fullName}</div>
								<div className="qms-user-role">QMS Admin</div>
							</div>
							<span className={`qms-chevron${userMenuOpen ? " open" : ""}`}>▼</span>
						</button>

						{userMenuOpen && (
							<div className="qms-dropdown">
								<button className="qms-dropdown-item" onClick={() => { setUserMenuOpen(false); window.location.href = "/app/user/" + currentUser; }}>
									<Icon name="person" /> My Profile
								</button>
								<button className="qms-dropdown-item" onClick={() => { setUserMenuOpen(false); window.location.href = "/app"; }}>
									<Icon name="home" /> Back to Desk
								</button>
								<button className="qms-dropdown-item" onClick={() => { setUserMenuOpen(false); window.location.href = "/app/qms_dashboard"; }}>
									<Icon name="graph" /> QMS Dashboard
								</button>
								<div className="qms-dropdown-divider" />
								<button className="qms-dropdown-item danger" onClick={() => { setUserMenuOpen(false); handleLogout(); }}>
									<Icon name="sign-out" /> Log Out
								</button>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Body */}
			<div className="qms-admin-body">
				<div className="qms-admin-grid">
					{/* Add Counter Card */}
					<div className="qms-admin-card" onClick={handleAddCounter}>
						<div className="qms-admin-card-icon">
							<i className="octicon octicon-plus-circle" style={{ fontSize: "3rem", color: "#2490ef" }} aria-hidden="true" />
						</div>
						<h2 className="qms-admin-card-title">Add Counter</h2>
						<p className="qms-admin-card-desc">Create a new service counter</p>
						<button className="qms-admin-btn-large">
							<Icon name="plus" /> Add Counter
						</button>
					</div>

					{/* Add Service Card */}
					<div className="qms-admin-card" onClick={handleAddService}>
						<div className="qms-admin-card-icon">
							<i className="octicon octicon-plus-circle" style={{ fontSize: "3rem", color: "#10b981" }} aria-hidden="true" />
						</div>
						<h2 className="qms-admin-card-title">Add Service</h2>
						<p className="qms-admin-card-desc">Create a new service offering</p>
						<button className="qms-admin-btn-large" style={{ background: "#10b981" }} onMouseEnter={(e) => e.target.style.background = "#059669"} onMouseLeave={(e) => e.target.style.background = "#10b981"}>
							<Icon name="plus" /> Add Service
						</button>
					</div>

					{/* Manage Counters Card */}
					<div className="qms-admin-card" onClick={() => window.location.href = "/app/qms-counter"}>
						<div className="qms-admin-card-icon">
							<i className="octicon octicon-list" style={{ fontSize: "3rem", color: "#f59e0b" }} aria-hidden="true" />
						</div>
						<h2 className="qms-admin-card-title">Manage Counters</h2>
						<p className="qms-admin-card-desc">View and edit all counters</p>
						<button className="qms-admin-btn-large" style={{ background: "#f59e0b" }} onMouseEnter={(e) => e.target.style.background = "#d97706"} onMouseLeave={(e) => e.target.style.background = "#f59e0b"}>
							<Icon name="list" /> View All
						</button>
					</div>

					{/* Manage Services Card */}
					<div className="qms-admin-card" onClick={() => window.location.href = "/app/qms-service"}>
						<div className="qms-admin-card-icon">
							<i className="octicon octicon-list" style={{ fontSize: "3rem", color: "#8b5cf6" }} aria-hidden="true" />
						</div>
						<h2 className="qms-admin-card-title">Manage Services</h2>
						<p className="qms-admin-card-desc">View and edit all services</p>
						<button className="qms-admin-btn-large" style={{ background: "#8b5cf6" }} onMouseEnter={(e) => e.target.style.background = "#7c3aed"} onMouseLeave={(e) => e.target.style.background = "#8b5cf6"}>
							<Icon name="list" /> View All
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
