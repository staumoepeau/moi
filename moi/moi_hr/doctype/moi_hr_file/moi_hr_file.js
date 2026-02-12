// Copyright (c) 2026, Frappe Technologies and contributors
// For license information, please see license.txt

frappe.ui.form.on("MOI HR File", {
    refresh: function (frm) {
        // Standard View Button
        if (frm.doc.file_url) {
            frm.add_custom_button(__("View File"), () => {
                let url = frappe.utils.is_url(frm.doc.file_url) ? 
                          frm.doc.file_url : window.location.origin + frm.doc.file_url;
                window.open(url);
            });
        }

        // Standard Download Button
        if (!frm.doc.is_folder && frm.doc.file_url) {
            frm.add_custom_button(__("Download"), () => frm.trigger("download"), "fa fa-download");
        }

        // Manual button to organize or change folder
        if (frm.doc.file_url) {
            frm.add_custom_button(__("Move to Folder"), () => {
                frm.trigger("move_to_hr_category");
            }, __("Action"));
        }

        frm.toggle_display("preview", false);
        frm.trigger("preview_file");
    },

    onload: function(frm) {
        // Automatically prompt upload for new records
        if (frm.is_new()) {
            frm.trigger("prompt_upload");
        }
    },
    
    prompt_upload: function (frm) {
        new frappe.ui.FileUploader({
            doctype: frm.doctype,
            docname: frm.docname,
            restrictions: {
                allowed_file_types: [".pdf", ".doc", ".docx", ".jpg", ".png"]
            },
            on_success: (file_doc) => {
                // 1. Update the form values with the initial upload data
                frm.set_value("file_url", file_doc.file_url);
                frm.set_value("file_name", file_doc.file_name);
                frm.set_value("file_type", file_doc.file_type);
                
                // 2. Immediately prompt the user to choose or create a folder
                frappe.show_alert({
                    message: __("File uploaded. Now select a folder."),
                    indicator: "blue"
                });
                frm.trigger("move_to_hr_category");
            }
        });
    },

move_to_hr_category: function(frm) {
        // 1. Fetch the dynamic folder list from the server
        frappe.call({
            method: "moi.api.hr.get_hr_folder_options",
            callback: function(r) {
                let folder_options = r.message || ['GENERAL'];

                // 2. Show the prompt with the real-time folder list
                frappe.prompt([
                    {
                        label: 'Select Destination Folder',
                        fieldname: 'category',
                        fieldtype: 'Select',
                        options: folder_options,
                        reqd: 1
                    },
                    {
                        label: 'Or Create New Folder',
                        fieldname: 'new_folder',
                        fieldtype: 'Data',
                        description: 'Leave blank to use selection above'
                    }
                ], (values) => {
                    // Use the new folder name if provided, otherwise the selection
                    let final_category = values.new_folder ? values.new_folder.toUpperCase() : values.category;

                    frappe.call({
                        method: "moi.api.hr.organize_hr_file",
                        args: {
                            file_name: frm.doc.file_name,
                            file_url: frm.doc.file_url,
                            category: final_category
                        },
                        callback: function(res) {
                            if (res.message && res.message.new_url) {
                                frm.set_value("file_url", res.message.new_url);
                                frappe.show_alert({
                                    message: __("Moved to {0}", [final_category]), 
                                    indicator: 'green'
                                });
                                frm.save();
                            }
                        }
                    });
                }, __('Folder Organization'), __('Move & Save'));
            }
        });
    },
    
    preview_file: function (frm) {
        let $preview = "";
        let file_extension = frm.doc.file_type ? frm.doc.file_type.toLowerCase() : "";

        if (frm.doc.file_url && frappe.utils.is_image_file(frm.doc.file_url)) {
            $preview = $(`<div class="img_preview">
                <img class="img-responsive" style="max-width: 500px" src="${frappe.utils.escape_html(frm.doc.file_url)}"/>
            </div>`);
        } else if (file_extension === "pdf") {
            $preview = $(`<div class="img_preview">
                <embed width="100%" height="600px" src="${frappe.utils.escape_html(frm.doc.file_url)}" type="application/pdf">
            </div>`);
        }

        if ($preview) {
            frm.toggle_display("preview", true);
            frm.get_field("preview_html").$wrapper.html($preview);
        }
    },

    download: function (frm) {
        let file_url = frm.doc.file_url;
        if (file_url) {
            var link = document.createElement("a");
            link.href = file_url.replace(/#/g, "%23");
            link.download = frm.doc.file_name;
            link.click();
        }
    }
});