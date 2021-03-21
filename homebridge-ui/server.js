const { HomebridgePluginUiServer } = require("@homebridge/plugin-ui-utils")
const { DeviceValues } = require("../lib/utils/values")
const { buildCommandBuffer } = require("../lib/utils/commands")
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
    this.onRequest("/rename_device", (...args) =>
      this.handleChangeNameRequest(...args)
    )

    this.onRequest("/ble_reset", (...args) => this.handleBLEReset(...args))

    this.onRequest("/auth_with_passcode", (...args) =>
      this.handleAuthWithPasscode(...args)
    )

    this.connectedDevice = null

    this._discoveredDevices = []
    this._connectedDevice = null

    this._controlCharacteristics = {}

    this.ready()
  }

  deviceToObject(device) {
    const { address, advertisement } = device
    const { localName, rssi } = advertisement
    const id = this._discoveredDevices.indexOf(device)
    return { address, rssi, localName, id }
  }

  async handleScanRequest({ scan_time }) {
    if (this._connectedDevice) {
      await this._connectedDevice.disconnectAsync()
    }

    return new Promise((resolve, reject) => {
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

  async connectToDevice(device_id) {
    const device = this._discoveredDevices[device_id]
    if (this._connectedDevice === device) return device

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

        device.once("disconnect", () => {
          this._connectedDevice = null
          this._controlCharacteristics[device_id] = null
        })

        resolve(device)
      })
    })
  }

  async handleConnectRequest({ device_id }) {
    return this.connectToDevice(device_id).then((device) =>
      this.deviceToObject(device)
    )
  }

  async getControlCharacteristic(device_id) {
    if (this._controlCharacteristics[device_id]) {
      console.log("already connected")
      return this._controlCharacteristics[device_id]
    }

    console.log("connecting")
    const device = await this.connectToDevice(device_id)
    console.log("connected!")

    return new Promise((resolve, reject) => {
      device.discoverSomeServicesAndCharacteristics(
        [DeviceValues.AM43_SERVICE_ID],
        [DeviceValues.AM43_CHARACTERISTIC_ID],
        (error, _, characteristics) => {
          console.log(error)
          if (error) {
            // device.disconnect(() => {
            reject(error)
            // })
            return
          }
          this._controlCharacteristics[device_id] = characteristics[0]

          const notificationToEvent = {
            "9a35015a31": "name-change-success",
            "9a1701a5ce": "auth-error",
            "9a17015a31": "auth-success",
          }

          this._controlCharacteristics[device_id].on(
            "data",
            (data, isNotification) => {
              // console.log(data.toString("hex"))
              const eventName = notificationToEvent[data.toString("hex")]
              if (eventName) this.pushEvent(eventName)
            }
          )

          console.log(this._controlCharacteristics[device_id].off)

          resolve(this._controlCharacteristics[device_id])
        }
      )
    })
  }

  async handleAuthWithPasscode({ device_id, passcode }) {
    const controlCharacteristic = await this.getControlCharacteristic(device_id)
    await new Promise((resolve) => setTimeout(resolve, 500))

    const data16Bit = new Uint16Array([parseInt(passcode)])
    const data = new Uint8Array(data16Bit.buffer).reverse()

    const commandBuffer = buildCommandBuffer(
      DeviceValues.AM43_COMMAND_PASSCODE,
      data
    )
    await controlCharacteristic.writeAsync(commandBuffer, true)

    return "OK"
  }

  async handleChangeNameRequest({ device_id, new_name }) {
    const controlCharacteristic = await this.getControlCharacteristic(device_id)
    const data = new_name
      .split("")
      .map((letter) => letter.charCodeAt(0))
      .map((value) => (value > 254 ? "?".charCodeAt(0) : value))
    await new Promise((resolve) => setTimeout(resolve, 500))
    await controlCharacteristic.writeAsync(
      buildCommandBuffer(DeviceValues.AM43_COMMAND_CHANGE_NAME, data),
      true
    )

    // const {services, characteristics} = this._connectedDevice.discoverAllServicesAndCharacteristicsAsync();

    // console.log(services)
    // console.log(characteristics)
    // await this._connectedDevice.updateRssiAsync()
    return this.deviceToObject(this._connectedDevice)
  }

  async handleBLEReset({}) {
    try {
      noble.reset()
      this.pushEvent("reset-success")
    } catch (err) {
      this.pushEvent("reset-fail")
      return err
    }

    this._connectedDevice = null
    this._controlCharacteristics = {}

    return "OK"
  }
}

;(() => {
  return new AM43UiServer()
})()
