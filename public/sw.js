// Staff PWA service worker: shows push notifications and opens the app when one is tapped.
// No fetch handler on purpose: the dashboard needs live data, so nothing is cached offline.

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'Revelation Camp', {
      body: data.body,
      icon: '/icons/icon-192.png',
      data: { url: data.url || '/dashboard' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/dashboard', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url === url)
      return open ? open.focus() : self.clients.openWindow(url)
    }),
  )
})
