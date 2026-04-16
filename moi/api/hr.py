import frappe
import os
import shutil
from frappe import _
import base64  # Add this import

# Root path for MOI documents
BASE_PATH = frappe.get_site_path("public", "files", "media", "doc")

@frappe.whitelist()
def list_hr_forms(rel_path=""):
    """List folders and files at a given relative path within BASE_PATH.

    Args:
        rel_path: Relative path from BASE_PATH (e.g., "HR/Policies")

    Returns:
        {"folders": [...], "files": [...]}
    """
    if not os.path.exists(BASE_PATH):
        return {"folders": [], "files": []}

    # Construct target path
    target = os.path.join(BASE_PATH, rel_path.strip("/")) if rel_path else BASE_PATH

    # Security: ensure target is within BASE_PATH
    target = os.path.normpath(target)
    if not target.startswith(os.path.normpath(BASE_PATH)):
        frappe.throw("Invalid path")

    if not os.path.exists(target):
        return {"folders": [], "files": []}

    folders = []
    files = []

    for entry in os.listdir(target):
        full_path = os.path.join(target, entry)

        if os.path.isdir(full_path):
            folders.append({"name": entry})
        elif os.path.isfile(full_path):
            stats = os.stat(full_path)
            # Construct file URL based on rel_path
            url_path = rel_path.strip("/") + "/" + entry if rel_path else entry
            files.append({
                "file_name": entry,
                "file_url": f"/files/media/doc/{url_path}",
                "size_bytes": stats.st_size,
                "ext": entry.split('.')[-1].upper(),
                "modified": stats.st_mtime
            })

    # Sort folders and files alphabetically
    folders = sorted(folders, key=lambda x: x["name"])
    files = sorted(files, key=lambda x: x["file_name"])

    return {"folders": folders, "files": files}



@frappe.whitelist()
def upload_hr_file(file_content, filename, category=None, rel_path=None):
    """Upload a file to the given category or rel_path.

    Args:
        file_content: Base64-encoded file content
        filename: Name of the file
        category: Legacy parameter for top-level category (e.g., "HR") - deprecated, use rel_path
        rel_path: Relative path from BASE_PATH (e.g., "HR/Policies")
    """
    # Support legacy category parameter or new rel_path
    if rel_path:
        target_rel = rel_path.strip("/")
    elif category:
        target_rel = category.strip().upper()
    else:
        frappe.throw("Either category or rel_path must be provided")

    target_dir = os.path.join(BASE_PATH, target_rel)

    # Security: ensure target is within BASE_PATH
    target_dir = os.path.normpath(target_dir)
    if not target_dir.startswith(os.path.normpath(BASE_PATH)):
        frappe.throw("Invalid path")

    if not os.path.exists(target_dir):
        os.makedirs(target_dir, mode=0o755)

    target_path = os.path.join(target_dir, filename)

    # CONVERT Base64 String to Bytes
    try:
        binary_data = base64.b64decode(file_content)

        # Write bytes to disk
        with open(target_path, "wb") as f:
            f.write(binary_data)

        return {"status": "success", "file_url": f"/files/media/doc/{target_rel}/{filename}"}
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "MOI Upload Error")
        return {"status": "error", "message": str(e)}


@frappe.whitelist()
def create_hr_folder(rel_path, folder_name):
    """Creates a new sub-folder under rel_path.

    Args:
        rel_path: Relative path from BASE_PATH (e.g., "HR/Policies")
        folder_name: Name of the new folder
    """
    if not folder_name or not folder_name.strip():
        frappe.throw("Folder name cannot be empty")

    safe_name = folder_name.strip()

    # Construct target path
    target = os.path.join(BASE_PATH, rel_path.strip("/"), safe_name) if rel_path else os.path.join(BASE_PATH, safe_name)

    # Security: ensure target is within BASE_PATH
    target = os.path.normpath(target)
    if not target.startswith(os.path.normpath(BASE_PATH)):
        frappe.throw("Invalid path")

    try:
        os.makedirs(target, mode=0o755, exist_ok=True)
        return {"status": "ok"}
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "MOI Folder Creation Error")
        frappe.throw(f"Failed to create folder: {str(e)}")


@frappe.whitelist()
def organize_hr_file(file_name, file_url, category):
    # 1. Standardize the folder name (e.g., "GENERAL")
    folder_name = category.strip().upper()
    
    # 2. Setup Paths
    # Source is usually /files/filename.ext
    source_rel_path = file_url.lstrip('/')
    source_full_path = frappe.get_site_path("public", source_rel_path)
    
    # Destination is /files/media/doc/CATEGORY/filename.ext
    dest_dir_rel = os.path.join("files", "media", "forms", folder_name)
    dest_dir_full = frappe.get_site_path("public", dest_dir_rel)
    dest_file_full = os.path.join(dest_dir_full, file_name)
    
    # 3. Create folder if missing
    if not os.path.exists(dest_dir_full):
        os.makedirs(dest_dir_full, mode=0o755)

    # 4. Move and Update DB
    if os.path.exists(source_full_path):
        shutil.move(source_full_path, dest_file_full)
        
        new_url = f"/files/media/doc/{folder_name}/{file_name}"
        
        # Update the 'MOI HR File' record with the new URL
        frappe.db.set_value("MOI HR File", {"file_url": file_url}, "file_url", new_url)
        frappe.db.commit()
        
        return {"new_url": new_url}
    
    frappe.throw(f"Could not find source file at {source_full_path}")



@frappe.whitelist()
def get_hr_folder_options():
    """
    Returns a list of subfolders in public/files/media/doc/
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