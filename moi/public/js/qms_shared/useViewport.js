/**
 * useViewport() — React hook for responsive design
 * Listens to window resize and screen orientation changes
 * Returns viewport dimensions and device classification
 */

import React from 'react'

export function useViewport() {
	const [vp, setVp] = React.useState(() => measure())

	React.useEffect(() => {
		let timer

		const onResize = () => {
			clearTimeout(timer)
			timer = setTimeout(() => setVp(measure()), 80) // 80ms debounce
		}

		window.addEventListener('resize', onResize)
		screen.orientation?.addEventListener?.('change', onResize) // iPad rotation

		return () => {
			window.removeEventListener('resize', onResize)
			screen.orientation?.removeEventListener?.('change', onResize)
			clearTimeout(timer)
		}
	}, [])

	return vp
}

function measure() {
	const w = window.innerWidth
	const h = window.innerHeight

	return {
		width: w,
		height: h,
		isPortrait: h > w,
		isTablet: w >= 600 && w <= 1200,
		isSmallTablet: w >= 600 && w < 900, // 7" landscape
		isLargeTablet: w >= 900 && w <= 1200, // 10-12" iPad
		isDesktop: w > 1200,
	}
}
