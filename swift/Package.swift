// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "QuickPrompt",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(
            name: "QuickPrompt",
            path: "Sources/QuickPrompt"
        )
    ]
)
