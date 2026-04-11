/**
 * useMinistryBranding() — React hook for fetching Ministry logo and name
 * Used across all QMS pages for consistent branding
 */

import React from 'react'

export function useMinistryBranding() {
	const [logo, setLogo] = React.useState(null)
	const [name, setName] = React.useState('Ministry of Infrastructure')
	const [loading, setLoading] = React.useState(true)

	React.useEffect(() => {
		frappe.db
			.get_value('Website Settings', 'Website Settings', ['app_logo', 'app_name'])
			.then((r) => {
				if (r.message?.app_logo) {
					setLogo(r.message.app_logo)
				}
				if (r.message?.app_name) {
					setName(r.message.app_name)
				}
				setLoading(false)
			})
			.catch(() => {
				// Use defaults if not found
				console.log('[useMinistryBranding] Using default Ministry name')
				setLoading(false)
			})
	}, [])

	return { logo, name, loading }
}
