import frappe
import os
import shutil
from frappe import _
import base64  # Add this import

# Root path for your MOI HR files
BASE_PATH = frappe.get_site_path("public", "files", "media", "forms")

@frappe.whitelist()
def list_hr_forms():
    """Scans the physical Linux directories and returns file metadata."""
    if not os.path.exists(BASE_PATH):
        return []

    sections = []
    # Get subfolders (categories like HR, GENERAL)
    categories = [d for d in os.listdir(BASE_PATH) if os.path.isdir(os.path.join(BASE_PATH, d))]
    
    for cat in categories:
        cat_path = os.path.join(BASE_PATH, cat)
        file_list = []
        
        for filename in os.listdir(cat_path):
            full_path = os.path.join(cat_path, filename)
            if os.path.isfile(full_path):
                stats = os.stat(full_path)
                file_list.append({
                    "file_name": filename,
                    "file_url": f"/files/media/forms/{cat}/{filename}",
                    "size_bytes": stats.st_size,
                    "ext": filename.split('.')[-1].upper() # File Type
                })
        
        sections.append({
            "title": cat,
            "files": file_list
        })
    
    return sections



@frappe.whitelist()
def upload_hr_file(file_content, filename, category):
    # Root path for your MOI HR files
    BASE_PATH = frappe.get_site_path("public", "files", "media", "forms")
    
    # Ensure category folder exists
    target_dir = os.path.join(BASE_PATH, category.strip().upper())
    if not os.path.exists(target_dir):
        os.makedirs(target_dir, mode=0o755)

    target_path = os.path.join(target_dir, filename)
    
    # CONVERT Base64 String to Bytes
    try:
        binary_data = base64.b64decode(file_content)
        
        # Write bytes to disk
        with open(target_path, "wb") as f:
            f.write(binary_data)
            
        return {"status": "success", "file_url": f"/files/media/forms/{category}/{filename}"}
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "MOI Upload Error")
        return {"status": "error", "message": str(e)}


@frappe.whitelist()
def organize_hr_file(file_name, file_url, category):
    # 1. Standardize the folder name (e.g., "GENERAL")
    folder_name = category.strip().upper()
    
    # 2. Setup Paths
    # Source is usually /files/filename.ext
    source_rel_path = file_url.lstrip('/')
    source_full_path = frappe.get_site_path("public", source_rel_path)
    
    # Destination is /files/media/forms/CATEGORY/filename.ext
    dest_dir_rel = os.path.join("files", "media", "forms", folder_name)
    dest_dir_full = frappe.get_site_path("public", dest_dir_rel)
    dest_file_full = os.path.join(dest_dir_full, file_name)
    
    # 3. Create folder if missing
    if not os.path.exists(dest_dir_full):
        os.makedirs(dest_dir_full, mode=0o755)

    # 4. Move and Update DB
    if os.path.exists(source_full_path):
        shutil.move(source_full_path, dest_file_full)
        
        new_url = f"/files/media/forms/{folder_name}/{file_name}"
        
        # Update the 'MOI HR File' record with the new URL
        frappe.db.set_value("MOI HR File", {"file_url": file_url}, "file_url", new_url)
        frappe.db.commit()
        
        return {"new_url": new_url}
    
    frappe.throw(f"Could not find source file at {source_full_path}")



@frappe.whitelist()
def get_hr_folder_options():
    """
    Returns a list of subfolders in public/files/media/forms/
    to be used as options in the Select field.
    """
    base_path = frappe.get_site_path("public", "files", "media", "forms")
    
    # Create the base path if it doesn't exist yet
    if not os.path.exists(base_path):
        os.makedirs(base_path, mode=0o755)
        return ['GENERAL'] # Return a default if empty

    # Get all entries in the directory that are folders and don't start with '.'
    folders = [
        f for f in os.listdir(base_path) 
        if os.path.isdir(os.path.join(base_path, f)) and not f.startswith('.')
    ]
    
    # Sort alphabetically for a professional look
    return sorted(folders) if folders else ['GENERAL']