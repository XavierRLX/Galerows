import Foundation
import Capacitor
import Darwin

/// iOS mirror of Android's passive _galerows._tcp. DNS-SD announcements are
/// UNTRUSTED locators: they are never admission tokens or proof of host identity.
@objc(GalerowsRoomDiscoveryPlugin)
public final class GalerowsRoomDiscoveryPlugin: CAPPlugin, CAPBridgedPlugin, NetServiceBrowserDelegate, NetServiceDelegate {
    public let identifier = "GalerowsRoomDiscoveryPlugin"
    public let jsName = "GalerowsRoomDiscovery"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startScan", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopScan", returnType: CAPPluginReturnPromise),
    ]

    private var browser: NetServiceBrowser?
    private var resolving: [String: NetService] = [:]
    private var discovered = Set<String>()
    private var scanning = false
    private let serviceType = "_galerows._tcp."

    @objc public func startScan(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if self.scanning { call.resolve(); return }
            self.scanning = true
            self.resolving.removeAll()
            self.discovered.removeAll()
            let browser = NetServiceBrowser()
            browser.delegate = self
            self.browser = browser
            browser.searchForServices(ofType: self.serviceType, inDomain: "local.")
            call.resolve()
        }
    }

    @objc public func stopScan(_ call: CAPPluginCall) {
        DispatchQueue.main.async { self.stopInternal(); call.resolve() }
    }

    private func stopInternal() {
        scanning = false
        browser?.stop()
        browser?.delegate = nil
        browser = nil
        for service in resolving.values { service.stop(); service.delegate = nil }
        resolving.removeAll()
        discovered.removeAll()
    }

    public func netServiceBrowser(_ browser: NetServiceBrowser, didFind service: NetService, moreComing: Bool) {
        guard scanning, service.type == serviceType,
              service.name.range(of: "^Galerows-[A-Za-z0-9]{4,16}$", options: .regularExpression) != nil,
              resolving.count < 48 else { return }
        resolving[service.name] = service
        service.delegate = self
        service.resolve(withTimeout: 5)
    }

    public func netServiceBrowser(_ browser: NetServiceBrowser, didRemove service: NetService, moreComing: Bool) {
        resolving.removeValue(forKey: service.name)?.stop()
        if discovered.remove(service.name) != nil {
            notifyListeners("lanRoomDiscovery", data: ["type": "lost", "id": service.name])
        }
    }

    public func netServiceBrowser(_ browser: NetServiceBrowser, didNotSearch errorDict: [String: NSNumber]) {
        guard scanning else { return }
        notifyListeners("lanRoomDiscovery", data: ["type": "error"])
        stopInternal()
    }

    public func netServiceDidResolveAddress(_ sender: NetService) {
        guard scanning, resolving[sender.name] === sender,
              !discovered.contains(sender.name),
              let raw = sender.txtRecordData() else { return }
        let attrs = NetService.dictionary(fromTXTRecord: raw)
        func attr(_ key: String, _ max: Int) -> String? {
            guard let data = attrs[key], data.count <= max else { return nil }
            return String(data: data, encoding: .utf8)
        }
        guard attr("app", 16) == "galerows", attr("v", 1) == "2",
              let code = attr("code", 6), code.range(of: "^[0-9]{6}$", options: .regularExpression) != nil,
              let room = attr("room", 64), room.range(of: "^[A-Za-z0-9_-]{1,64}$", options: .regularExpression) != nil,
              let fingerprint = attr("fp", 64), fingerprint.range(of: "^[0-9a-f]{64}$", options: .regularExpression) != nil,
              sender.port > 0, sender.port <= 65535,
              let ip = sender.addresses?.compactMap(numericIPv4).first(where: isPrivateIPv4)
        else { return }
        discovered.insert(sender.name)
        notifyListeners("lanRoomDiscovery", data: [
            "type": "found", "id": sender.name, "label": sender.name,
            "roomId": room, "code": code, "fingerprint": fingerprint,
            "hostIp": ip, "port": sender.port,
        ])
    }

    public func netService(_ sender: NetService, didNotResolve errorDict: [String: NSNumber]) {
        resolving.removeValue(forKey: sender.name)
    }

    private func numericIPv4(_ data: Data) -> String? {
        return data.withUnsafeBytes { raw in
            guard raw.count >= MemoryLayout<sockaddr_in>.size,
                  let address = raw.baseAddress?.assumingMemoryBound(to: sockaddr.self),
                  address.pointee.sa_family == sa_family_t(AF_INET) else { return nil }
            var output = [CChar](repeating: 0, count: Int(NI_MAXHOST))
            let status = output.withUnsafeMutableBufferPointer { chars in
                getnameinfo(address, socklen_t(raw.count), chars.baseAddress,
                            socklen_t(chars.count), nil, 0, NI_NUMERICHOST)
            }
            guard status == 0 else { return nil }
            return String(cString: output)
        }
    }

    private func isPrivateIPv4(_ value: String) -> Bool {
        let bits = value.split(separator: ".").compactMap { UInt8($0) }
        guard bits.count == 4 else { return false }
        return bits[0] == 10 || bits[0] == 192 && bits[1] == 168 ||
            bits[0] == 172 && (16...31).contains(bits[1]) ||
            bits[0] == 169 && bits[1] == 254 ||
            bits[0] == 100 && (64...127).contains(bits[1])
    }

    deinit { browser?.stop(); resolving.values.forEach { $0.stop() } }
}

/// Capacitor 8 local plugins are registered explicitly, not silently assumed.
final class GalerowsBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(GalerowsRoomDiscoveryPlugin())
    }
}
