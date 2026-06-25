import AppKit

// Headless verification path: `QuickPrompt --selftest` exercises the non-GUI
// layer and exits without launching the UI.
if CommandLine.arguments.contains("--selftest") {
    exit(SelfTest.run() ? 0 : 1)
}

// Menu-bar app: no main storyboard, programmatic AppKit.
let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
