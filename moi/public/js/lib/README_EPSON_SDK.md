# EPSON ePOS SDK for JavaScript

## Setup Instructions

The EPSON ePOS SDK for JavaScript v2.27.0 needs to be downloaded and placed in this directory.

### Steps:

1. **Download the SDK**
   - Visit: https://www.epson.com/cgi-bin/Store/pl/s_ePOS_SDK.html
   - Look for "ePOS SDK for JavaScript"
   - Download version 2.27.0 (or latest compatible version)

2. **Extract the SDK**
   - Unzip the downloaded file
   - Locate the file: `epos-2.27.0.js` (or similar versioned filename)

3. **Place the file**
   - Copy `epos-2.27.0.js` to this directory (`public/js/lib/`)
   - The final path should be: `public/js/lib/epos-2.27.0.js`

4. **Build the app**
   ```bash
   cd /home/sione/moi-bench
   bench build --app moi
   ```

5. **Verify**
   - The SDK will be served at: `/assets/moi/js/lib/epos-2.27.0.js`
   - Open QMS Terminal → go to Printer Settings → enter printer IP and test connection

## Printer Configuration

The QMS Terminal expects:
- **Printer IP**: Network address of the EPSON ePOS printer (e.g., `192.168.1.100`)
- **Port**: Default is `8008` (HTTP) or `8043` (HTTPS)
- **Device ID**: Printer identifier (default: `local_printer`)

For USB printers connected to Android tablets:
- The tablet needs an EPSON app or USB bridge to expose the printer on the network
- Most EPSON thermal printers support WebSocket/HTTP bridge services

## Fallback Printing

If EPSON SDK is not available or printer cannot be reached:
1. System tries local HTTP service at `http://localhost:9100/print`
2. Falls back to browser popup print

## References

- EPSON ePOS SDK Documentation: https://www.epson.com/cgi-bin/Store/pl/s_ePOS_SDK.html
- ePOS SDK API Reference: Available in SDK package
