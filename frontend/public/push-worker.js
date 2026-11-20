const allowedPaths = new Set(['/profile', '/profile?reminder=cards', '/profile?reminder=attack'])

self.addEventListener('install', event => event.waitUntil(self.skipWaiting()))
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

self.addEventListener('push', event => {
	let message = {}
	try {
		message = event.data?.json() ?? {}
	} catch {
		// Show a generic notification if a payload cannot be read.
	}
	event.waitUntil(self.registration.showNotification(message.title || 'Calm', {
		body: message.body || 'В Calm доступен новый прогноз.',
		icon: '/icons/icon-192.png',
		tag: message.tag || 'calm-forecast',
		data: { path: allowedPaths.has(message.path) ? message.path : '/profile' },
	}))
})

self.addEventListener('notificationclick', event => {
	event.notification.close()
	event.waitUntil((async () => {
		const path = event.notification.data?.path
		const url = new URL(allowedPaths.has(path) ? path : '/profile', self.location.origin).href
		const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
		const diary = windows.find(client => client.url === url)
		if (diary) await diary.focus()
		else await self.clients.openWindow(url)
	})())
})
