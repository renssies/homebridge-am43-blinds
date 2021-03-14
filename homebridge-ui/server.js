const { HomebridgePluginUiServer } = require("@homebridge/plugin-ui-utils")
const noble = require("@abandonware/noble")

// your class MUST extend the HomebridgePluginUiServer
class UiServer extends HomebridgePluginUiServer {
  constructor() {
    // super must be called first
    super()

    // Example: create api endpoint request handlers (example only)
    this.onRequest("/hello", this.handleHelloRequest.bind(this))
    this.onRequest("/scan_for_devices", (...args) =>
      this.handleScanRequest(...args)
    )

    // this.ready() must be called to let the UI know you are ready to accept api calls
    this.ready()
  }

  /**
   * Example only.
   * Handle requests made from the UI to the `/hello` endpoint.
   */
  async handleHelloRequest(payload) {
    return { hello: "world" }
  }

  async handleScanRequest({ scan_time }) {
    return new Promise((resolve, reject) => {
      const deviceList = []

      noble.on("discover", (device) => {
        deviceList.push(device)
        this.pushEvent("device-discovered", {
          address: device.address,
          localName: device.advertisement.localName,
        })
      })

      noble.on("scanStop", async () => {
        resolve(
          deviceList.map(({ address, advertisement: { localName } }) => ({
            address,
            localName,
          }))
        )
      })
      noble.startScanning(["fe50"], false, (error) => {
        if (error) reject(error)
      })
      setTimeout(() => noble.stopScanning(), scan_time)
    })
  }
}

// start the instance of the class
;(() => {
  return new UiServer()
})()
