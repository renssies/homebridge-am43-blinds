const EventEmitter = require("events").EventEmitter
const { buildCommandBuffer } = require("./utils/commands")
const { DeviceValues } = require("./utils/values")
const debug = require("debug")("AM43")

class AM43Device extends EventEmitter {
  constructor(peripheral) {
    super()

    this.peripheral = peripheral
    if (peripheral.localName) {
      this.name = peripheral.localName
    } else if (peripheral.advertisement.localName) {
      this.name = peripheral.advertisement.localName
    } else if (peripheral.address) {
      this.name = peripheral.address
    } else {
      let name = "AM43 Blind"
      if (peripheral.id) {
        name += " "
        name += peripheral.id
      }
      this.name = name
    }
    if (peripheral.id) {
      this.id = peripheral.id
    } else if (peripheral.uuid) {
      this.id = peripheral.uuid
    } else if (peripheral.address) {
      this.id = peripheral.address
    } else {
      this.id = this.name
    }
    this.address = peripheral.address

    let addressDesc =
      this.peripheral.address != null
        ? this.peripheral.address
        : this.peripheral.id
    this.description = this.name + " (" + addressDesc + ")"

    this.isConnected = false
    this.peripheral.on("connect", () => {
      this.debugLog(`Device connected: ${this.id}`)
      this.isConnected = true
    })
    this.peripheral.on("disconnect", () => {
      this.debugLog(`Device disconnected: ${this.id}`)
      this.connectingPromise = null
      this.discoveringPromise = null
      this.blindsControlCharacteristic = null
      this.isConnected = false
    })
    this.blindsControlCharacteristic = null
    this.position = 0
    this.targetPosition = null
    this.direction = 2 // 0: Down/Decreating, 1: Up/Increasing, 2: Stopped
    this.batteryPercentage = 50

    this.positionHistory = []
  }

  debugLog(info) {
    debug(`${this.description}: ${info}`)
  }

  setBlindsControlCharacteristic(characteristic) {
    this.blindsControlCharacteristic = characteristic
    this.blindsControlCharacteristic.on("data", (data) => {
      this.debugLog("--------Notification--------")
      const dataArray = new Uint8Array(data)
      this.debugLog(`Data received:` + dataArray)
      let percentage = null

      switch (data[1]) {
        case DeviceValues.AM43_COMMAND_ID_GET_POSITION:
          this.debugLog("Position update received")
          percentage = parseInt(dataArray[5])
          this.debugLog(`Closed Percentage ${percentage}`)
          this.position = percentage

          this.positionHistory.unshift(percentage)
          this.positionHistory.length = Math.min(
            DeviceValues.POSITION_HISTORY_LENGTH,
            this.positionHistory.length
          )

          this.emit("position", this.position)
          break

        case DeviceValues.AM43_COMMAND_ID_GET_LIGHTSENSOR:
          this.debugLog("light sensor update received")
          percentage = parseInt(dataArray[4])
          this.debugLog(`Light level ${percentage}`)
          this.emit("lightLevel", percentage)
          break

        case DeviceValues.AM43_COMMAND_ID_GET_BATTERYSTATUS:
          this.debugLog("Battery Status update received")
          percentage = parseInt(dataArray[7])
          this.debugLog(`Battery Percentage ${percentage}`)
          this.batteryPercentage = percentage
          this.emit("batteryPercentage", this.batteryPercentage)
          break

        case DeviceValues.AM43_NOTIFY_POSITION:
          this.debugLog("Position notify received")
          percentage = parseInt(dataArray[4])
          this.debugLog(`Closed Percentage ${percentage}`)
          this.position = percentage

          this.positionHistory.unshift(percentage)
          this.positionHistory.length = Math.min(
            DeviceValues.POSITION_HISTORY_LENGTH,
            this.positionHistory.length
          )

          this.emit("position", this.position)
          break

        case DeviceValues.AM43_COMMAND_ID_SET_MOVE:
          this.debugLog("Set move notify received")
          if (dataArray[3] == DeviceValues.AM43_RESPONSE_ACK) {
            this.debugLog("Set move acknowledged")
          } else if (dataArray[3] == AM43_RESPONSE_NACK) {
            this.debugLog("Set move denied")
          }
          break

        case DeviceValues.AM43_COMMAND_ID_SET_POSITION:
          this.debugLog("Set position notify received")
          if (dataArray[3] == DeviceValues.AM43_RESPONSE_ACK) {
            this.debugLog("Set position acknowledged")
          } else if (dataArray[3] == DeviceValues.AM43_RESPONSE_NACK) {
            this.debugLog("Set position denied")
          }
          break

        default:
          break
      }

      if (this.targetPosition != null && this.position != null) {
        let direction = this.targetPosition < this.position ? 1 : 0
        let targetPosition = this.targetPosition
        if (this.position == this.targetPosition || this.checkIfStopped()) {
          this.debugLog(
            `Target position ${this.targetPosition} reached @ ${this.position}`
          )
          targetPosition = null
        }
        if (targetPosition == null) {
          direction = 2
        }
        if (direction != this.direction) {
          this.direction = direction
          this.emit("direction", this.direction)
        }
        if (targetPosition != this.targetPosition) {
          this.targetPosition = targetPosition
          this.emit("targetPosition", this.targetPosition)
        }
      }
    })

    this.blindsControlCharacteristic.subscribe((error) => {
      if (error) {
        this.debugLog("Failed to subsribe to notifications")
      } else {
        this.debugLog("Subscribed to notifications")
      }
    })

    this.connectingPromise = null
    this.discoveringPromise = null
  }

