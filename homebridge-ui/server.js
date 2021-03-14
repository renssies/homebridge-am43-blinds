const { HomebridgePluginUiServer } = require("@homebridge/plugin-ui-utils")
const noble = require("@abandonware/noble")

class AM43UiServer extends HomebridgePluginUiServer {
  constructor() {
    super()
    this.onRequest("/scan_for_devices", (...args) =>
      this.handleScanRequest(...args)
    )
    this.onRequest("/connect_to_device", (...args) =>
      this.handleConnectRequest(...args)
    )

    this.connectedDevice = null

    this._discoveredDevices = []
    this._connectedDevice = null

    // noble.reset();

    this.ready()
  }

  deviceToObject(device) {
    const { address, advertisement } = device
    const { localName, rssi } = advertisement
    const id = this._discoveredDevices.indexOf(device)
    return { address, rssi, localName, id }
  }

  async handleScanRequest({ scan_time }) {
    return new Promise((resolve, reject) => {
      if (this._connectedDevice) {
        noble.reset()
      }

      this._discoveredDevices = []

      let hasEnded = false

      const discoverDevice = (device) => {
        if (!hasEnded) {
          this._discoveredDevices.push(device)
          this.pushEvent("device-discovered", this.deviceToObject(device))
          noble.once("discover", discoverDevice)
        }
      }

      noble.once("discover", discoverDevice)

      noble.once("scanStop", async () => {
        resolve(this._discoveredDevices.map((dev) => this.deviceToObject(dev)))
      })
      noble.startScanning(["fe50"], false, (error) => {
        if (error) reject(error)
      })
      setTimeout(() => {
        hasEnded = true
        noble.stopScanning()
      }, scan_time)
    })
  }

  async handleConnectRequest({ device_id }) {
    const device = this._discoveredDevices[device_id]

    return new Promise((resolve, reject) => {
      if (!device) {
        reject(new Error(`Device ${device_id} not found`))
        return
      }
      device.connect((err) => {
        console.log(err)
        if (err) reject(err)
      })
      device.once("connect", () => {
        this._connectedDevice = device
        this.pushEvent("device-connected", this.deviceToObject(device))
        resolve(this.deviceToObject(device))
      })
    })
  }
}

;(() => {
  return new AM43UiServer()
})()
