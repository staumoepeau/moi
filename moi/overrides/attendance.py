from hrms.hr.doctype.attendance.attendance import Attendance as ERPNextAttendance
from erpnext.controllers.status_updater import validate_status
from hrms.hr.doctype.attendance.attendance import validate_active_employee

class CustomAttendance(ERPNextAttendance):
    def validate(self):
        # Add your new statuses here
        allowed_status = [
            "Present",
            "Absent",
            "On Leave",
            "Half Day",
            "Work From Home",
            "Work Travel Overseas",
            "Work Travel Local"
        ]
        validate_status(self.status, allowed_status)

        validate_active_employee(self.employee)
        self.validate_attendance_date()
        self.validate_duplicate_record()
        self.validate_overlapping_shift_attendance()
        self.validate_employee_status()
        self.check_leave_record()
