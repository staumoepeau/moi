/**
 * useEposPrinter() — React hook for EPSON ePOS SDK management
 * Handles SDK loading, printer connection, and ticket printing
 * Uses the correct EPSON ePOS SDK 2.27.0 callback-based API
 */

import React from 'react'

// Port constants: SDK auto-selects http vs https based on port
const DEFAULT_PORT_HTTP = 8008  // ePOS over HTTP
const DEFAULT_PORT_HTTPS = 8043 // ePOS over TLS

export function useEposPrinter(config) {
	// config = { ip, port, deviceId } from localStorage
	const [status, setStatus] = React.useState('idle') // 'idle' | 'connecting' | 'ready' | 'error'
	const [error, setError] = React.useState(null)
	const [sdkReady, setSdkReady] = React.useState(false)

	const printerRef = React.useRef(null) // { device, ePosDev }
	const pendingPrintRef = React.useRef(null)

	// Load EPSON SDK script lazily
	const loadSdk = React.useCallback(() => {
		return new Promise((resolve, reject) => {
			if (window.epson?.ePOSDevice) {
				setSdkReady(true)
				resolve(window.epson.ePOSDevice)
				return
			}

			const script = document.createElement('script')
			script.src = '/assets/moi/js/lib/epos-2.27.0.js'
			script.async = true

			script.onload = () => {
				// Wait for window.epson to be available
				const checkEpos = setInterval(() => {
					if (window.epson?.ePOSDevice) {
						clearInterval(checkEpos)
						setSdkReady(true)
						resolve(window.epson.ePOSDevice)
					}
				}, 50)
				setTimeout(() => clearInterval(checkEpos), 5000) // 5s timeout
			}

			script.onerror = () => {
				setSdkReady(false)
				reject(new Error('Failed to load EPSON ePOS SDK'))
			}

			document.head.appendChild(script)
		})
	}, [])

	// Connect to printer using the correct EPSON ePOS SDK callback-based API
	const connect = React.useCallback(
		async (ip, port, deviceId) => {
			if (!ip || !port) {
				setStatus('idle')
				printerRef.current = null
				return
			}

			// Detect page protocol and auto-select port if not explicitly set
			const isSecurePage = window.location.protocol === 'https:'
			const effectivePort = parseInt(port, 10) || (isSecurePage ? DEFAULT_PORT_HTTPS : DEFAULT_PORT_HTTP)

			// Guard: HTTPS page + HTTP printer port = iOS mixed-content block
			if (isSecurePage && effectivePort === DEFAULT_PORT_HTTP) {
				setStatus('error')
				setError(
					`Mixed-content blocked: page is HTTPS but printer port is ${DEFAULT_PORT_HTTP}. ` +
					`Change printer port to ${DEFAULT_PORT_HTTPS} and enable HTTPS on the printer.`
				)
				console.error('[useEposPrinter] Mixed-content: cannot use port 8008 on HTTPS page')
				return
			}

			try {
				setStatus('connecting')
				setError(null)

				// Load the SDK
				await loadSdk()

				// Step 1: Create the ePOS device manager (no constructor args)
				const ePosDev = new window.epson.ePOSDevice()

				// Step 2: Connect to the printer — SDK auto-selects http vs https based on port
				ePosDev.connect(ip, effectivePort, (connectResult) => {
					if (connectResult !== 'OK' && connectResult !== 'SSL_CONNECT_OK') {
						setStatus('error')
						setError(`Printer connection failed: ${connectResult}`)
						console.error('[useEposPrinter] Connect failed:', connectResult)
						return
					}

					// Step 3: Open the printer device
					const resolvedDeviceId = deviceId || 'local_printer'
					ePosDev.createDevice(
						resolvedDeviceId,
						ePosDev.DEVICE_TYPE_PRINTER,
						{ crypto: isSecurePage, buffer: false },
						(device, createCode) => {
							if (createCode !== 'OK') {
								setStatus('error')
								setError(`Printer device open failed: ${createCode}`)
								console.error('[useEposPrinter] createDevice failed:', createCode)
								return
							}

							// Attach disconnect handler
							ePosDev.ondisconnect = () => {
								printerRef.current = null
								setStatus('idle')
								console.log('[useEposPrinter] Disconnected from printer')
							}

							// Store both the printer device and the connection manager
							printerRef.current = { device, ePosDev }
							setStatus('ready')
							setError(null)
							console.log('[useEposPrinter] Connected to printer:', ip, effectivePort)

							// Flush any queued print
							if (pendingPrintRef.current) {
								const pending = pendingPrintRef.current
								pendingPrintRef.current = null
								executePrint(pending)
							}
						}
					)
				})
			} catch (err) {
				setStatus('error')
				setError(err.message)
				console.error('[useEposPrinter] Connection error:', err)
			}
		},
		[loadSdk]
	)

	// Print ticket using the Printer object's callback methods (silent print - no dialog)
	const executePrint = (ticketData) => {
		if (!printerRef.current?.device) {
			console.warn('[useEposPrinter] Printer not connected')
			return Promise.reject(new Error('Printer not connected'))
		}

		return new Promise((resolve, reject) => {
			try {
				const printer = printerRef.current.device // The Printer object from createDevice

				// Build receipt matching the MOI QMS ticket format
				// Header: Ministry branding
				printer.addTextAlign(printer.ALIGN_CENTER)
				printer.addText('\n')
				printer.addText('MINISTRY OF INFRASTRUCTURE\n')
				printer.addText('\n')

				// Service and timestamp
				printer.addTextSize(1, 1)
				printer.addText(`${ticketData.service}\n`)
				printer.addText(`\n`)
				printer.addText(`${ticketData.time}\n`)
				printer.addText(`\n`)

				// Main ticket number heading
				printer.addTextSize(3, 3)
				printer.addText(`Ticket #${ticketData.displayNumber}\n`)
				printer.addTextSize(1, 1)
				printer.addText(`\n`)

				// Full ticket number (for reference)
				printer.addText(`${ticketData.fullNumber}\n`)
				printer.addText(`\n`)

				// Barcode (Code39) — silent printing means no user interaction needed
				printer.addBarcode(
					ticketData.fullNumber,
					printer.BARCODE_CODE39,
					printer.HRI_BELOW,
					printer.FONT_A,
					40,
					100
				)

				// Footer instructions
				printer.addText(`\n`)
				printer.addTextAlign(printer.ALIGN_CENTER)
				printer.addTextSize(1, 1)
				printer.addText(`Present this ticket at the counter\n`)
				printer.addText(`when called.\n`)
				printer.addText(`Thank you for your patience.\n`)
				printer.addText(`\n`)

				// Cut the paper
				printer.addCut(printer.CUT_FEED)

				// Attach result handlers BEFORE calling send()
				printer.onreceive = (res) => {
					if (res.success) {
						console.log('[useEposPrinter] Print succeeded (silent)')
						resolve('epson_ok')
					} else {
						console.error('[useEposPrinter] Print failed, code:', res.code)
						reject(new Error(`Print failed: ${res.code}`))
					}
				}

				printer.onerror = (err) => {
					console.error('[useEposPrinter] Print error event:', err)
					reject(new Error(`Printer error: ${JSON.stringify(err)}`))
				}

				// Send to printer — prints silently without any dialog
				printer.send()
			} catch (err) {
				console.error('[useEposPrinter] Print error:', err)
				reject(err)
			}
		})
	}

	const printTicket = (ticketData) => {
		if (!printerRef.current) {
			// Queue for later if SDK is still loading
			if (sdkReady) {
				return executePrint(ticketData)
			} else {
				pendingPrintRef.current = ticketData
				return Promise.reject(new Error('Printer not ready, print queued'))
			}
		}
		return executePrint(ticketData)
	}

	// Test connection
	const testConnection = React.useCallback(async () => {
		if (status === 'ready') return true
		if (!config.ip || !config.port) return false
		try {
			// Call connect and wait for status change
			await new Promise((resolve) => {
				const checkStatus = setTimeout(() => {
					// After 5 seconds, assume connection attempt was made
					clearInterval(statusCheckInterval)
					resolve()
				}, 5000)

				// Also resolve immediately on status change to ready/error
				const statusCheckInterval = setInterval(() => {
					if (status === 'ready' || status === 'error') {
						clearTimeout(checkStatus)
						clearInterval(statusCheckInterval)
						resolve()
					}
				}, 100)

				connect(config.ip, config.port, config.deviceId || 'local_printer')
			})
			return status === 'ready'
		} catch {
			return false
		}
	}, [status, config, connect])

	// Reconnect when config changes
	React.useEffect(() => {
		if (config?.ip && config?.port) {
			connect(config.ip, config.port, config.deviceId || 'local_printer')
		} else {
			printerRef.current = null
			setStatus('idle')
		}
	}, [config?.ip, config?.port, config?.deviceId, connect])

	// Cleanup
	React.useEffect(() => {
		return () => {
			try {
				printerRef.current?.ePosDev?.disconnect()
			} catch (e) {
				console.warn('[useEposPrinter] Disconnect warning:', e)
			}
		}
	}, [])

	return {
		status,
		error,
		sdkReady,
		printTicket,
		testConnection,
	}
}
