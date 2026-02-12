import * as React from "react";
import { useEffect, useState } from "react";

export function HRForms() {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadAllForms = async () => {
    setLoading(true);
    try {
      const res = await frappe.call({ method: "moi.api.hr.list_hr_forms" });
      if (res.message && !res.message.error) {
        setSections(res.message);
      } else {
        setError(res.message?.error || "No forms found");
      }
    } catch (err) {
      setError("Server connection failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAllForms(); }, []);

  const getIcon = (filename) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return <div className="doc-icon pdf">PDF</div>;
    if (ext === "docx" || ext === "doc") return <div className="doc-icon docx">DOCX</div>;
    return <div className="doc-icon generic">FILE</div>;
  };

  // Integrated Professional Styles
  const HrStyles = `
    .page-sidebar, .body-sidebar-container { display: none !important; }
    .hr-container { 
      max-width: 100%; margin: 0 auto; padding: 40px 20px; 
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: #f9fafb; min-height: 100vh;
    }
    .hr-header { border-bottom: 2px solid #e5e7eb; padding-bottom: 24px; margin-bottom: 40px; }
    .hr-header h2 { color: #111827; font-size: 2.0rem; font-weight: 800; margin: 0; }
    .hr-header p { color: #6b7280; font-size: 1.125rem; margin-top: 8px; }
    
    .category-section { margin-bottom: 48px; }
    .category-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
    .category-title { color: #1e3a8a; font-size: 0.875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; white-space: nowrap; }
    .category-line { height: 1px; background: #d1d5db; flex: 1; }
    .category-count { color: #9ca3af; font-size: 0.75rem; font-weight: 600; }

    .document-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
    
    .doc-card { 
      background: white; border: 1px solid #e5e7eb; border-radius: 0px; padding: 20px;
      display: flex; align-items: flex-start; gap: 16px; text-decoration: none !important;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .doc-card:hover { border-color: #3b82f6; box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.1); transform: translateY(-2px); }

    .doc-icon {
      width: 40px; height: 40px; border-radius: 6px; display: flex; align-items: center; 
      justify-content: center; font-weight: 800; font-size: 10px; flex-shrink: 0;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05); border: 1px solid transparent;
    }
    .pdf { background: #fee2e2; color: #b91c1c; border-color: #fecaca; }
    .docx { background: #dbeafe; color: #1d4ed8; border-color: #bfdbfe; }
    .generic { background: #f3f4f6; color: #374151; border-color: #e5e7eb; }

    .doc-info { flex: 1; min-width: 0; }
    .doc-name { color: #111827; font-weight: 600; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; transition: color 0.2s; }
    .doc-card:hover .doc-name { color: #2563eb; }
    .doc-meta { display: flex; align-items: center; gap: 8px; color: #6b7280; font-size: 11px; font-weight: 500; text-transform: uppercase; }
    
    .download-indicator { 
      align-self: center; padding: 8px; border-radius: 50%; background: #f9fafb; color: #9ca3af; 
      transition: all 0.2s; 
    }
    .doc-card:hover .download-indicator { background: #eff6ff; color: #3b82f6; }
  `;

  if (loading) return <div style={{padding: '100px', textAlign: 'center', color: '#6b7280'}}>Loading HR resources...</div>;

  return (
    <div className="hr-container">
      <style>{HrStyles}</style>
      
      <header className="hr-header">
        <h2>HR Forms & Documents</h2>
        <p>Ministry of Infrastructure Resources for Employees.</p>
      </header>

      {error ? (
        <div style={{padding: '16px', backgroundColor: '#fef2f2', borderLeft: '4px solid #ef4444', color: '#991b1b', borderRadius: '0 4px 4px 0'}}>
          {error}
        </div>
      ) : (
        sections.map((section) => (
          <div key={section.title} className="category-section">
            <div className="category-header">
              <h2 className="category-title">{section.title}</h2>
              <div className="category-line"></div>
              <span className="category-count">{section.files.length} Docs</span>
            </div>

            <div className="document-grid">
              {section.files.map((file) => (
                <a
                  key={file.file_url}
                  href={file.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="doc-card"
                >
                  {getIcon(file.file_name)}
                  
                  <div className="doc-info">
                    <p className="doc-name" title={file.file_name}>
                      {file.file_name.replace(/\.[^/.]+$/, "").replace(/_/g, " ")}
                    </p>
                    <div className="doc-meta">
                      <span style={{background: '#f3f4f6', padding: '1px 6px', borderRadius: '4px'}}>{file.ext}</span>
                      <span>•</span>
                      <span>{(file.size_bytes / 1024).toFixed(0)} KB</span>
                    </div>
                  </div>

                  <div className="download-indicator">
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </div>
                </a>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}