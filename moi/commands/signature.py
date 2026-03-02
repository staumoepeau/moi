import frappe
import os

# Final Ministry Template with Disclaimer
HTML_TEMPLATE = """
<table style="width: 500px; font-size: 12px; font-family: Arial,sans-serif; line-height:normal; background: transparent !important;" cellpadding="0" cellspacing="0">
<tbody>
 <tr> 
  <td style="width:92px; vertical-align:top;" valign="top">
   <a href="https://moi.gov.to/" target="_blank"><img border="0" alt="Logo" height="91" width="92" style="width:92px; height:91px; border:0;" src="https://moi.gov.to/files/logo.png"></a>
  </td>

  <td style="width:44px; text-align:center; vertical-align:top;" valign="top">
   <img border="0" alt="Line" width="11" style="width:11px; height:85px; border:0;" src="https://imgmsgen.com/img//minimalist-with-large-logo/line.png">
  </td>
  <td style="width:364px; vertical-align:top;" valign="top">
    <span style="font-size:13px; font-family: Arial, sans-serif; color:#675036; line-height: 20px; font-weight: bold;">{name}<br></span>
    
    <span style="font-size:13px; font-family: Arial,sans-serif; line-height: 18px; font-weight: bold; color:#675036;">
        {designation}<br>
    </span>
    <span style="font-size:12px; font-family: Arial,sans-serif; line-height: 16px; color:#675036;">
        {department}<br>
        <strong>Ministry of Infrastructure</strong><br>
    </span>
        
    <span style="font-size:12px; font-family: Arial, sans-serif; color:#3c3c3b; padding-top: 5px; display: block;">
        <span style="font-weight:bold;">T: </span>+676 7401500 |
        <span style="font-weight:bold;">M: </span>{mobile}<br>
    </span>
    
    <span style="font-size:12px; font-family: Arial, sans-serif; color:#3c3c3b;">
        <span style="font-weight:bold;">E: </span><a href="mailto:{email}" style="color:#3c3c3b; text-decoration: none;">{email}</a> | 
        <span style="font-weight:bold;">W: </span><a href="https://moi.gov.to" target="_blank" style="text-decoration: none; color:#3c3c3b;">https://moi.gov.to</a>
    </span>
  </td>
 </tr>
 <tr>
  <td colspan="3" style="padding-top: 15px; font-size: 10px; color: #999999; font-family: Arial, sans-serif; line-height: 12px;">
    <strong>Disclaimer:</strong> This message and any attachments are confidential and intended solely for the addressee. If you have received this message in error, please notify the sender and delete it immediately.
  </td>
 </tr>
</tbody>
</table>
"""

def generate_postfix_files():
    # Initialize Frappe for the MOI site
    frappe.init(site="moi.gov.to")
    frappe.connect()
    
    output_dir = "/etc/postfix/disclaimer"
    
    if not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    employees = frappe.get_all("Employee", 
        fields=["employee_name", "designation", "cell_number", "user_id", "department"],
        filters={"status": "Active"})

    for emp in employees:
        email = emp.get("user_id")
        if not email:
            continue

        formatted_html = HTML_TEMPLATE.format(
            name=emp.employee_name,
            designation=emp.designation or "Staff",
            department=emp.department or "General Administration",
            mobile=emp.cell_number or "+676 0000000",
            email=email
        )

        file_path = os.path.join(output_dir, f"{email}.html")
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(formatted_html)
            
    print(f"Successfully generated {len(employees)} signatures with disclaimers in {output_dir}")

if __name__ == "__main__":
    generate_postfix_files()
