import AppKit

/// A secure text field with a "Show"/"Hide" toggle (mirrors the Electron reveal button).
final class RevealableSecureField: NSView {
    private let secure = NSSecureTextField()
    private let plain = NSTextField()
    private let toggle = NSButton()

    var stringValue: String {
        get { secure.isHidden ? plain.stringValue : secure.stringValue }
        set { secure.stringValue = newValue; plain.stringValue = newValue }
    }

    init(placeholder: String) {
        super.init(frame: .zero)
        for f in [secure, plain] {
            f.placeholderString = placeholder
            f.translatesAutoresizingMaskIntoConstraints = false
            addSubview(f)
        }
        plain.isHidden = true
        toggle.title = "Show"
        toggle.bezelStyle = .rounded
        toggle.setButtonType(.momentaryPushIn)
        toggle.target = self
        toggle.action = #selector(toggleReveal)
        toggle.translatesAutoresizingMaskIntoConstraints = false
        addSubview(toggle)

        NSLayoutConstraint.activate([
            secure.leadingAnchor.constraint(equalTo: leadingAnchor),
            plain.leadingAnchor.constraint(equalTo: leadingAnchor),
            secure.topAnchor.constraint(equalTo: topAnchor),
            plain.topAnchor.constraint(equalTo: topAnchor),
            secure.bottomAnchor.constraint(equalTo: bottomAnchor),
            plain.bottomAnchor.constraint(equalTo: bottomAnchor),
            toggle.leadingAnchor.constraint(equalTo: secure.trailingAnchor, constant: 6),
            toggle.leadingAnchor.constraint(equalTo: plain.trailingAnchor, constant: 6),
            toggle.trailingAnchor.constraint(equalTo: trailingAnchor),
            toggle.centerYAnchor.constraint(equalTo: centerYAnchor),
            toggle.widthAnchor.constraint(equalToConstant: 56),
        ])
    }

    required init?(coder: NSCoder) { nil }

    @objc private func toggleReveal() {
        let revealing = secure.isHidden
        if revealing {
            secure.stringValue = plain.stringValue
            plain.isHidden = false; secure.isHidden = true
            toggle.title = "Hide"
        } else {
            plain.stringValue = secure.stringValue
            secure.isHidden = false; plain.isHidden = true
            toggle.title = "Show"
        }
    }
}

final class SettingsWindowController: NSWindowController, NSWindowDelegate {
    static var shared: SettingsWindowController?
    static var sharedIfVisible: SettingsWindowController? {
        (shared?.window?.isVisible ?? false) ? shared : nil
    }
    var isVisible: Bool { window?.isVisible ?? false }

    private let settings = SettingsStore.shared
    private var activeProvider: Provider = .anthropic

    // Controls
    private let segmented = NSSegmentedControl(labels: ["Anthropic", "OpenAI", "Local Server"],
                                               trackingMode: .selectOne, target: nil, action: nil)
    private let anthropicKey = RevealableSecureField(placeholder: "sk-ant-...")
    private let anthropicModel = NSTextField(string: "")
    private let anthropicTestResult = SettingsWindowController.resultLabel()
    private let openaiKey = RevealableSecureField(placeholder: "sk-...")
    private let openaiModel = NSTextField(string: "")
    private let openaiTestResult = SettingsWindowController.resultLabel()
    private let localEndpoint = NSTextField(string: "")
    private let localModel = NSTextField(string: "")
    private let localTestResult = SettingsWindowController.resultLabel()
    private let promptView = NSTextView()
    private let statusLabel = SettingsWindowController.resultLabel()

    private var panels: [Provider: NSView] = [:]

