import AppKit

/// Borderless panel that can still become key (so the text field accepts input).
final class OverlayPanel: NSPanel {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
}

enum UIState { case input, loading, result }

/// The Spotlight-style overlay: type/paste text, press ↵ to send it to the
/// configured provider, see the corrected text (auto-copied to the clipboard).
final class OverlayController: NSObject, NSWindowDelegate {
    static let width: CGFloat = 620
    static let minHeight: CGFloat = 100
    static let maxHeight: CGFloat = 500
    private static let inset: CGFloat = 16

    var onOpenSettings: () -> Void = {}

    private let panel: OverlayPanel
    private let settings = SettingsStore.shared

    private let modelLabel = OverlayController.makeLabel(size: 11, color: .secondaryLabelColor)
    private let versionLabel = OverlayController.makeLabel(size: 11, color: .tertiaryLabelColor)
    private let input = NSTextField()
    private let resultScroll = NSScrollView()
    private let resultView = NSTextView()
    private let statusLabel = OverlayController.makeLabel(size: 12, color: .systemGreen)
    private let hintLabel = OverlayController.makeLabel(size: 11, color: .tertiaryLabelColor)
    private var resultHeight: NSLayoutConstraint!

    private var state: UIState = .input
    private var originalText = ""
    private var keyMonitor: Any?
    private var statusClearWork: DispatchWorkItem?

    private let hintInput = "↵ Check · esc Dismiss · ⌘, Settings"
    private let hintLoading = "Waiting for response..."
    private let hintResult = "↵ New · esc Dismiss · ⌘, Settings"
    private let defaultPlaceholder = "Type or paste text..."

    override init() {
        panel = OverlayPanel(
            contentRect: NSRect(x: 0, y: 0, width: OverlayController.width, height: OverlayController.minHeight),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered, defer: false
        )
        super.init()
        configurePanel()
        buildUI()
        observeSettings()
        refreshLabels()
    }

    // MARK: Setup

    private func configurePanel() {
        panel.isFloatingPanel = true
        panel.level = .screenSaver
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = true
        panel.hidesOnDeactivate = false
        panel.isMovableByWindowBackground = false
        panel.delegate = self
    }

    private static func makeLabel(size: CGFloat, color: NSColor) -> NSTextField {
        let l = NSTextField(labelWithString: "")
        l.font = .systemFont(ofSize: size)
        l.textColor = color
        l.lineBreakMode = .byTruncatingTail
        return l
    }

