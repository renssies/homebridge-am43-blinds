const { HomebridgePluginUiServer } = require("@homebridge/plugin-ui-utils")
const { StaticVariables } = require("../lib/AM43Device")
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

    this.connectedDevice = null

    this._discoveredDevices = []
    this._connectedDevice = null

    this._controlCharacteristics = {}

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

  buildCommandBuffer(commandID, data) {
    console.log(commandID, data)
    const bufferArray = new Uint8Array(data.length + 8)
    const startPackage = StaticVariables.AM43_COMMAND_PREFIX
    for (let index = 0; index < startPackage.length; index++) {
      bufferArray[index] = startPackage[index]
    }
    bufferArray[5] = commandID
    const uIntData = Uint8Array.from(data)
    bufferArray[6] = uIntData.length
    let bufferIndex = 7
    for (let index = 0; index < uIntData.length; index++) {
      bufferArray[bufferIndex] = uIntData[index]
      bufferIndex++
    }

    const calculateCommandChecksum = (bufferArray) => {
      let checksum = 0
      for (let i = 0; i < bufferArray.length - 1; i++) {
        checksum = checksum ^ bufferArray[i]
      }
      checksum = checksum ^ 0xff
      return checksum
    }

    bufferArray[bufferIndex] = calculateCommandChecksum(bufferArray)
    bufferIndex++

    const buffer = Buffer.from(bufferArray.buffer)
    let hexString = buffer.toString("hex")
    console.log("Comamnd", hexString)
    return buffer
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
        [StaticVariables.AM43_SERVICE_ID],
        [StaticVariables.AM43_CHARACTERISTIC_ID],
        (error, services, characteristics) => {
          console.log(error)
          this._controlCharacteristics[device_id] = characteristics[0]
          resolve(this._controlCharacteristics[device_id])
        }
      )
    })
  }

  async handleChangeNameRequest({ device_id, new_name }) {
    const controlCharacteristic = await this.getControlCharacteristic(device_id)
    const data = new_name.split("").map((letter) => letter.charCodeAt(0))
    await controlCharacteristic.writeAsync(
      this.buildCommandBuffer(StaticVariables.AM43_COMMAND_CHANGE_NAME, data),
      true
    )
    return {}
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
