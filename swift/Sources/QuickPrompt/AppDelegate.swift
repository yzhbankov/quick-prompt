import AppKit

final class AppDelegate: NSObject, NSApplicationDelegate {
    private let settings = SettingsStore.shared
    private var statusItem: NSStatusItem!
    private var hotKey: GlobalHotKey?
    private lazy var overlay: OverlayController = {
        let o = OverlayController()
        o.onOpenSettings = { [weak self] in self?.openSettings() }
        return o
    }()

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Single-instance guard: if another copy is already running, surface it
        // and quit this one so the menu bar never accumulates duplicate icons.
        if let bid = Bundle.main.bundleIdentifier {
            let others = NSRunningApplication.runningApplications(withBundleIdentifier: bid)
                .filter { $0.processIdentifier != ProcessInfo.processInfo.processIdentifier }
            if let existing = others.first {
                existing.activate(options: [.activateIgnoringOtherApps])
                NSApp.terminate(nil)
                return
            }
        }

        applyDockVisibility(settings.showInDock)
        buildStatusItem()
        registerHotKey()

        // Show the overlay once on launch so it's obvious the app started
        // (it's a menu-bar app — there's otherwise no window or dock icon).
        DispatchQueue.main.async { [weak self] in self?.overlay.show() }
    }

    // MARK: Status bar

    private func buildStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = statusItem.button {
            if let image = NSImage(systemSymbolName: "wand.and.stars", accessibilityDescription: "Quick Prompt") {
                image.isTemplate = true
                button.image = image
            } else {
                button.title = "QP" // fallback so the item is never invisible
            }
            button.toolTip = "Quick Prompt"
        }
        rebuildMenu()
    }

    private func rebuildMenu() {
        let menu = NSMenu()

        menu.addItem(withTitle: "Show / Hide  (⌘⇧G)", action: #selector(toggleOverlay), keyEquivalent: "")

        let settingsItem = NSMenuItem(title: "Settings…", action: #selector(openSettings), keyEquivalent: ",")
        settingsItem.keyEquivalentModifierMask = [.command]
        menu.addItem(settingsItem)

        menu.addItem(.separator())

        let dockItem = NSMenuItem(title: "Show in Dock", action: #selector(toggleDock), keyEquivalent: "")
        dockItem.state = settings.showInDock ? .on : .off
        menu.addItem(dockItem)

        menu.addItem(.separator())
        menu.addItem(withTitle: "Quit", action: #selector(quit), keyEquivalent: "q")

        for item in menu.items where item.action != nil { item.target = self }
        statusItem.menu = menu
    }

    // MARK: Actions

    @objc private func toggleOverlay() { overlay.toggle() }

    @objc private func openSettings() {
        overlay.hideForSettings()
        if SettingsWindowController.shared == nil {
            SettingsWindowController.shared = SettingsWindowController()
        }
        SettingsWindowController.shared?.present()
    }

    @objc private func toggleDock() {
        settings.showInDock.toggle()
        applyDockVisibility(settings.showInDock)
        rebuildMenu()
    }

    @objc private func quit() { NSApp.terminate(nil) }

    private func applyDockVisibility(_ visible: Bool) {
        NSApp.setActivationPolicy(visible ? .regular : .accessory)
    }

    private func registerHotKey() {
        hotKey = GlobalHotKey { [weak self] in self?.overlay.toggle() }
        if hotKey == nil {
            NSLog("[quick-prompt] Failed to register global hotkey ⌘⇧G. Use the menu-bar item instead.")
        }
    }
}