    private func buildUI() {
        let bg = NSVisualEffectView()
        bg.material = .hudWindow
        bg.blendingMode = .behindWindow
        bg.state = .active
        bg.wantsLayer = true
        bg.layer?.cornerRadius = 12
        bg.layer?.masksToBounds = true
        panel.contentView = bg

        // Top row: model (left) + version (right)
        let topRow = NSStackView(views: [modelLabel, NSView(), versionLabel])
        topRow.orientation = .horizontal
        topRow.distribution = .fill
        modelLabel.setContentHuggingPriority(.defaultLow, for: .horizontal)

        input.font = .systemFont(ofSize: 20)
        input.placeholderString = defaultPlaceholder
        input.isBordered = false
        input.drawsBackground = false
        input.focusRingType = .none
        input.lineBreakMode = .byTruncatingTail
        input.cell?.usesSingleLineMode = true
        input.target = self
        input.action = #selector(onEnterAction)

        resultView.isEditable = false
        resultView.isSelectable = true
        resultView.drawsBackground = false
        resultView.font = .systemFont(ofSize: 14)
        resultView.textContainerInset = .zero
        resultView.textContainer?.lineFragmentPadding = 0
        resultScroll.documentView = resultView
        resultScroll.drawsBackground = false
        resultScroll.hasVerticalScroller = true
        resultScroll.autohidesScrollers = true
        resultScroll.isHidden = true

        statusLabel.isHidden = true

        let stack = NSStackView(views: [topRow, input, resultScroll, statusLabel, hintLabel])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 8
        stack.translatesAutoresizingMaskIntoConstraints = false
        bg.addSubview(stack)

        let inset = OverlayController.inset
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: bg.leadingAnchor, constant: inset),
            stack.trailingAnchor.constraint(equalTo: bg.trailingAnchor, constant: -inset),
            stack.topAnchor.constraint(equalTo: bg.topAnchor, constant: inset),
            stack.bottomAnchor.constraint(equalTo: bg.bottomAnchor, constant: -inset),
        ])
        let inner = OverlayController.width - inset * 2
        topRow.widthAnchor.constraint(equalToConstant: inner).isActive = true
        input.widthAnchor.constraint(equalToConstant: inner).isActive = true
        resultScroll.widthAnchor.constraint(equalToConstant: inner).isActive = true
        statusLabel.widthAnchor.constraint(equalToConstant: inner).isActive = true
        hintLabel.widthAnchor.constraint(equalToConstant: inner).isActive = true
        resultHeight = resultScroll.heightAnchor.constraint(equalToConstant: 0)
        resultHeight.isActive = true

        hintLabel.stringValue = hintInput
    }

    private func observeSettings() {
        NotificationCenter.default.addObserver(
            self, selector: #selector(refreshLabels),
            name: SettingsStore.didChange, object: nil
        )
    }

    @objc private func refreshLabels() {
        modelLabel.stringValue = formatModelName(settings.activeModel, settings.provider)
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.1.1"
        versionLabel.stringValue = "v\(version)"
        applyKeyState()
    }

    private func formatModelName(_ model: String, _ provider: Provider) -> String {
        switch provider {
        case .local: return "\(model) · local"
        case .openai: return model
        case .anthropic: return model
        }
    }

    // MARK: State machine

    private var inputDisabled: Bool {
        settings.provider != .local && !settings.isProviderConfigured
    }

    private func missingPlaceholder() -> String {
        settings.provider == .openai
            ? "⚠ OpenAI API key not set. Press ⌘, for Settings"
            : "⚠ Anthropic API key not set. Press ⌘, for Settings"
    }

    private func applyKeyState() {
        guard state == .input else { return }
        let disabled = inputDisabled
        input.isEnabled = !disabled
        input.placeholderString = disabled ? missingPlaceholder() : defaultPlaceholder
    }

    private func resetToInput() {
        state = .input
        statusClearWork?.cancel()
        originalText = ""
        input.stringValue = ""
        input.isEnabled = !inputDisabled
        input.placeholderString = inputDisabled ? missingPlaceholder() : defaultPlaceholder
        resultView.string = ""
        resultScroll.isHidden = true
        resultHeight.constant = 0
        statusLabel.isHidden = true
        statusLabel.stringValue = ""
        hintLabel.stringValue = hintInput
        resizeWindow(to: OverlayController.minHeight)
    }

    private func goLoading() {
        state = .loading
        originalText = input.stringValue
        input.isEnabled = false
        input.placeholderString = "Thinking..."
        hintLabel.stringValue = hintLoading
    }

    private func goResult(_ result: ApiResult) {
        state = .result
        input.stringValue = originalText
        input.isEnabled = false
        hintLabel.stringValue = hintResult

        if result.success, let text = result.text {
            resultView.textColor = .labelColor
            resultView.string = text
            resultScroll.isHidden = false
            copyToClipboard(text)
            statusLabel.textColor = .systemGreen
            statusLabel.stringValue = "✓ Copied to clipboard"
            statusLabel.isHidden = false
            scheduleStatusClear()
        } else {
            resultView.textColor = .systemRed
            resultView.string = result.error ?? "Unknown error"
            resultScroll.isHidden = false
            statusLabel.isHidden = true
            statusLabel.stringValue = ""
        }
        DispatchQueue.main.async { [weak self] in self?.resizeToContent() }
    }

    private func scheduleStatusClear() {
        statusClearWork?.cancel()
        let work = DispatchWorkItem { [weak self] in self?.statusLabel.stringValue = "" }
        statusClearWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 2, execute: work)
    }

    // MARK: Actions

    @objc private func onEnterAction() { onEnter() }

    private func onEnter() {
        if state == .loading { return }
        if state == .result { resetToInput(); input.window?.makeFirstResponder(input); return }
        if inputDisabled { return }
        let value = input.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty else { return }
        goLoading()
        Task {
            let result = await Providers.checkText(value, settings)
            await MainActor.run { self.goResult(result) }
        }
    }

    private func onEscape() {
        if state == .loading { return }
        resetToInput()
        hide()
    }

    // MARK: Show / hide

    var isVisible: Bool { panel.isVisible }

    func toggle() { panel.isVisible ? hide() : show() }

    func show() {
        applyOverlayLevel()
        positionOnActiveScreen()
        resetToInput()

        // Avoid NSApp.activate up front. As a `.nonactivatingPanel`, the panel
        // can usually become key on its own — activating would drag the app's
        // home Space forward, switching the user to the desktop instead of
        // overlaying the panel on their current window / fullscreen app.
        // orderFrontRegardless shows the panel even when the frontmost app is
        // fullscreen and this app has never been active.
        panel.alphaValue = 0
        panel.orderFrontRegardless()
        panel.makeKey()
        if !panel.isKeyWindow {
            // Some contexts (another app's fullscreen Space) refuse key status
            // to a nonactivating panel unless the app is active. The app is an
            // accessory whose only window joins all Spaces, so activating here
            // does not switch Spaces.
            NSApp.activate(ignoringOtherApps: true)
            panel.makeKeyAndOrderFront(nil)
        }
        let front = NSWorkspace.shared.frontmostApplication?.localizedName ?? "?"
        Diag.log.notice("show(): visible=\(self.panel.isVisible) key=\(self.panel.isKeyWindow) front=\(front, privacy: .public)")
        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 0.12
            panel.animator().alphaValue = 1
        }

        installKeyMonitor()
        prefillFromClipboardAndFocus()
    }

    func hide() {
        removeKeyMonitor()
        // Ordering the nonactivating panel out returns key focus to the app that
        // was frontmost — no NSApp.hide needed. Calling NSApp.hide would fight the
        // no-activate behavior and could bounce the user off their current Space.
        panel.orderOut(nil)
        resetToInput()
    }

    /// Dismiss the overlay (and its key monitor) when handing focus to the
    /// Settings window — without `NSApp.hide`, so Settings stays visible.
    /// Mirrors Electron's `hideOverlayWindowOnly`.
    func hideForSettings() {
        removeKeyMonitor()
        if panel.isVisible { panel.orderOut(nil) }
        resetToInput()
    }

    private func applyOverlayLevel() {
        panel.level = .screenSaver
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]
    }

    private func positionOnActiveScreen() {
        let mouse = NSEvent.mouseLocation
        let screen = NSScreen.screens.first { NSMouseInRect(mouse, $0.frame, false) }
            ?? NSScreen.main ?? NSScreen.screens.first
        guard let vf = screen?.visibleFrame else { return }
        let winW = OverlayController.width
        let winH = panel.frame.height
        let x = vf.origin.x + (vf.width - winW) / 2
        // One-third from the top of the work area (Spotlight-style).
        let y = vf.maxY - (vf.height - winH) / 3 - winH
        panel.setFrame(NSRect(x: x.rounded(), y: y.rounded(), width: winW, height: winH), display: true)
    }

    private func prefillFromClipboardAndFocus() {
        if !inputDisabled, let clip = NSPasteboard.general.string(forType: .string),
           !clip.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            input.stringValue = clip
        }
        panel.makeFirstResponder(input)
        input.currentEditor()?.selectAll(nil)
    }

    private func copyToClipboard(_ text: String) {
        let pb = NSPasteboard.general
        pb.clearContents()
        pb.setString(text, forType: .string)
    }

    // MARK: Sizing

    private func resizeToContent() {
        let inner = OverlayController.width - OverlayController.inset * 2
        if let lm = resultView.layoutManager, let tc = resultView.textContainer {
            tc.size = NSSize(width: inner, height: .greatestFiniteMagnitude)
            lm.ensureLayout(for: tc)
            let used = lm.usedRect(for: tc).height
            resultHeight.constant = min(used + 4, OverlayController.maxHeight - 120)
        }
        panel.contentView?.layoutSubtreeIfNeeded()
        let fitting = (panel.contentView?.fittingSize.height ?? OverlayController.minHeight)
        resizeWindow(to: fitting)
    }

    private func resizeWindow(to desired: CGFloat) {
        let h = min(max(desired, OverlayController.minHeight), OverlayController.maxHeight)
        var frame = panel.frame
        let top = frame.maxY
        frame.size.height = h
        frame.origin.y = top - h // keep the top edge anchored as it grows
        panel.setFrame(frame, display: true, animate: false)
    }

    // MARK: Key handling

    private func installKeyMonitor() {
        guard keyMonitor == nil else { return }
        keyMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            guard let self else { return event }
            // ⌘,
            if event.modifierFlags.contains(.command),
               event.charactersIgnoringModifiers == "," {
                self.onOpenSettings()
                return nil
            }
            switch event.keyCode {
            case 53: self.onEscape(); return nil       // esc
            case 36, 76: self.onEnter(); return nil    // return / numpad enter
            default: return event
            }
        }
    }

    private func removeKeyMonitor() {
        if let keyMonitor { NSEvent.removeMonitor(keyMonitor) }
        keyMonitor = nil
    }

    // Hiding when the panel resigns key would fight the fade-in; we dismiss
    // explicitly via esc / hotkey instead, matching the Electron behavior.
}
