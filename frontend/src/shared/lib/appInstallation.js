import { useSyncExternalStore } from 'react'

let promptEvent = null
let installed = false
let initialized = false
const listeners = new Set()
const notify = () => listeners.forEach(listener => listener())
const subscribe = listener => { listeners.add(listener); return () => listeners.delete(listener) }

export function initializeAppInstallation() {
    if (initialized) return
    initialized = true
    const standalone = window.matchMedia('(display-mode: standalone)')
    installed = standalone.matches || navigator.standalone === true
    standalone.addEventListener('change', event => { installed = event.matches || navigator.standalone === true; notify() })
    window.addEventListener('beforeinstallprompt', event => {
        event.preventDefault()
        promptEvent = event
        notify()
    })
    window.addEventListener('appinstalled', () => { installed = true; promptEvent = null; notify() })
}

export function useAppInstallation() {
    const isInstalled = useSyncExternalStore(subscribe, () => installed, () => false)
    const install = async () => {
        if (!promptEvent) return false
        const event = promptEvent
        promptEvent = null // Browser prompts can only be used once, including after dismissal.
        notify()
        await event.prompt()
        await event.userChoice
        return true
    }
    return { isInstalled, install }
}

export function getInstallationGuide() {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    return ios ? 'install-ios' : /Android/i.test(navigator.userAgent) ? 'install-android' : 'install-other'
}
