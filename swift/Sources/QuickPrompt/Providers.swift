import Foundation

struct ApiResult {
    let success: Bool
    let text: String?
    let error: String?

    static func ok(_ text: String) -> ApiResult { ApiResult(success: true, text: text, error: nil) }
    static func fail(_ error: String) -> ApiResult { ApiResult(success: false, text: nil, error: error) }
}

struct TestResult {
    let success: Bool
    let message: String?
    let error: String?
    let models: [String]?
}

private let REQUEST_TIMEOUT: TimeInterval = 30
private let TEST_TIMEOUT: TimeInterval = 5

// MARK: - Response shapes

private struct AnthropicResponse: Decodable {
    struct Block: Decodable { let text: String? }
    let content: [Block]?
}

private struct OpenAIChatResponse: Decodable {
    struct Choice: Decodable {
        struct Message: Decodable { let content: String? }
        let message: Message?
    }
    let choices: [Choice]?
}

private struct ModelsResponse: Decodable {
    struct Model: Decodable { let id: String? }
    let data: [Model]?
}

enum Providers {
    static func stripTrailingSlash(_ s: String) -> String {
        var s = s
        while s.hasSuffix("/") { s.removeLast() }
        return s
    }

    // Request-body builders (factored out so they can be unit-checked).
    static func anthropicBody(model: String, system: String, text: String) -> [String: Any] {
        [
            "model": model,
            "max_tokens": 4096,
            "system": system,
            "messages": [["role": "user", "content": text]],
        ]
    }

    static func chatBody(model: String, system: String, text: String) -> [String: Any] {
        [
            "model": model,
            "messages": [
                ["role": "system", "content": system],
                ["role": "user", "content": text],
            ],
            "stream": false,
        ]
    }

    private static func bodyDetail(_ data: Data) -> String {
        guard let body = String(data: data, encoding: .utf8), !body.isEmpty else { return "" }
        return ": " + String(body.prefix(300))
    }

    private static func describe(_ error: Error) -> String {
        let ns = error as NSError
        if ns.domain == NSURLErrorDomain && ns.code == NSURLErrorTimedOut {
            return "Request timed out"
        }
        if ns.domain == NSURLErrorDomain && ns.code == NSURLErrorCannotConnectToHost {
            return "connection refused"
        }
        return ns.localizedDescription
    }

    // MARK: Text correction (the overlay's Enter action)

    static func checkText(_ text: String, _ s: SettingsStore) async -> ApiResult {
        guard s.isProviderConfigured else {
            return .fail("Provider not configured. Open Settings (menu bar ▸ Settings… or ⌘,) to set it up.")
        }
        switch s.provider {
        case .anthropic: return await callAnthropic(text, s)
        case .openai: return await callOpenAI(text, s)
        case .local: return await callLocal(text, s)
        }
    }

    private static func callAnthropic(_ text: String, _ s: SettingsStore) async -> ApiResult {
        var req = URLRequest(url: URL(string: "https://api.anthropic.com/v1/messages")!)
        req.httpMethod = "POST"
        req.timeoutInterval = REQUEST_TIMEOUT
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(s.anthropicApiKey, forHTTPHeaderField: "x-api-key")
        req.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        req.httpBody = try? JSONSerialization.data(
            withJSONObject: anthropicBody(model: s.anthropicModel, system: s.systemPrompt, text: text))
        do {
            let (data, resp) = try await URLSession.shared.data(for: req)
            let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
            guard (200...299).contains(code) else {
                return .fail("Anthropic API request failed with status \(code)\(bodyDetail(data))")
            }
            let parsed = try JSONDecoder().decode(AnthropicResponse.self, from: data)
            guard let out = parsed.content?.first?.text else {
                return .fail("Unexpected response shape from Anthropic API")
            }
            return .ok(out)
        } catch {
            return .fail("Request failed: \(describe(error))")
        }
    }

