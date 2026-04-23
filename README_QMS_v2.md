# QMS v2.0 — Pre-Service Questions & Dynamic Counter Routing

## Overview

This release adds two critical features to the MOI QMS:
1. **Pre-Service Questions**: Customers answer questions before selecting a service
2. **Dynamic Counter Routing**: Admins configure which counters serve which customer combinations

## Changes Summary

| Component | File | Changes |
|-----------|------|---------|
| **Backend API** | `moi/api/qms.py` | Updated `create_ticket()` and `call_next_ticket()` with new parameters |
| **Counter Config** | `moi/moi_qms/doctype/qms_counter/qms_counter.json` | Added 4 check fields for capabilities |
| **Ticket Schema** | `moi/moi_qms/doctype/qms_ticket/qms_ticket.json` | Added customer_type and payment_method fields |
| **Terminal UI** | `moi/public/js/qms_terminal/QmsTerminal.jsx` | New customer_type and payment_type views |
| **Display Screen** | `moi/public/js/qms_display/QmsDisplay.jsx` | Added marked-for-recall customer list |
| **PWA Cache** | `moi/public/js/qms_terminal/service-worker.js` | Bumped cache version to v2-preservice |

## New Terminal Flow

```
Welcome Screen (Customer Type)
    ├─ Individual (blue)
    └─ Business (amber) — "Government Ministry"
            ↓
Payment Method Screen
    ├─ Cash (green)
    └─ Cheque (purple)
        ↓
Service Selection (unchanged)
    ├─ Service 1
    ├─ Service 2
    └─ Service N
        ↓
Pre-Service Checklist (if configured)
    ↓
Ticket Preview & Print
    ↓
Feedback/Home
```

## Admin Configuration

### To Restrict a Counter

1. Open **QMS Counter** → select counter (e.g., "05")
2. Scroll to **Counter Capabilities** section
3. Uncheck boxes to restrict:
   - ☑ Serve Individual Customers
   - ☑ Serve Business Customers
   - ☑ Accept Cash Payment
   - ☑ Accept Cheque Payment

**Example**: Counter 05 = Business + Cheque only
```
✓ Serve Individual Customers    → UNCHECK
✓ Serve Business Customers      → CHECK (leave checked)
✓ Accept Cash Payment           → UNCHECK
✓ Accept Cheque Payment         → CHECK (leave checked)
```

When officer at Counter 05 clicks "Call Next":
- Only pulls Business+Cheque tickets
- Ignores Individual or Cash-payment tickets

## Backward Compatibility

- **Old Tickets**: Have NULL for customer_type/payment_method
- **Unrestricted Counters** (all 4 checks ✓): Pick up both old and new tickets
- **Restricted Counters**: Skip old tickets (intentional during transition)
- **API**: `create_ticket()` still works without customer_type/payment_method

## Database Migrations

```sql
ALTER TABLE `tabQMS Counter` ADD COLUMN `accept_individual` TINYINT(4) DEFAULT 1;
ALTER TABLE `tabQMS Counter` ADD COLUMN `accept_business` TINYINT(4) DEFAULT 1;
ALTER TABLE `tabQMS Counter` ADD COLUMN `accept_cash` TINYINT(4) DEFAULT 1;
ALTER TABLE `tabQMS Counter` ADD COLUMN `accept_cheque` TINYINT(4) DEFAULT 1;

ALTER TABLE `tabQMS Ticket` ADD COLUMN `customer_type` VARCHAR(140);
ALTER TABLE `tabQMS Ticket` ADD COLUMN `payment_method` VARCHAR(140);
```

*Applied automatically by:* `bench --site <site-name> migrate`

## Deployment Checklist

- [ ] Backup database before deployment
- [ ] Run `bench --site <site-name> migrate`
- [ ] Run `bench build --app moi`
- [ ] Restart: `bench --site <site-name> restart`
- [ ] Test terminal: `/app/qms_terminal` → verify flow
- [ ] Test counter config: Open QMS Counter → verify "Counter Capabilities" section
- [ ] Test routing: Create test tickets with different types/methods → verify counters pull correct ones
- [ ] Test display: Check marked-for-recall list appears on `/app/qms_display`
- [ ] Test PWA: Force refresh (Cmd+Shift+R) and verify new UI loads

## Testing Scenarios

### Scenario 1: Individual + Cash
1. Terminal: Select Individual → Cash → Service A
2. Result: Ticket created with type=Individual, method=Cash
3. Counter 01 (all checked): Pulls ticket ✓
4. Counter 05 (Business+Cheque only): Doesn't pull ✗

### Scenario 2: Business + Cheque
1. Terminal: Select Business → Cheque → Service B
2. Result: Ticket created with type=Business, method=Cheque
3. Counter 01 (all checked): Pulls ticket ✓
4. Counter 05 (Business+Cheque only): Pulls ticket ✓

### Scenario 3: Back Navigation
1. Terminal: Select Individual
2. Click Back → returns to customer_type
3. Can re-select Business
4. Continue → Select Cheque → Service C
5. Result: Ticket is Business+Cheque (old selection cleared)

### Scenario 4: Marked for Recall
1. Service completion: Mark customer for recall with reason
2. Display screen: Ticket appears in marked-for-recall list
3. Console: Officer can click to recall customer
4. Display updates in real-time

## Performance Notes

- Terminal bundle: **< 1MB** (monitored by CI)
- Display queries: **Client-side** (frappe.db.get_list)
- PWA cache: **2 versions** (prevents conflicts)
- API calls: **Realtime sync** (publish_realtime events)

## Rollback Plan

If issues occur post-deployment:

1. **Revert commit**: `git revert <commit-hash>`
2. **Rebuild**: `bench build --app moi`
3. **Restart**: `bench restart`
4. **Clear cache**: `bench clear-cache`

Old tickets remain unaffected (they have NULL for new fields).
Existing counters revert to "all checked" behavior (picks up all tickets).

## Next Steps

1. **Monitor Production**: Watch for errors in browser console and server logs
2. **Gather Feedback**: Collect user feedback on new flow
3. **Phase 2**: Plan additional customer types or payment methods if needed
4. **Optimization**: Analyze performance metrics and optimize if needed

---

**Deployed**: April 23, 2026
**Commit**: a5a711e
**Status**: Ready for Testing
