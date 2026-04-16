import * as React from "react";
import { getQmsPageStyles } from "../qms_shared/qmsTheme";
import { useMinistryBranding } from "../qms_shared/useMinistryBranding";

export function QmsServiceForm() {
	const currentUser = frappe.session.user;
	const currentUserInfo = frappe.boot.user_info?.[currentUser] || {};
	const currentUserName = currentUserInfo.fullname || currentUser;
	const userImage = currentUserInfo.image || null;
	const { logo: ministryLogo } = useMinistryBranding();

	const [formData, setFormData] = React.useState({
		service_name: "",
		avg_time: 30,
		image: "fa-home",
		background_color: "#e8f4fd",
		is_active: true,
		checklist: [],
	});

	const [checklistItem, setChecklistItem] = React.useState("");
	const [loading, setLoading] = React.useState(false);
	const [savedService, setSavedService] = React.useState(null);

	const Icon = ({ name, className = "", style = {} }) => (
		<i className={`octicon octicon-${name} ${className}`} style={{ marginRight: 6, ...style }} aria-hidden="true" />
	);

	const fontAwesomeIcons = [
		"fa-home", "fa-wrench", "fa-users", "fa-cog", "fa-file", "fa-phone",
		"fa-building", "fa-hospital", "fa-school", "fa-briefcase", "fa-truck",
		"fa-box", "fa-credit-card", "fa-envelope", "fa-calendar", "fa-chart-bar",
		"fa-lock", "fa-shield", "fa-star", "fa-check"
	];

	// Load Font Awesome CSS
	React.useEffect(() => {
		if (!document.querySelector('link[href*="font-awesome"]') && !document.querySelector('link[href*="fontawesome"]')) {
			const link = document.createElement('link');
			link.rel = 'stylesheet';
			link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
			document.head.appendChild(link);
		}
	}, []);

	const handleInputChange = (field, value) => {
		setFormData(prev => ({
			...prev,
			[field]: value
		}));
	};

	const handleAddChecklistItem = () => {
		if (!checklistItem.trim()) {
			frappe.msgprint("Checklist item cannot be empty");
			return;
		}
		setFormData(prev => ({
			...prev,
			checklist: [...prev.checklist, {
				idx: prev.checklist.length + 1,
				checklist_item: checklistItem,
				is_required: false
			}]
		}));
		setChecklistItem("");
	};

	const handleRemoveChecklistItem = (index) => {
		setFormData(prev => ({
			...prev,
			checklist: prev.checklist.filter((_, i) => i !== index)
		}));
	};

	const handleToggleRequired = (index) => {
		setFormData(prev => {
			const newChecklist = [...prev.checklist];
			newChecklist[index].is_required = !newChecklist[index].is_required;
			return { ...prev, checklist: newChecklist };
		});
	};

	const handleSave = async () => {
		if (!formData.service_name.trim()) {
			frappe.msgprint("Service Name is required");
			return;
		}

		setLoading(true);
		try {
			const serviceDoc = {
				doctype: "QMS Service",
				service_name: formData.service_name,
				avg_time: formData.avg_time,
				image: formData.image,
				background_color: formData.background_color,
				is_active: formData.is_active,
			};

			const savedDoc = await frappe.call({
				method: "frappe.client.insert",
				args: { doc: serviceDoc }
			});

			if (savedDoc.message) {
				const docName = savedDoc.message.name;
				setSavedService(docName);

				// Add checklist items if any
				if (formData.checklist.length > 0) {
					for (let item of formData.checklist) {
						await frappe.call({
							method: "frappe.client.insert",
							args: {
								doc: {
									doctype: "QMS Service Checklist",
									parent: docName,
									parentfield: "checklist",
									parenttype: "QMS Service",
									checklist_item: item.checklist_item,
									is_required: item.is_required
								}
							}
						});
					}
				}

				frappe.show_alert({
					message: `Service "${formData.service_name}" created successfully!`,
					indicator: "green"
				});

				// Reset form
				setFormData({
					service_name: "",
					avg_time: 30,
					image: "fa-home",
					background_color: "#e8f4fd",
					is_active: true,
					checklist: []
				});
				setChecklistItem("");
			}
		} catch (error) {
			console.error("Save error:", error);
			frappe.msgprint({
				title: "Error",
				message: error.message || "Failed to create service"
			});
		} finally {
			setLoading(false);
		}
	};

	const styles = `
		${getQmsPageStyles()}
		.service-form-container {
			max-width: 900px;
			margin: 0 auto;
			padding: 20px;
		}
		.service-form-header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			margin-bottom: 30px;
			padding-bottom: 20px;
			border-bottom: 2px solid var(--border-color);
		}
		.service-form-header h1 {
			margin: 0;
			font-size: 28px;
			font-weight: 600;
			color: var(--text-color);
		}
		.back-button {
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 8px 16px;
			background: transparent;
			border: 1px solid var(--border-color);
			border-radius: 6px;
			cursor: pointer;
			font-size: 14px;
			color: var(--text-color);
			transition: all 0.2s;
		}
		.back-button:hover {
			background: var(--bg-light);
			border-color: var(--border-strong);
		}
		.form-section {
			background: var(--bg-light);
			border: 1px solid var(--border-color);
			border-radius: 8px;
			padding: 24px;
			margin-bottom: 24px;
		}
		.form-section-title {
			font-size: 16px;
			font-weight: 600;
			margin-bottom: 16px;
			color: var(--text-color);
		}
		.form-row {
			display: grid;
			grid-template-columns: repeat(2, 1fr);
			gap: 20px;
			margin-bottom: 20px;
		}
		.form-row.full {
			grid-template-columns: 1fr;
		}
		.form-group {
			display: flex;
			flex-direction: column;
		}
		.form-group label {
			font-size: 13px;
			font-weight: 500;
			margin-bottom: 8px;
			color: var(--text-muted);
			text-transform: uppercase;
			letter-spacing: 0.5px;
		}
		.form-group label .required {
			color: var(--error-color);
			margin-left: 3px;
		}
		.form-group input,
		.form-group select {
			padding: 10px 12px;
			border: 1px solid var(--border-color);
			border-radius: 6px;
			font-size: 14px;
			font-family: inherit;
			transition: all 0.2s;
		}
		.form-group input:focus,
		.form-group select:focus {
			outline: none;
			border-color: var(--primary-color);
			box-shadow: 0 0 0 3px rgba(46, 144, 250, 0.1);
		}
		.icon-preview {
			display: flex;
			align-items: center;
			gap: 12px;
			padding: 12px;
			background: var(--bg-light);
			border: 1px dashed var(--border-color);
			border-radius: 6px;
			margin-top: 8px;
		}
		.icon-preview i {
			font-size: 32px;
			color: var(--primary-color);
		}
		.color-preview {
			width: 100%;
			height: 100px;
			border-radius: 6px;
			border: 1px solid var(--border-color);
			margin-top: 8px;
			transition: all 0.2s;
		}
		.checkbox-group {
			display: flex;
			align-items: center;
			gap: 8px;
		}
		.checkbox-group input[type="checkbox"] {
			width: 18px;
			height: 18px;
			cursor: pointer;
		}
		.checklist-section {
			background: var(--bg-light);
			border: 1px solid var(--border-color);
			border-radius: 8px;
			padding: 20px;
			margin-bottom: 24px;
		}
		.checklist-input-group {
			display: flex;
			gap: 8px;
			margin-bottom: 16px;
		}
		.checklist-input-group input {
			flex: 1;
			padding: 10px 12px;
			border: 1px solid var(--border-color);
			border-radius: 6px;
			font-size: 14px;
		}
		.checklist-input-group button {
			padding: 10px 16px;
			background: var(--primary-color);
			color: white;
			border: none;
			border-radius: 6px;
			cursor: pointer;
			font-weight: 500;
			transition: all 0.2s;
		}
		.checklist-input-group button:hover {
			background: var(--primary-color-dark);
		}
		.checklist-items {
			display: flex;
			flex-direction: column;
			gap: 8px;
		}
		.checklist-item {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 12px;
			background: white;
			border: 1px solid var(--border-color);
			border-radius: 6px;
		}
		.checklist-item-content {
			display: flex;
			align-items: center;
			gap: 12px;
			flex: 1;
		}
		.checklist-item-actions {
			display: flex;
			gap: 8px;
			align-items: center;
		}
		.checklist-item-actions button {
			padding: 6px 12px;
			font-size: 12px;
			border: 1px solid var(--border-color);
			background: transparent;
			border-radius: 4px;
			cursor: pointer;
			transition: all 0.2s;
		}
		.checklist-item-actions button:hover {
			background: var(--bg-light);
			border-color: var(--border-strong);
		}
		.checklist-item-actions button.required {
			background: #22c55e;
			color: white;
			border-color: #22c55e;
		}
		.form-actions {
			display: flex;
			gap: 12px;
			justify-content: flex-end;
		}
		.btn-primary, .btn-secondary {
			padding: 12px 24px;
			font-size: 14px;
			font-weight: 500;
			border: none;
			border-radius: 6px;
			cursor: pointer;
			transition: all 0.2s;
		}
		.btn-primary {
			background: var(--primary-color);
			color: white;
		}
		.btn-primary:hover:not(:disabled) {
			background: #1976d2;
		}
		.btn-primary:disabled {
			opacity: 0.6;
			cursor: not-allowed;
		}
		.btn-secondary {
			background: transparent;
			border: 1px solid var(--border-color);
			color: var(--text-color);
		}
		.btn-secondary:hover {
			background: var(--bg-light);
		}
		.success-message {
			background: #f0fdf4;
			border: 1px solid #22c55e;
			border-radius: 8px;
			padding: 16px;
			margin-bottom: 24px;
		}
		.success-message h3 {
			color: #22c55e;
			margin: 0 0 8px 0;
		}
		.success-message p {
			color: #16a34a;
			margin: 0;
		}
		@media (max-width: 768px) {
			.form-row {
				grid-template-columns: 1fr;
			}
			.service-form-container {
				padding: 16px;
			}
			.form-section {
				padding: 16px;
			}
		}
	`;

	return (
		<div>
			<style>{styles}</style>
			<div className="service-form-container">
				{/* Header */}
				<div className="service-form-header">
					<h1>Create New Service</h1>
					<button className="back-button" onClick={() => window.history.back()}>
						<Icon name="arrow-left" style={{ marginRight: 4 }} />
						Back
					</button>
				</div>

				{/* Success Message */}
				{savedService && (
					<div className="success-message">
						<h3>✓ Service Created Successfully</h3>
						<p>Service <strong>{savedService}</strong> has been created and is ready to use.</p>
					</div>
				)}

				{/* Basic Info Section */}
				<div className="form-section">
					<div className="form-section-title">Basic Information</div>

					<div className="form-row">
						<div className="form-group">
							<label>Service Name <span className="required">*</span></label>
							<input
								type="text"
								value={formData.service_name}
								onChange={(e) => handleInputChange("service_name", e.target.value)}
								placeholder="e.g., Birth Certificate Processing"
							/>
						</div>

						<div className="form-group">
							<label>Avg. Service Time (Minutes)</label>
							<input
								type="number"
								value={formData.avg_time}
								onChange={(e) => handleInputChange("avg_time", parseInt(e.target.value) || 0)}
								min="1"
								max="480"
								placeholder="30"
							/>
						</div>
					</div>
				</div>

				{/* Appearance Section */}
				<div className="form-section">
					<div className="form-section-title">Appearance</div>

					<div className="form-row">
						<div className="form-group">
							<label>Icon <span className="required">*</span></label>
							<select
								value={formData.image}
								onChange={(e) => handleInputChange("image", e.target.value)}
							>
								{fontAwesomeIcons.map(icon => (
									<option key={icon} value={icon}>{icon}</option>
								))}
							</select>
							<div className="icon-preview">
								<i className={`fas ${formData.image}`}></i>
								<span>{formData.image}</span>
							</div>
						</div>

						<div className="form-group">
							<label>Background Color</label>
							<input
								type="color"
								value={formData.background_color}
								onChange={(e) => handleInputChange("background_color", e.target.value)}
							/>
							<div
								className="color-preview"
								style={{ backgroundColor: formData.background_color }}
							></div>
						</div>
					</div>

					<div className="form-row">
						<div className="form-group">
							<label className="checkbox-group">
								<input
									type="checkbox"
									checked={formData.is_active}
									onChange={(e) => handleInputChange("is_active", e.target.checked)}
								/>
								<span>Active Service</span>
							</label>
						</div>
					</div>
				</div>

				{/* Checklist Section */}
				<div className="checklist-section">
					<div className="form-section-title">Requirements Checklist</div>
					<p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
						Add checklist items that customers must complete before proceeding with this service.
					</p>

					<div className="checklist-input-group">
						<input
							type="text"
							value={checklistItem}
							onChange={(e) => setChecklistItem(e.target.value)}
							onKeyPress={(e) => e.key === "Enter" && handleAddChecklistItem()}
							placeholder="e.g., Bring valid ID, Fill out form..."
						/>
						<button onClick={handleAddChecklistItem}>Add Item</button>
					</div>

					{formData.checklist.length > 0 && (
						<div className="checklist-items">
							{formData.checklist.map((item, index) => (
								<div key={index} className="checklist-item">
									<div className="checklist-item-content">
										<span style={{ flex: 1 }}>{item.checklist_item}</span>
									</div>
									<div className="checklist-item-actions">
										<button
											className={item.is_required ? "required" : ""}
											onClick={() => handleToggleRequired(index)}
											title={item.is_required ? "Required" : "Optional"}
										>
											{item.is_required ? "Required" : "Optional"}
										</button>
										<button
											onClick={() => handleRemoveChecklistItem(index)}
											title="Remove item"
										>
											<Icon name="trash" style={{ marginRight: 0 }} />
										</button>
									</div>
								</div>
							))}
						</div>
					)}
				</div>

				{/* Form Actions */}
				<div className="form-actions">
					<button className="btn-secondary" onClick={() => window.history.back()}>
						Cancel
					</button>
					<button
						className="btn-primary"
						onClick={handleSave}
						disabled={loading || !formData.service_name.trim()}
					>
						{loading ? "Creating Service..." : "Create Service"}
					</button>
				</div>
			</div>
		</div>
	);
}
