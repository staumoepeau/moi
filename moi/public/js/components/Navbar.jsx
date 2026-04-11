import React from "react";

export function Navbar({ title, subtitle, user, onLogout }) {
	return (
		<div className="bg-white border-b border-gray-200 sticky top-0 z-50">
			<div className="px-8 py-4 flex items-center justify-between max-w-7xl mx-auto">
				<div className="flex items-center gap-4">
					<div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
						Q
					</div>
					<div>
						<h1 className="text-lg font-bold text-gray-900">{title}</h1>
						<p className="text-xs text-gray-500">{subtitle}</p>
					</div>
				</div>

				<div className="flex items-center gap-4">
					<button className="px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded transition">
						Refresh
					</button>
					<button className="px-4 py-2 text-sm font-bold border-2 border-gray-900 text-gray-900 hover:bg-gray-100 rounded transition">
						{user}
					</button>
				</div>
			</div>
		</div>
	);
}