  async prepareAsync() {
    if (!this.isConnected) {
      await this.connectAsync()
    }
    await this.updatePositionAsync()
  }

  async connectAsync() {
    if (!this.isConnected) {
      if (this.connectingPromise == null) {
        this.connectingPromise = this.peripheral.connectAsync()
      }
      await this.connectingPromise
      this.connectingPromise = null
    }
    if (this.discoveringPromise == null) {
      this.discoveringPromise =
        this.peripheral.discoverSomeServicesAndCharacteristicsAsync(
          [DeviceValues.AM43_SERVICE_ID],
          [DeviceValues.AM43_CHARACTERISTIC_ID]
        )
    }
    const { characteristics } = await this.discoveringPromise
    this.discoveringPromise = null
    this.setBlindsControlCharacteristic(characteristics[0])
  }

  async disconnectAsync() {
    this.isConnected = false
    this.connectingPromise = null
    this.discoveringPromise = null
    this.blindsControlCharacteristic = null
    await this.peripheral.disconnectAsync()
  }

  async enableNotificationsAsync() {
    try {
      await this.blindsControlCharacteristic.subscribeAsync()
      this.debugLog("Subscribed to notifications")
    } catch (e) {
      this.debugLog("Failed to subsribe to notifications")
    }
  }

  async setPositionAsync(position, trackPosition) {
    this.targetPosition = position
    await this.sendCommandAsync(DeviceValues.AM43_COMMAND_ID_SET_POSITION, [
      position,
    ])
    if (trackPosition == true) {
      this.trackCurrentPosition()
    }
  }

  trackCurrentPosition() {
    setTimeout(async () => {
      await this.updatePositionAsync()
      if (this.targetPosition != null) {
        this.trackCurrentPosition()
      }
    }, 1000)
  }

  checkIfStopped() {
    if (this.positionHistory.length < DeviceValues.POSITION_HISTORY_LENGTH)
      return false
    return this.positionHistory.every((v) => v === this.positionHistory[0])
  }

  async openAsync() {
    this.targetPosition = 0
    this.direction = 1
    await this.sendCommandAsync(DeviceValues.AM43_COMMAND_ID_SET_MOVE, [
      AM43_MOVE_OPEN,
    ])
    this.emit("direction", this.direction)
    this.emit("targetPosition", this.targetPosition)
  }

  async closeAsync() {
    this.targetPosition = 100
    this.direction = 0
    await this.sendCommandAsync(DeviceValues.AM43_COMMAND_ID_SET_MOVE, [
      AM43_MOVE_CLOSE,
    ])
    this.emit("direction", this.direction)
    this.emit("targetPosition", this.targetPosition)
  }

  async stopAsync() {
    this.targetPosition = null
    this.direction = 2
    await this.sendCommandAsync(DeviceValues.AM43_COMMAND_ID_SET_MOVE, [
      AM43_MOVE_STOP,
    ])
    this.emit("direction", this.direction)
    this.emit("targetPosition", this.targetPosition)
  }

  async updatePositionAsync() {
    await this.sendCommandAsync(DeviceValues.AM43_COMMAND_ID_GET_POSITION, [
      0x1,
    ])
  }

  async updateBatteryStatusAsync() {
    await this.sendCommandAsync(
      DeviceValues.AM43_COMMAND_ID_GET_BATTERYSTATUS,
      [0x1]
    )
  }

  async updateLightSensorAsync() {
    await this.sendCommandAsync(DeviceValues.AM43_COMMAND_ID_GET_LIGHTSENSOR, [
      0x1,
    ])
  }

  async sendCommandAsync(commandID, data) {
    if (!this.isConnected) {
      await this.connectAsync()
    }
    this.debugLog("--------Command--------")
    this.debugLog(`Sending command to device: ${this.id}`)
    const buffer = buildCommandBuffer(commandID, data)
    let hexString = buffer.toString("hex")
    this.debugLog(`Sending command: ${hexString}`)
    this.debugLog(
      `Blinds characteristic available: ${
        this.blindsControlCharacteristic !== null &&
        this.blindsControlCharacteristic !== undefined
      }`
    )
    try {
      await this.blindsControlCharacteristic.writeAsync(buffer, true)
    } catch (error) {
      this.debugLog(`Failed write command with error: ${error}`)
    }
  }
}

module.exports = {
  AM43Device: AM43Device,
  DeviceVariables: DeviceValues,
}
