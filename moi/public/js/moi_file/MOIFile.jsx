import React, { useState, useEffect, useRef } from "react";

export function MOIFile() {
	const [items, setItems] = useState({ folders: [], files: [] });
	const [pathStack, setPathStack] = useState([]);
	const [loading, setLoading] = useState(true);
	const [creating, setCreating] = useState(false);
	const [newFolderName, setNewFolderName] = useState("");
	const [uploading, setUploading] = useState(false);

	const canUpload = frappe.user_roles.includes("MOI Docs");
	const fileInputRef = useRef(null);
	const newFolderInputRef = useRef(null);

	const currentPath = pathStack.join("/");

	const fetchItems = async () => {
		try {
			setLoading(true);
			const res = await frappe.call({
				method: "moi.api.hr.list_hr_forms",
				args: { rel_path: currentPath }
			});
			if (res.message) {
				setItems(res.message);
			}
		} catch (err) {
			console.error("Fetch failed", err);
			setItems({ folders: [], files: [] });
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => { fetchItems(); }, [currentPath]);

	const handleNavigateFolder = (folderName) => {
		setPathStack([...pathStack, folderName]);
	};

	const handleBreadcrumbClick = (index) => {
		setPathStack(pathStack.slice(0, index));
	};

	const handleCreateFolder = async () => {
		if (!newFolderName.trim()) return;

		try {
			await frappe.call({
				method: "moi.api.hr.create_hr_folder",
				args: {
					rel_path: currentPath,
					folder_name: newFolderName.trim()
				}
			});
			frappe.show_alert({ message: "Folder created", indicator: "green" });
			setNewFolderName("");
			setCreating(false);
			fetchItems();
		} catch (err) {
			console.error("Folder creation failed", err);
		}
	};

	const handleUpload = (e) => {
		const file = e.target.files[0];
		if (!file) return;

		setUploading(true);
		const reader = new FileReader();
		reader.onload = async () => {
			try {
				const base64String = reader.result.split(",")[1];
				await frappe.call({
					method: "moi.api.hr.upload_hr_file",
					args: {
						file_content: base64String,
						filename: file.name,
						rel_path: currentPath
					}
				});
				frappe.show_alert({ message: "File uploaded", indicator: "green" });
				setNewFolderName("");
				fetchItems();
			} catch (err) {
				console.error("Upload failed", err);
			} finally {
				setUploading(false);
				e.target.value = null;
			}
		};
		reader.readAsDataURL(file);
	};

	const getFileIcon = (ext) => {
		const ext_lower = ext.toLowerCase();
		const iconMap = {
			"pdf": { bg: "#d33b27", text: "PDF" },
			"doc": { bg: "#4285f4", text: "DOC" },
			"docx": { bg: "#4285f4", text: "DOC" },
			"xls": { bg: "#0b7b3b", text: "XLS" },
			"xlsx": { bg: "#0b7b3b", text: "XLS" },
			"ppt": { bg: "#ea6a47", text: "PPT" },
			"pptx": { bg: "#ea6a47", text: "PPT" },
			"zip": { bg: "#9d7d4a", text: "ZIP" },
			"rar": { bg: "#9d7d4a", text: "RAR" },
			"7z": { bg: "#9d7d4a", text: "7Z" },
			"txt": { bg: "#5f6368", text: "TXT" },
			"csv": { bg: "#0b7b3b", text: "CSV" },
			"jpg": { bg: "#ea6a47", text: "JPG" },
			"jpeg": { bg: "#ea6a47", text: "JPG" },
			"png": { bg: "#ea6a47", text: "PNG" },
			"gif": { bg: "#ea6a47", text: "GIF" },
			"mp4": { bg: "#d33b27", text: "MP4" },
			"mov": { bg: "#d33b27", text: "MOV" },
			"avi": { bg: "#d33b27", text: "AVI" },
			"mp3": { bg: "#ea6a47", text: "MP3" },
			"wav": { bg: "#ea6a47", text: "WAV" },
		};
		return iconMap[ext_lower] || { bg: "#5f6368", text: ext_lower.substring(0, 3).toUpperCase() };
	};

	const formatFileSize = (bytes) => {
		if (bytes < 1024) return bytes + " B";
		if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
		return (bytes / (1024 * 1024)).toFixed(1) + " MB";
	};

	const formatDate = (timestamp) => {
		const d = new Date(timestamp * 1000);
		return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
	};

	// CSS
	const styles = `
		* { box-sizing: border-box; }
		body, html { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif; }

		.moi-file-container {
			background: #fff;
			min-height: 100vh;
			display: flex;
			flex-direction: column;
		}

		.moi-file-header {
			padding: 20px 40px;
			border-bottom: 1px solid #f0f0f0;
		}

		.moi-file-header h3 {
			margin: 0;
			font-weight: 400;
			color: #202124;
			font-size: 24px;
		}

		.breadcrumb {
			display: flex;
			align-items: center;
			gap: 8px;
			font-size: 13px;
			color: #5f6368;
			padding: 12px 40px;
			border-bottom: 1px solid #f0f0f0;
		}

		.breadcrumb-home {
			cursor: pointer;
			color: #1f8fe8;
			padding: 2px 4px;
		}

		.breadcrumb-home:hover {
			text-decoration: underline;
		}

		.breadcrumb-item {
			cursor: pointer;
			color: #1f8fe8;
			padding: 2px 4px;
		}

		.breadcrumb-item:hover {
			text-decoration: underline;
		}

		.breadcrumb-sep {
			color: #d2d3d4;
		}

		.action-bar {
			display: flex;
			gap: 8px;
			padding: 12px 40px;
			border-bottom: 1px solid #f0f0f0;
			align-items: center;
		}

		.btn-action {
			padding: 8px 16px;
			font-size: 14px;
			border: 1px solid #dadce0;
			background: #f8f9fa;
			border-radius: 4px;
			cursor: pointer;
			transition: all 0.2s;
			font-weight: 500;
			color: #3c4043;
		}

		.btn-action:hover {
			background: #f8f9fa;
			border-color: #dadce0;
		}

		.btn-primary-action {
			background: #1a73e8;
			color: #fff;
			border: 1px solid #1a73e8;
		}

		.btn-primary-action:hover {
			background: #1765cc;
		}

		.btn-action:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}

		.new-folder-dialog {
			background: transparent;
			padding: 12px 40px;
			display: flex;
			gap: 8px;
			align-items: center;
		}

		.new-folder-dialog input {
			padding: 8px 12px;
			border: 1px solid #dadce0;
			border-radius: 4px;
			font-size: 13px;
			font-family: inherit;
		}

		.new-folder-dialog input:focus {
			outline: none;
			border-color: #1a73e8;
		}

		.items-container {
			flex: 1;
			overflow: auto;
		}

		.items-table {
			width: 100%;
			border-collapse: collapse;
			padding: 0 40px;
		}

		.items-table tbody tr {
			border-bottom: 1px solid #f0f0f0;
			height: 48px;
			transition: background 0.15s;
		}

		.items-table tbody tr:hover {
			background: #f8f9fa;
		}

		.items-table td {
			padding: 0 16px;
			font-size: 13px;
			color: #202124;
			vertical-align: middle;
		}

		.items-table td:first-child {
			padding-left: 0;
		}

		.file-row-name {
			display: flex;
			align-items: center;
			gap: 12px;
			width: 100%;
		}

		.file-icon {
			width: 32px;
			height: 32px;
			border-radius: 2px;
			display: flex;
			align-items: center;
			justify-content: center;
			flex-shrink: 0;
			color: #fff;
			font-size: 11px;
			font-weight: 600;
			letter-spacing: 0.5px;
		}

		.folder-icon {
			width: 32px;
			height: 32px;
			display: flex;
			align-items: center;
			justify-content: center;
			flex-shrink: 0;
			font-size: 20px;
			color: #1f8fe8;
		}

		.file-name {
			cursor: pointer;
			color: #1f8fe8;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
			flex: 1;
		}

		.file-name:hover {
			text-decoration: underline;
		}

		.folder-name {
			cursor: pointer;
			color: #202124;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
			flex: 1;
		}

		.folder-name:hover {
			color: #1f8fe8;
		}

		.empty-state {
			text-align: center;
			padding: 80px 40px;
			color: #5f6368;
			flex: 1;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
		}

		.empty-state-icon {
			font-size: 48px;
			margin-bottom: 16px;
			opacity: 0.4;
		}

		.download-btn {
			background: transparent;
			border: 1px solid #dadce0;
			color: #1a73e8;
			padding: 6px 12px;
			border-radius: 4px;
			cursor: pointer;
			font-size: 12px;
			font-weight: 500;
			transition: all 0.2s;
			white-space: nowrap;
		}

		.download-btn:hover {
			background: #f8f9fa;
			border-color: #dadce0;
		}

		.col-name { width: 50%; }
		.col-modified { width: 20%; }
		.col-size { width: 15%; }
		.col-action { width: 15%; text-align: right; }
	`;

	return (
		<div className="moi-file-container">
			<style>{styles}</style>

			{/* Header */}
			<div className="moi-file-header">
				<h3>Ministry's Documents</h3>
			</div>

			{/* Breadcrumb */}
			<div className="breadcrumb">
				<span className="breadcrumb-home" onClick={() => setPathStack([])}>
					Home
				</span>
				{pathStack.map((folder, idx) => (
					<React.Fragment key={idx}>
						<span className="breadcrumb-sep">/</span>
						<span
							className="breadcrumb-item"
							onClick={() => handleBreadcrumbClick(idx)}
						>
							{folder}
						</span>
					</React.Fragment>
				))}
			</div>

			{/* Action Bar */}
			{canUpload && (
				<div className="action-bar">
					<button
						className="btn-action btn-primary-action"
						onClick={() => {
							setCreating(true);
							setTimeout(() => newFolderInputRef.current?.focus(), 0);
						}}
					>
						New folder
					</button>
					<button
						className="btn-action btn-primary-action"
						onClick={() => fileInputRef.current?.click()}
						disabled={uploading}
					>
						{uploading ? "Uploading..." : "Upload"}
					</button>
					<input
						type="file"
						ref={fileInputRef}
						onChange={handleUpload}
						style={{ display: "none" }}
					/>
				</div>
			)}

			{/* New Folder Dialog */}
			{creating && (
				<div className="new-folder-dialog">
					<input
						ref={newFolderInputRef}
						type="text"
						placeholder="Folder name"
						value={newFolderName}
						onChange={(e) => setNewFolderName(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") handleCreateFolder();
							if (e.key === "Escape") {
								setCreating(false);
								setNewFolderName("");
							}
						}}
					/>
					<button className="btn-action btn-primary-action" onClick={handleCreateFolder}>
						Create
					</button>
					<button
						className="btn-action"
						onClick={() => {
							setCreating(false);
							setNewFolderName("");
						}}
					>
						Cancel
					</button>
				</div>
			)}

			{/* Items */}
			{loading ? (
				<div className="empty-state">Loading...</div>
			) : items.folders.length === 0 && items.files.length === 0 ? (
				<div className="empty-state">
					<div className="empty-state-icon">📁</div>
					<div>This folder is empty</div>
				</div>
			) : (
				<div className="items-container">
					<table className="items-table">
						<tbody>
							{/* Folders */}
							{items.folders.map((folder) => (
								<tr key={`folder-${folder.name}`} onClick={() => handleNavigateFolder(folder.name)}>
									<td className="col-name">
										<div className="file-row-name">
											<div className="folder-icon">📁</div>
											<div className="folder-name">{folder.name}</div>
										</div>
									</td>
									<td className="col-modified">—</td>
									<td className="col-size">—</td>
									<td className="col-action">—</td>
								</tr>
							))}

							{/* Files */}
							{items.files.map((file) => {
								const icon = getFileIcon(file.ext);
								return (
									<tr key={`file-${file.file_url}`}>
										<td className="col-name">
											<div className="file-row-name">
												<div className="file-icon" style={{ backgroundColor: icon.bg }}>
													{icon.text}
												</div>
												<div className="file-name" title={file.file_name}>
													{file.file_name}
												</div>
											</div>
										</td>
										<td className="col-modified">{formatDate(file.modified)}</td>
										<td className="col-size">{formatFileSize(file.size_bytes)}</td>
										<td className="col-action">
											<a
												href={file.file_url}
												target="_blank"
												rel="noopener noreferrer"
												className="download-btn"
												onClick={(e) => e.stopPropagation()}
											>
												Download
											</a>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
