/**
 * QmsConfigForm.jsx
 *
 * Example form component using mywhy-ui
 * Shows how to create forms with validation using mywhy-ui components
 */

import * as React from "react";
import {
  Button,
  Input,
  Select,
  Switch,
  FileUploader,
  Alert,
  FormControl,
  Dialog,
} from "mywhy-ui";

export function QmsConfigForm() {
  const [formData, setFormData] = React.useState({
    serviceName: "",
    serviceType: "queue",
    maxWaitTime: 60,
    enableNotifications: true,
    counterCount: 1,
  });

  const [errors, setErrors] = React.useState({});
  const [showDialog, setShowDialog] = React.useState(false);
  const [successMessage, setSuccessMessage] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  // ── Validation ───────────────────────────────────────────────────
  const validate = () => {
    const newErrors = {};

    if (!formData.serviceName.trim()) {
      newErrors.serviceName = "Service name is required";
    }

    if (formData.maxWaitTime < 1) {
      newErrors.maxWaitTime = "Wait time must be at least 1 minute";
    }

    if (formData.counterCount < 1) {
      newErrors.counterCount = "At least 1 counter is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Handle input changes ─────────────────────────────────────────
  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // ── Handle submit ────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setLoading(true);

    try {
      const response = await frappe.call({
        method: "moi.api.qms.create_queue_service",
        args: formData,
        async: false,
      });

      if (response.message) {
        setSuccessMessage(`Queue "${formData.serviceName}" created successfully!`);
        setFormData({
          serviceName: "",
          serviceType: "queue",
          maxWaitTime: 60,
          enableNotifications: true,
          counterCount: 1,
        });
        setShowDialog(true);
      }
    } catch (e) {
      setErrors({ submit: `Error: ${e.message}` });
      console.error("Submit failed:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="moi-header">Create Queue Service</h1>
      <p className="text-gray-600 mb-6">
        Configure a new service queue for your organization
      </p>

      {/* Success/Error Alerts */}
      {errors.submit && (
        <Alert theme="danger" title="Error" isDismissible className="mb-4">
          {errors.submit}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Service Name */}
        <FormControl
          label="Service Name"
          description="Name of the queue service (e.g., 'License Renewal', 'Passport')"
          error={errors.serviceName}
          required
        >
          <Input
            placeholder="Enter service name"
            value={formData.serviceName}
            onChange={(e) => handleChange("serviceName", e.target.value)}
            disabled={loading}
          />
        </FormControl>

        {/* Service Type */}
        <FormControl
          label="Service Type"
          description="Category of service"
        >
          <Select
            value={formData.serviceType}
            onChange={(e) => handleChange("serviceType", e.target.value)}
            disabled={loading}
          >
            <option value="queue">Standard Queue</option>
            <option value="appointment">Appointment-based</option>
            <option value="walk-in">Walk-in</option>
          </Select>
        </FormControl>

        {/* Max Wait Time */}
        <FormControl
          label="Max Wait Time (minutes)"
          error={errors.maxWaitTime}
          helperText="Alert if customer waits longer than this"
        >
          <Input
            type="number"
            min="1"
            value={formData.maxWaitTime}
            onChange={(e) => handleChange("maxWaitTime", parseInt(e.target.value))}
            disabled={loading}
          />
        </FormControl>

        {/* Counter Count */}
        <FormControl
          label="Number of Counters"
          error={errors.counterCount}
          required
        >
          <Input
            type="number"
            min="1"
            max="20"
            value={formData.counterCount}
            onChange={(e) => handleChange("counterCount", parseInt(e.target.value))}
            disabled={loading}
          />
        </FormControl>

        {/* Notifications */}
        <FormControl label="Notifications">
          <Switch
            label="Enable SMS/Email Notifications"
            description="Send updates when tickets are called"
            checked={formData.enableNotifications}
            onChange={(e) => handleChange("enableNotifications", e.target.checked)}
            disabled={loading}
          />
        </FormControl>

        {/* Configuration File */}
        <FormControl
          label="Configuration File (Optional)"
          description="Upload a YAML file with advanced settings"
        >
          <FileUploader
            accept=".yaml,.yml,.json"
            hint="YAML or JSON files up to 5MB"
            onFilesChange={(files) => console.log("Files:", files)}
            disabled={loading}
          />
        </FormControl>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            variant="solid"
            theme="brand"
            disabled={loading}
            className="flex-1"
          >
            {loading ? "Creating..." : "Create Service"}
          </Button>
          <Button
            type="button"
            variant="outline"
            theme="gray"
            onClick={() => {
              setFormData({
                serviceName: "",
                serviceType: "queue",
                maxWaitTime: 60,
                enableNotifications: true,
                counterCount: 1,
              });
              setErrors({});
            }}
            disabled={loading}
          >
            Reset
          </Button>
        </div>
      </form>

      {/* Success Dialog */}
      <Dialog
        isOpen={showDialog}
        onOpenChange={setShowDialog}
        title="Success!"
        description={successMessage}
      >
        <div className="mt-4">
          <Button
            variant="solid"
            theme="success"
            onClick={() => setShowDialog(false)}
            className="w-full"
          >
            Done
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
