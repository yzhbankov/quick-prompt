import os

/// Unified-log diagnostics. NSLog from `open`-launched apps no longer lands in
/// `log show` on recent macOS, so use os.Logger with a fixed subsystem:
///   log show --last 1h --predicate 'subsystem == "com.quickprompt.app"'
enum Diag {
    static let log = Logger(subsystem: "com.quickprompt.app", category: "app")
}
