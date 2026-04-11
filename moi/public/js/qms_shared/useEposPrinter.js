/**
 * useEposPrinter() — React hook for EPSON ePOS SDK management
 * Handles SDK loading, printer connection, and ticket printing
 */

import React from 'react'

export function useEposPrinter(config) {
	// config = { ip, port, deviceId } from localStorage
	const [status, setStatus] = React.useState('idle') // 'idle' | 'connecting' | 'ready' | 'error'
	const [error, setError] = React.useState(null)
	const [sdkReady, setSdkReady] = React.useState(false)

	const printerRef = React.useRef(null)
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

	// Connect to printer
	const connect = React.useCallback(
		async (ip, port, deviceId) => {
			if (!ip || !port) {
				setStatus('idle')
				printerRef.current = null
				return
			}

			try {
				setStatus('connecting')
				setError(null)

				const ePOSDevice = await loadSdk()

				const ePosDev = new ePOSDevice(
					`http://${ip}:${port}/`,
					parseInt(port),
					ePOSDevice.TYPE_PRINTER,
					deviceId,
					null
				)

				ePosDev.addEventListener(
					ePOSDevice.EVENT_CONNECT,
					() => {
						printerRef.current = ePosDev
						setStatus('ready')
						setError(null)
						console.log('[useEposPrinter] Connected to printer:', ip)

						// Execute any pending print
						if (pendingPrintRef.current) {
							const pending = pendingPrintRef.current
							pendingPrintRef.current = null
							executePrint(pending)
						}
					},
					false
				)

				ePosDev.addEventListener(
					ePOSDevice.EVENT_DISCONNECT,
					() => {
						printerRef.current = null
						setStatus('idle')
						console.log('[useEposPrinter] Disconnected from printer')
					},
					false
				)

				ePosDev.addEventListener(
					ePOSDevice.EVENT_RECONNECT,
					() => {
						setStatus('ready')
						console.log('[useEposPrinter] Reconnected to printer')
					},
					false
				)

				ePosDev.addEventListener(
					ePOSDevice.EVENT_TIMEOUT,
					() => {
						setStatus('error')
						setError('Connection timeout')
						console.error('[useEposPrinter] Connection timeout')
					},
					false
				)

				ePosDev.connect()
			} catch (err) {
				setStatus('error')
				setError(err.message)
				console.error('[useEposPrinter] Connection error:', err)
			}
		},
		[loadSdk]
	)

	// Print ticket
	const executePrint = (ticketData) => {
		if (!printerRef.current) {
			console.warn('[useEposPrinter] Printer not connected')
			return Promise.reject(new Error('Printer not connected'))
		}

		return new Promise((resolve, reject) => {
			try {
				const printer = printerRef.current
				const ePOSPrinter = new window.epson.ePOSPrinter()

				// Build receipt
				ePOSPrinter.addTextAlign(ePOSPrinter.ALIGN_CENTER)
				ePOSPrinter.addText('MOI QMS\n')
				ePOSPrinter.addTextSize(2, 2)
				ePOSPrinter.addText(`${ticketData.displayNumber}\n`)
				ePOSPrinter.addTextSize(1, 1)
				ePOSPrinter.addText(`${ticketData.service}\n`)
				ePOSPrinter.addText(`${ticketData.time}\n`)

				// Barcode (Code39)
				ePOSPrinter.addBarcode(
					ticketData.fullNumber,
					ePOSPrinter.BARCODE_CODE39,
					ePOSPrinter.HRI_BELOW,
					ePOSPrinter.FONT_A,
					40,
					100
				)

				ePOSPrinter.addCut(ePOSPrinter.CUT_FEED)

				// Send to printer
				printer.addListener(
					window.epson.ePOSDevice.EVENT_PRINT_SUCCESS,
					() => {
						console.log('[useEposPrinter] Print succeeded')
						resolve('epson_ok')
					},
					false
				)

				printer.addListener(
					window.epson.ePOSDevice.EVENT_PRINT_FAILURE,
					(code) => {
						console.error('[useEposPrinter] Print failed:', code)
						reject(new Error(`Print failed: ${code}`))
					},
					false
				)

				printer.sendMessage(ePOSPrinter)
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
			await connect(config.ip, config.port, config.deviceId || 'local_printer')
			return true
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
			if (printerRef.current?.disconnect) {
				try {
					printerRef.current.disconnect()
				} catch (e) {
					console.warn('[useEposPrinter] Disconnect warning:', e)
				}
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