    private static func callOpenAICompatible(
        url: String, apiKey: String?, model: String, system: String, text: String, label: String
    ) async -> ApiResult {
        guard let u = URL(string: url) else { return .fail("Invalid URL: \(url)") }
        var req = URLRequest(url: u)
        req.httpMethod = "POST"
        req.timeoutInterval = REQUEST_TIMEOUT
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let apiKey { req.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization") }
        req.httpBody = try? JSONSerialization.data(
            withJSONObject: chatBody(model: model, system: system, text: text))
        do {
            let (data, resp) = try await URLSession.shared.data(for: req)
            let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
            guard (200...299).contains(code) else {
                return .fail("\(label) request failed with status \(code)\(bodyDetail(data))")
            }
            let parsed = try JSONDecoder().decode(OpenAIChatResponse.self, from: data)
            guard let out = parsed.choices?.first?.message?.content else {
                return .fail("Unexpected response shape from \(label)")
            }
            return .ok(out)
        } catch {
            return .fail("Request failed: \(describe(error))")
        }
    }

    private static func callOpenAI(_ text: String, _ s: SettingsStore) async -> ApiResult {
        await callOpenAICompatible(
            url: "https://api.openai.com/v1/chat/completions",
            apiKey: s.openaiApiKey, model: s.openaiModel,
            system: s.systemPrompt, text: text, label: "OpenAI API"
        )
    }

    private static func callLocal(_ text: String, _ s: SettingsStore) async -> ApiResult {
        let endpoint = stripTrailingSlash(s.localEndpoint)
        let result = await callOpenAICompatible(
            url: "\(endpoint)/v1/chat/completions",
            apiKey: nil, model: s.localModel,
            system: s.systemPrompt, text: text, label: "Local server"
        )
        if !result.success, let e = result.error, e.contains("connection refused") {
            return .fail("Cannot connect to local server at \(endpoint). Make sure the server is running (e.g. apfel --serve, ollama serve, or LM Studio).")
        }
        return result
    }

    // MARK: Test Connection (Settings window)

    static func testAnthropic(apiKey: String, model: String) async -> TestResult {
        let probeModel = model.trimmingCharacters(in: .whitespaces).isEmpty
            ? "claude-haiku-4-5-20251001"
            : model.trimmingCharacters(in: .whitespaces)
        var req = URLRequest(url: URL(string: "https://api.anthropic.com/v1/messages")!)
        req.httpMethod = "POST"
        req.timeoutInterval = TEST_TIMEOUT
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        req.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        req.httpBody = try? JSONSerialization.data(withJSONObject: [
            "model": probeModel,
            "max_tokens": 1,
            "messages": [["role": "user", "content": "hi"]],
        ])
        do {
            let (data, resp) = try await URLSession.shared.data(for: req)
            let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
            if code == 200 { return TestResult(success: true, message: "API key valid — \"\(probeModel)\" works", error: nil, models: nil) }
            if code == 401 { return TestResult(success: false, message: nil, error: "Invalid API key", models: nil) }
            if code == 404 { return TestResult(success: false, message: nil, error: "Model \"\(probeModel)\" not found", models: nil) }
            return TestResult(success: false, message: nil, error: "Anthropic test failed with status \(code)\(bodyDetail(data))", models: nil)
        } catch {
            return TestResult(success: false, message: nil, error: describe(error), models: nil)
        }
    }

    static func testOpenAI(apiKey: String, model: String) async -> TestResult {
        var req = URLRequest(url: URL(string: "https://api.openai.com/v1/models")!)
        req.timeoutInterval = TEST_TIMEOUT
        req.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        do {
            let (data, resp) = try await URLSession.shared.data(for: req)
            let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
            if code == 200 {
                let models = (try? JSONDecoder().decode(ModelsResponse.self, from: data))?
                    .data?.compactMap { $0.id } ?? []
                let entered = model.trimmingCharacters(in: .whitespaces)
                let message = (!entered.isEmpty && !models.isEmpty && !models.contains(entered))
                    ? "API key valid, but \"\(entered)\" is not in your model list"
                    : "API key valid"
                return TestResult(success: true, message: message, error: nil, models: models)
            }
            if code == 401 { return TestResult(success: false, message: nil, error: "Invalid API key", models: nil) }
            return TestResult(success: false, message: nil, error: "OpenAI test failed with status \(code)\(bodyDetail(data))", models: nil)
        } catch {
            return TestResult(success: false, message: nil, error: describe(error), models: nil)
        }
    }

    static func testLocal(endpoint rawEndpoint: String) async -> TestResult {
        let endpoint = stripTrailingSlash(rawEndpoint)
        guard let u = URL(string: "\(endpoint)/v1/models") else {
            return TestResult(success: false, message: nil, error: "Invalid URL", models: nil)
        }
        var req = URLRequest(url: u)
        req.timeoutInterval = TEST_TIMEOUT
        do {
            let (data, resp) = try await URLSession.shared.data(for: req)
            let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
            if code == 200 {
                let models = (try? JSONDecoder().decode(ModelsResponse.self, from: data))?
                    .data?.compactMap { $0.id } ?? []
                return TestResult(success: true, message: "Connected", error: nil, models: models)
            }
            return TestResult(success: false, message: nil, error: "Local server returned status \(code)\(bodyDetail(data))", models: nil)
        } catch {
            let desc = describe(error)
            if desc.contains("connection refused") || desc.contains("could not connect") {
                return TestResult(success: false, message: nil, error: "Cannot connect to \(endpoint)", models: nil)
            }
            return TestResult(success: false, message: nil, error: desc, models: nil)
        }
    }
}
