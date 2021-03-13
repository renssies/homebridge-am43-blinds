const { HomebridgePluginUiServer } = require("@homebridge/plugin-ui-utils")
const noble = require("@abandonware/noble")

// your class MUST extend the HomebridgePluginUiServer
class AM43UiServer extends HomebridgePluginUiServer {
  constructor() {
    super()

    this.onRequest("/scan_for_devices", (...args) =>
      this.handleScanRequest(...args)
    )

    this.ready()
  }

  async handleScanRequest({ scan_time }) {
    return new Promise((resolve, reject) => {
      const deviceList = []

      noble.on("discover", (device) => {
        deviceList.push(device)
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
  return new AM43UiServer()
})()
