import Foundation

enum Provider: String, Codable, CaseIterable {
    case anthropic
    case openai
    case local
}

let DEFAULT_SYSTEM_PROMPT =
    "You are a writing assistant. Check and correct the following text for grammar, spelling, punctuation, and clarity. Return ONLY the corrected text. No explanations, no preamble, no quotes around the text."

let DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6"
let DEFAULT_OPENAI_MODEL = "gpt-4o"
let DEFAULT_LOCAL_ENDPOINT = "http://127.0.0.1:11434"
let DEFAULT_LOCAL_MODEL = "apple-foundationmodel"

/// Persistent settings.
///
/// Non-secret fields live in `UserDefaults`; the two API keys live in the
/// macOS Keychain (`Keychain`), which is more secure than the plaintext
/// `config.json` the Electron version wrote.
final class SettingsStore {
    static let shared = SettingsStore()

    private let defaults = UserDefaults.standard

    private enum Key {
        static let provider = "provider"
        static let anthropicModel = "anthropicModel"
        static let openaiModel = "openaiModel"
        static let localEndpoint = "localEndpoint"
        static let localModel = "localModel"
        static let systemPrompt = "systemPrompt"
        static let showInDock = "showInDock"
    }

    private enum KeychainAccount {
        static let anthropic = "anthropicApiKey"
        static let openai = "openaiApiKey"
    }

    // MARK: Non-secret fields

    var provider: Provider {
        get { Provider(rawValue: defaults.string(forKey: Key.provider) ?? "") ?? .anthropic }
        set { defaults.set(newValue.rawValue, forKey: Key.provider) }
    }

    var anthropicModel: String {
        get { nonEmpty(defaults.string(forKey: Key.anthropicModel)) ?? DEFAULT_ANTHROPIC_MODEL }
        set { defaults.set(newValue, forKey: Key.anthropicModel) }
    }

    var openaiModel: String {
        get { nonEmpty(defaults.string(forKey: Key.openaiModel)) ?? DEFAULT_OPENAI_MODEL }
        set { defaults.set(newValue, forKey: Key.openaiModel) }
    }

    var localEndpoint: String {
        get { nonEmpty(defaults.string(forKey: Key.localEndpoint)) ?? DEFAULT_LOCAL_ENDPOINT }
        set { defaults.set(newValue, forKey: Key.localEndpoint) }
    }

    var localModel: String {
        get { nonEmpty(defaults.string(forKey: Key.localModel)) ?? DEFAULT_LOCAL_MODEL }
        set { defaults.set(newValue, forKey: Key.localModel) }
    }

    var systemPrompt: String {
        get { nonEmpty(defaults.string(forKey: Key.systemPrompt)) ?? DEFAULT_SYSTEM_PROMPT }
        set { defaults.set(newValue, forKey: Key.systemPrompt) }
    }

    var showInDock: Bool {
        get { defaults.bool(forKey: Key.showInDock) }
        set { defaults.set(newValue, forKey: Key.showInDock) }
    }

    // MARK: Secret fields (Keychain)

    var anthropicApiKey: String {
        get { Keychain.read(account: KeychainAccount.anthropic) ?? "" }
        set { Keychain.write(newValue, account: KeychainAccount.anthropic) }
    }

    var openaiApiKey: String {
        get { Keychain.read(account: KeychainAccount.openai) ?? "" }
        set { Keychain.write(newValue, account: KeychainAccount.openai) }
    }

    // MARK: Derived

    var activeModel: String {
        switch provider {
        case .anthropic: return anthropicModel
        case .openai: return openaiModel
        case .local: return localModel
        }
    }

    var isProviderConfigured: Bool {
        switch provider {
        case .local: return !localEndpoint.trimmingCharacters(in: .whitespaces).isEmpty
        case .openai: return !openaiApiKey.isEmpty
        case .anthropic: return !anthropicApiKey.isEmpty
        }
    }

    private func nonEmpty(_ s: String?) -> String? {
        guard let s, !s.trimmingCharacters(in: .whitespaces).isEmpty else { return nil }
        return s
    }
}

private extension Notification.Name {
    static let settingsChanged = Notification.Name("QuickPromptSettingsChanged")
}

extension SettingsStore {
    /// Posted after a Save so the overlay can refresh its model/version labels.
    static let didChange = Notification.Name("QuickPromptSettingsChanged")

    func notifyChanged() {
        NotificationCenter.default.post(name: SettingsStore.didChange, object: nil)
    }
}
