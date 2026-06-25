import Foundation

/// Runtime checks for the non-GUI layer (Keychain, request bodies, settings
/// logic). Invoke with `QuickPrompt --selftest`. Uses an isolated Keychain
/// account and never mutates persisted settings, so it's safe to run anytime.
enum SelfTest {
    static func run() -> Bool {
        var failures = 0
        func check(_ name: String, _ ok: Bool) {
            print("\(ok ? "✓" : "✗") \(name)")
            if !ok { failures += 1 }
        }

        // 1. Keychain round-trip on an isolated account.
        let acct = "__qp_selftest__"
        Keychain.write("secret-123", account: acct)
        check("Keychain write/read", Keychain.read(account: acct) == "secret-123")
        Keychain.write("updated-456", account: acct)
        check("Keychain update", Keychain.read(account: acct) == "updated-456")
        Keychain.write("", account: acct)
        check("Keychain delete on empty", Keychain.read(account: acct) == nil)

        // 2. Default model constant is the current, non-retired model.
        check("Default Anthropic model = claude-sonnet-4-6",
              DEFAULT_ANTHROPIC_MODEL == "claude-sonnet-4-6")

        // 3. Anthropic request body shape.
        let ab = Providers.anthropicBody(model: "m", system: "sys", text: "hello")
        let aMsgs = ab["messages"] as? [[String: String]]
        check("Anthropic body: model/max_tokens/system",
              ab["model"] as? String == "m"
              && ab["max_tokens"] as? Int == 4096
              && ab["system"] as? String == "sys")
        check("Anthropic body: single user message",
              aMsgs?.count == 1 && aMsgs?.first?["role"] == "user" && aMsgs?.first?["content"] == "hello")

        // 4. OpenAI/local chat body shape (system + user, stream:false).
        let cb = Providers.chatBody(model: "gpt", system: "sys", text: "hi")
        let cMsgs = cb["messages"] as? [[String: String]]
        check("Chat body: stream=false", cb["stream"] as? Bool == false)
        check("Chat body: system then user",
              cMsgs?.count == 2
              && cMsgs?[0]["role"] == "system" && cMsgs?[0]["content"] == "sys"
              && cMsgs?[1]["role"] == "user" && cMsgs?[1]["content"] == "hi")

        // 5. Bodies are JSON-serializable.
        check("Bodies serialize to JSON",
              (try? JSONSerialization.data(withJSONObject: ab)) != nil
              && (try? JSONSerialization.data(withJSONObject: cb)) != nil)

        // 6. Endpoint normalization (local server URL building).
        check("stripTrailingSlash", Providers.stripTrailingSlash("http://x:1/") == "http://x:1"
              && Providers.stripTrailingSlash("http://x:1///") == "http://x:1"
              && Providers.stripTrailingSlash("http://x:1") == "http://x:1")

        print("")
        print(failures == 0 ? "ALL CHECKS PASSED" : "\(failures) CHECK(S) FAILED")
        return failures == 0
    }
}
