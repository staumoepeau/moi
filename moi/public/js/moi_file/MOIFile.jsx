import React, { useState, useEffect, useRef } from "react";

export function MOIFile() {
    const [sections, setSections] = useState([]);
    const [activeTab, setActiveTab] = useState("");
    const [uploading, setUploading] = useState(false);
    // Check if user has the "MOI Docs" role
    const canUpload = frappe.user_roles.includes("MOI Docs");
    const fileInputRef = useRef(null);

    const fetchFiles = async () => {
        try {
            const res = await frappe.call({ method: "moi.api.hr.list_hr_forms" });
            if (res.message) {
                setSections(res.message);
                if (!activeTab && res.message.length > 0) {
                    setActiveTab(res.message[0].title);
                }
            }
        } catch (err) { console.error("Fetch failed", err); }
    };

    useEffect(() => { fetchFiles(); }, []);

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
                        category: activeTab 
                    }
                });
                frappe.show_alert({ message: "File Saved to Disk", indicator: "green" });
                fetchFiles();
            } catch (err) {
                console.error("Upload failed", err);
            } finally {
                setUploading(false);
                e.target.value = null;
            }
        };
        reader.readAsDataURL(file);
    };

    const currentFiles = sections.find(s => s.title === activeTab)?.files || [];

    return (
        <div className="p-4" style={{ backgroundColor: '#fff', minHeight: '100vh' }}>
            {/* Header Area */}
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h3 style={{ fontWeight: 700, color: '#111827' }}>Ministry's Documents</h3>
                
                {/* Conditional Rendering based on Role */}
                {canUpload && (
                    <>
                        <input type="file" ref={fileInputRef} onChange={handleUpload} style={{ display: 'none' }} />
                        <button className="btn btn-primary" onClick={() => fileInputRef.current.click()} disabled={uploading}>
                            {uploading ? "Uploading..." : `Upload to ${activeTab}`}
                        </button>
                    </>
                )}
            </div>

            {/* Tab Navigation */}
            <div className="d-flex mb-4" style={{ borderBottom: '1px solid #e5e7eb', gap: '30px' }}>
                {sections.map((section) => (
                    <div
                        key={section.title}
                        onClick={() => setActiveTab(section.title)}
                        style={{
                            padding: '12px 4px', cursor: 'pointer', fontSize: '14px', fontWeight: '600',
                            color: activeTab === section.title ? '#1a73e8' : '#6b7280',
                            borderBottom: activeTab === section.title ? '3px solid #1a73e8' : '3px solid transparent',
                            textTransform: 'uppercase'
                        }}
                    >
                        {section.title}
                    </div>
                ))}
            </div>

            {/* Document Table */}
            <div className="border rounded shadow-sm">
                <table className="table mb-0">
                    <thead style={{ backgroundColor: '#f9fafb' }}>
                        <tr>
                            <th style={{ padding: '15px 20px', fontWeight: '700' }}>FILE NAME</th>
                            <th style={{ padding: '15px 20px', fontWeight: '700' }}>TYPE</th>
                            <th style={{ padding: '15px 20px', fontWeight: '700' }}>SIZE</th>
                            <th style={{ padding: '15px 20px', fontWeight: '700', textAlign: 'right' }}>ACTION</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentFiles.length > 0 ? currentFiles.map((file) => (
                            <tr key={file.file_url}>
                                <td style={{ padding: '15px 20px' }}>{file.file_name}</td>
                                <td style={{ padding: '15px 20px' }}>{file.ext}</td>
                                <td style={{ padding: '15px 20px' }}>{(file.size_bytes / 1024).toFixed(1)} KB</td>
                                <td style={{ padding: '15px 20px', textAlign: 'right' }}>
                                    <a href={file.file_url} target="_blank" className="btn btn-sm btn-primary">Download</a>
                                </td>
                            </tr>
                        )) : (
                            <tr><td colSpan="4" className="text-center py-5 text-muted">No files found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}