    init() {
        let win = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 500, height: 620),
            styleMask: [.titled, .closable],
            backing: .buffered, defer: false
        )
        win.title = "Quick Prompt Settings"
        win.isReleasedWhenClosed = false
        super.init(window: win)
        win.delegate = self
        buildUI()
        load()
    }

    required init?(coder: NSCoder) { nil }

    private static func resultLabel() -> NSTextField {
        let l = NSTextField(labelWithString: "")
        l.font = .systemFont(ofSize: 11)
        l.lineBreakMode = .byWordWrapping
        l.maximumNumberOfLines = 3
        return l
    }

    // MARK: UI

    private func buildUI() {
        guard let content = window?.contentView else { return }

        segmented.selectedSegment = 0
        segmented.target = self
        segmented.action = #selector(providerChanged)

        panels[.anthropic] = makeCloudPanel(key: anthropicKey, model: anthropicModel,
                                             modelPlaceholder: "claude-...",
                                             test: #selector(testAnthropic), result: anthropicTestResult)
        panels[.openai] = makeCloudPanel(key: openaiKey, model: openaiModel,
                                         modelPlaceholder: "gpt-...",
                                         test: #selector(testOpenAI), result: openaiTestResult)
        panels[.local] = makeLocalPanel()

        let panelContainer = NSView()
        panelContainer.translatesAutoresizingMaskIntoConstraints = false
        for (_, p) in panels {
            p.translatesAutoresizingMaskIntoConstraints = false
            p.isHidden = true
            panelContainer.addSubview(p)
            NSLayoutConstraint.activate([
                p.leadingAnchor.constraint(equalTo: panelContainer.leadingAnchor),
                p.trailingAnchor.constraint(equalTo: panelContainer.trailingAnchor),
                p.topAnchor.constraint(equalTo: panelContainer.topAnchor),
            ])
        }
        panels[.anthropic]?.isHidden = false

        // System prompt
        let promptHeader = NSStackView(views: [
            sectionLabel("System Prompt"), NSView(), linkButton("Restore Default", #selector(restoreDefault)),
        ])
        promptHeader.orientation = .horizontal

        let promptScroll = NSScrollView()
        promptScroll.borderType = .bezelBorder
        promptScroll.hasVerticalScroller = true
        promptScroll.documentView = promptView
        promptView.isRichText = false
        promptView.font = .systemFont(ofSize: 12)
        promptView.autoresizingMask = [.width]
        promptScroll.translatesAutoresizingMaskIntoConstraints = false
        promptScroll.heightAnchor.constraint(equalToConstant: 150).isActive = true

        // Buttons
        let cancel = NSButton(title: "Cancel", target: self, action: #selector(cancel))
        cancel.bezelStyle = .rounded
        cancel.keyEquivalent = "\u{1b}" // esc
        let save = NSButton(title: "Save", target: self, action: #selector(save))
        save.bezelStyle = .rounded
        save.keyEquivalent = "\r"
        let buttonRow = NSStackView(views: [statusLabel, NSView(), cancel, save])
        buttonRow.orientation = .horizontal

        let root = NSStackView(views: [segmented, panelContainer, promptHeader, promptScroll, buttonRow])
        root.orientation = .vertical
        root.alignment = .leading
        root.spacing = 12
        root.translatesAutoresizingMaskIntoConstraints = false
        content.addSubview(root)

        NSLayoutConstraint.activate([
            root.leadingAnchor.constraint(equalTo: content.leadingAnchor, constant: 20),
            root.trailingAnchor.constraint(equalTo: content.trailingAnchor, constant: -20),
            root.topAnchor.constraint(equalTo: content.topAnchor, constant: 20),
            root.bottomAnchor.constraint(equalTo: content.bottomAnchor, constant: -20),
            segmented.widthAnchor.constraint(equalTo: root.widthAnchor),
            panelContainer.widthAnchor.constraint(equalTo: root.widthAnchor),
            promptHeader.widthAnchor.constraint(equalTo: root.widthAnchor),
            promptScroll.widthAnchor.constraint(equalTo: root.widthAnchor),
            buttonRow.widthAnchor.constraint(equalTo: root.widthAnchor),
        ])
    }

    private func sectionLabel(_ s: String) -> NSTextField {
        let l = NSTextField(labelWithString: s)
        l.font = .boldSystemFont(ofSize: 12)
        return l
    }

    private func fieldLabel(_ s: String) -> NSTextField {
        let l = NSTextField(labelWithString: s)
        l.font = .systemFont(ofSize: 11)
        l.textColor = .secondaryLabelColor
        return l
    }

    private func linkButton(_ title: String, _ action: Selector) -> NSButton {
        let b = NSButton(title: title, target: self, action: action)
        b.isBordered = false
        b.bezelStyle = .inline
        b.contentTintColor = .linkColor
        return b
    }

    private func makeCloudPanel(key: NSView, model: NSTextField, modelPlaceholder: String,
                                test: Selector, result: NSTextField) -> NSView {
        model.placeholderString = modelPlaceholder
        let testBtn = NSButton(title: "Test Connection", target: self, action: test)
        testBtn.bezelStyle = .rounded
        let testRow = NSStackView(views: [testBtn, result])
        testRow.orientation = .horizontal
        let stack = NSStackView(views: [
            fieldLabel("API Key"), key,
            fieldLabel("Model"), model,
            testRow,
        ])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 6
        key.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
        model.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
        result.widthAnchor.constraint(lessThanOrEqualToConstant: 300).isActive = true
        return stack
    }

    private func makeLocalPanel() -> NSView {
        localEndpoint.placeholderString = "http://127.0.0.1:11434"
        localModel.placeholderString = "apple-foundationmodel"
        let testBtn = NSButton(title: "Test Connection", target: self, action: #selector(testLocal))
        testBtn.bezelStyle = .rounded
        let testRow = NSStackView(views: [testBtn, localTestResult])
        testRow.orientation = .horizontal
        let help = NSTextField(wrappingLabelWithString:
            "Works with Apfel (apfel --serve), Ollama (ollama serve), LM Studio, LocalAI, or any OpenAI-compatible server. No API key needed.")
        help.font = .systemFont(ofSize: 10)
        help.textColor = .tertiaryLabelColor
        let stack = NSStackView(views: [
            fieldLabel("Server URL"), localEndpoint,
            fieldLabel("Model"), localModel,
            testRow, help,
        ])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 6
        localEndpoint.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
        localModel.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
        help.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
        return stack
    }

    // MARK: Load / save

    private func load() {
        anthropicKey.stringValue = settings.anthropicApiKey
        anthropicModel.stringValue = settings.anthropicModel
        openaiKey.stringValue = settings.openaiApiKey
        openaiModel.stringValue = settings.openaiModel
        localEndpoint.stringValue = settings.localEndpoint
        localModel.stringValue = settings.localModel
        promptView.string = settings.systemPrompt
        activeProvider = settings.provider
        segmented.selectedSegment = [Provider.anthropic, .openai, .local].firstIndex(of: activeProvider) ?? 0
        showActivePanel()
        // Clear any stale test/status text from a previous opening.
        for l in [anthropicTestResult, openaiTestResult, localTestResult, statusLabel] {
            l.stringValue = ""
        }
    }

    @objc private func providerChanged() {
        activeProvider = [Provider.anthropic, .openai, .local][segmented.selectedSegment]
        showActivePanel()
        setStatus("", isError: false)
    }

    private func showActivePanel() {
        for (p, view) in panels { view.isHidden = (p != activeProvider) }
    }

    private func validate() -> String? {
        switch activeProvider {
        case .anthropic:
            if anthropicKey.stringValue.trimmingCharacters(in: .whitespaces).isEmpty { return "Anthropic API key is required." }
            if anthropicModel.stringValue.trimmingCharacters(in: .whitespaces).isEmpty { return "Anthropic model is required." }
        case .openai:
            if openaiKey.stringValue.trimmingCharacters(in: .whitespaces).isEmpty { return "OpenAI API key is required." }
            if openaiModel.stringValue.trimmingCharacters(in: .whitespaces).isEmpty { return "OpenAI model is required." }
        case .local:
            if localEndpoint.stringValue.trimmingCharacters(in: .whitespaces).isEmpty { return "Server URL is required." }
        }
        return nil
    }

    @objc private func save() {
        if let err = validate() { setStatus(err, isError: true); return }
        settings.provider = activeProvider
        settings.anthropicApiKey = anthropicKey.stringValue.trimmingCharacters(in: .whitespaces)
        settings.anthropicModel = anthropicModel.stringValue.trimmingCharacters(in: .whitespaces)
        settings.openaiApiKey = openaiKey.stringValue.trimmingCharacters(in: .whitespaces)
        settings.openaiModel = openaiModel.stringValue.trimmingCharacters(in: .whitespaces)
        settings.localEndpoint = localEndpoint.stringValue.trimmingCharacters(in: .whitespaces)
        settings.localModel = localModel.stringValue.trimmingCharacters(in: .whitespaces)
        let prompt = promptView.string.trimmingCharacters(in: .whitespacesAndNewlines)
        settings.systemPrompt = prompt.isEmpty ? DEFAULT_SYSTEM_PROMPT : prompt
        settings.notifyChanged()
        setStatus("Saved ✓", isError: false)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { [weak self] in self?.window?.close() }
    }

    @objc private func cancel() { window?.close() }

    @objc private func restoreDefault() { promptView.string = DEFAULT_SYSTEM_PROMPT }

    private func setStatus(_ msg: String, isError: Bool) {
        statusLabel.stringValue = msg
        statusLabel.textColor = isError ? .systemRed : .systemGreen
    }

    // MARK: Test connection

    @objc private func testAnthropic() {
        let key = anthropicKey.stringValue.trimmingCharacters(in: .whitespaces)
        guard !key.isEmpty else { return setResult(anthropicTestResult, "✗ Enter an API key first", false) }
        setResult(anthropicTestResult, "Testing…", true)
        let model = anthropicModel.stringValue
        Task {
            let r = await Providers.testAnthropic(apiKey: key, model: model)
            await MainActor.run { self.showTestResult(r, in: self.anthropicTestResult) }
        }
    }

    @objc private func testOpenAI() {
        let key = openaiKey.stringValue.trimmingCharacters(in: .whitespaces)
        guard !key.isEmpty else { return setResult(openaiTestResult, "✗ Enter an API key first", false) }
        setResult(openaiTestResult, "Testing…", true)
        let model = openaiModel.stringValue
        Task {
            let r = await Providers.testOpenAI(apiKey: key, model: model)
            await MainActor.run { self.showTestResult(r, in: self.openaiTestResult) }
        }
    }

    @objc private func testLocal() {
        let endpoint = localEndpoint.stringValue.trimmingCharacters(in: .whitespaces)
        guard !endpoint.isEmpty else { return setResult(localTestResult, "✗ Enter a server URL first", false) }
        setResult(localTestResult, "Testing…", true)
        Task {
            let r = await Providers.testLocal(endpoint: endpoint)
            await MainActor.run { self.showTestResult(r, in: self.localTestResult, showModels: true) }
        }
    }

    private func showTestResult(_ r: TestResult, in label: NSTextField, showModels: Bool = false) {
        if r.success {
            var msg = "✓ \(r.message ?? "OK")"
            if showModels, let m = r.models, !m.isEmpty {
                msg += " — Available: \(m.prefix(8).joined(separator: ", "))"
            }
            setResult(label, msg, true)
        } else {
            setResult(label, "✗ \(r.error ?? "Failed")", false)
        }
    }

    private func setResult(_ label: NSTextField, _ msg: String, _ ok: Bool) {
        label.stringValue = msg
        label.textColor = ok ? .systemGreen : .systemRed
    }

    // MARK: Window

    func present() {
        load() // always reflect the last-saved state, not stale edits from a cancelled open
        window?.center()
        showWindow(nil)
        window?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }
}
