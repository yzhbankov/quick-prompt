import AppKit
import Carbon.HIToolbox

/// Registers a system-wide hotkey via Carbon's RegisterEventHotKey.
///
/// Unlike a CGEvent tap, this requires **no** Accessibility permission —
/// matching Electron's `globalShortcut` behavior.
final class GlobalHotKey {
    private var hotKeyRef: EventHotKeyRef?
    private var eventHandler: EventHandlerRef?
    private let handler: () -> Void

    /// ⌘⇧G — key code 5 is ANSI "G".
    init?(handler: @escaping () -> Void) {
        self.handler = handler

        let signature = "QPmt".fourCharCode
        let hotKeyID = EventHotKeyID(signature: signature, id: 1)

        var eventType = EventTypeSpec(
            eventClass: OSType(kEventClassKeyboard),
            eventKind: UInt32(kEventHotKeyPressed)
        )

        let selfPtr = Unmanaged.passUnretained(self).toOpaque()

        let installStatus = InstallEventHandler(
            GetApplicationEventTarget(),
            { _, eventRef, userData in
                guard let userData, let eventRef else { return noErr }
                var hkID = EventHotKeyID()
                GetEventParameter(
                    eventRef, EventParamName(kEventParamDirectObject),
                    EventParamType(typeEventHotKeyID), nil,
                    MemoryLayout<EventHotKeyID>.size, nil, &hkID
                )
                let me = Unmanaged<GlobalHotKey>.fromOpaque(userData).takeUnretainedValue()
                DispatchQueue.main.async { me.handler() }
                return noErr
            },
            1, &eventType, selfPtr, &eventHandler
        )
        guard installStatus == noErr else { return nil }

        // Try ⌘⇧G first, then ⌘⇧Space — matching the Electron fallback order.
        let modifiers = UInt32(cmdKey | shiftKey)
        let candidates: [UInt32] = [UInt32(kVK_ANSI_G), UInt32(kVK_Space)]
        var registered = false
        for code in candidates {
            if RegisterEventHotKey(code, modifiers, hotKeyID,
                                   GetApplicationEventTarget(), 0, &hotKeyRef) == noErr {
                registered = true
                break
            }
        }
        guard registered else { return nil }
    }

    deinit {
        if let hotKeyRef { UnregisterEventHotKey(hotKeyRef) }
        if let eventHandler { RemoveEventHandler(eventHandler) }
    }
}

private extension String {
    var fourCharCode: FourCharCode {
        var code: FourCharCode = 0
        for scalar in unicodeScalars.prefix(4) {
            code = (code << 8) + FourCharCode(scalar.value & 0xFF)
        }
        return code
    }
}
