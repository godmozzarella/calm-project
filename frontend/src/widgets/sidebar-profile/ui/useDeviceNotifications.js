import { useEffect, useState } from 'react'
import { http } from '@/shared/api'
import { notifyError, notifyRequestError } from '@/shared/lib/notifyError'

const path = '/users/me/device-notifications'
const initial = { account: null, kind: 'loading', enabled: false }

const availability = () => {
	const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
		|| (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
	if (ios && !navigator.standalone && !window.matchMedia('(display-mode: standalone)').matches) {
		return 'install'
	}
	return window.isSecureContext && 'serviceWorker' in navigator
		&& 'PushManager' in window && 'Notification' in window ? 'ready' : 'unsupported'
}

const explanation = {
	install: 'Добавьте Calm на экран «Домой», откройте его с иконки и включите уведомления там.',
	unsupported: 'Уведомления на этом устройстве недоступны. Откройте Calm по HTTPS в браузере с поддержкой Web Push.',
	unconfigured: 'Уведомления на устройстве пока недоступны на сервере Calm.',
	blocked: 'Разрешите уведомления Calm в системных настройках или настройках браузера.',
	unavailable: 'Не удалось проверить уведомления. Закройте и снова откройте меню профиля.',
}

const decodeKey = key => {
	const base64 = key.replace(/-/g, '+').replace(/_/g, '/')
	return Uint8Array.from(atob(base64), char => char.charCodeAt(0))
}

const matchingKey = (subscription, key) => {
	const existing = new Uint8Array(subscription.options.applicationServerKey)
	return existing.length === key.length && existing.every((byte, index) => byte === key[index])
}

export function useDeviceNotifications(open, userId) {
	const [state, setState] = useState(initial)
	const [busy, setBusy] = useState(false)
	const current = state.account === userId ? state : initial

	useEffect(() => {
		if (!open || !userId) return
		let cancelled = false
		const update = status => { if (!cancelled) setState({ ...initial, ...status, account: userId }) }

		const load = async () => {
			try {
				const kind = availability()
				if (kind !== 'ready') return update({ kind })
				if (Notification.permission === 'denied') return update({ kind: 'blocked' })
				const config = await http.get(path)
				if (!config.available) return update({ kind: 'unconfigured' })
				await navigator.serviceWorker.register('/push-worker.js')
				const registration = await navigator.serviceWorker.ready
				const subscription = await registration.pushManager.getSubscription()
				const key = decodeKey(config.publicKey)
				const status = subscription && matchingKey(subscription, key)
					? await http.post(path + '/status', { endpoint: subscription.endpoint })
					: null
				update({ kind, enabled: Boolean(status?.enabled), registration, key })
			} catch {
				update({ kind: 'unavailable' })
			}
		}
		void load()
		return () => { cancelled = true }
	}, [open, userId])

	const toggle = async () => {
		if (busy || current.kind === 'loading') return
		if (current.kind !== 'ready') {
			notifyError(explanation[current.kind], 'Уведомления на устройстве')
			return
		}

		setBusy(true)
		let created = null
		try {
			// iOS requires the permission request to start in the click handler.
			if (!current.enabled && await Notification.requestPermission() !== 'granted') {
				notifyError(explanation.blocked, 'Уведомления заблокированы')
				return
			}
			const manager = current.registration.pushManager
			let subscription = await manager.getSubscription()
			if (current.enabled) {
				if (subscription) await http.delete(path, { endpoint: subscription.endpoint })
				setState({ ...current, enabled: false })
				if (subscription) await subscription.unsubscribe().catch(() => {})
				return
			}
			if (subscription && !matchingKey(subscription, current.key)) {
				await subscription.unsubscribe()
				subscription = null
			}
			if (!subscription) {
				created = await manager.subscribe({ userVisibleOnly: true, applicationServerKey: current.key })
				subscription = created
			}
			await http.put(path, subscription.toJSON())
			setState({ ...current, enabled: true })
		} catch (error) {
			if (created) await created.unsubscribe().catch(() => {})
			if (error.name === 'NotAllowedError') notifyError(explanation.blocked, 'Уведомления заблокированы')
			else notifyRequestError(error, 'Не удалось изменить уведомления на устройстве')
		} finally {
			setBusy(false)
		}
	}

	return { enabled: current.enabled, busy: busy || current.kind === 'loading', toggle }
}
