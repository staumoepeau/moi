import frappe
import os
from frappe import _

@frappe.whitelist(allow_guest=True)
def list_hr_forms():
    # Path: sites/your_site/public/files/media/forms
    base_path = frappe.get_site_path("public", "files", "media", "forms")

    if not os.path.exists(base_path) or not os.path.isdir(base_path):
        return {"error": "Base folder not found", "path": base_path}

    categories = []

    # 1. Loop through folders (Categories)
    for item in os.listdir(base_path):
        item_path = os.path.join(base_path, item)
        if not os.path.isdir(item_path) or item.startswith("."):
            continue

        category_files = []
        # 2. Loop through files in that category
        for file in os.listdir(item_path):
            if file.startswith("."): continue
            
            full_file_path = os.path.join(item_path, file)
            if not os.path.isfile(full_file_path): continue

            # Get Metadata
            try:
                mtime = os.path.getmtime(full_file_path)
                modified_str = frappe.utils.get_datetime(mtime).isoformat()
            except:
                modified_str = None

            category_files.append({
                "file_name": file,
                # Public URL for downloading
                "file_url": f"/files/media/forms/{item}/{file}",
                "size_bytes": os.path.getsize(full_file_path),
                "modified": modified_str,
                "ext": file.rsplit(".", 1)[-1].lower() if "." in file else ""
            })

        if category_files:
            categories.append({
                "title": item.replace("_", " ").upper(), # "hr_forms" -> "HR FORMS"
                "files": sorted(category_files, key=lambda x: x["file_name"])
            })

    return sorted(categories, key=lambda x: x["title"])