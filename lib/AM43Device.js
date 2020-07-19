const noble = require("@abandonware/noble");
const { dir } = require("console");
var EventEmitter = require('events').EventEmitter;

class AM43Device extends EventEmitter {

    static AM43_SERVICE_ID = "fe50"
    static AM43_CHARACTERISTIC_ID = "fe51"

    static AM43_COMMAND_PREFIX = Uint8Array.from([0x00, 0xff, 0x00, 0x00, 0x9a])
    static AM43_COMMAND_ID_SET_MOVE = 0x0A

    static AM43_MOVE_OPEN = 0xDD
    static AM43_MOVE_CLOSE = 0xEE
    static AM43_MOVE_STOP = 0xCC

    static AM43_COMMAND_ID_SET_POSITION = 0x0D
    static AM43_COMMAND_ID_GET_POSITION = 0xA7
    static AM43_COMMAND_ID_GET_LIGHTSENSOR = 0xAA
    static AM43_COMMAND_ID_GET_BATTERYSTATUS = 0xA2

    static AM43_RESPONSE_ACK = 0x5A
    static AM43_RESPONSE_NACK = 0xA5

    static AM43_NOTIFY_POSITION = 0xA1

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
            var name = "AM43 Blind" 
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

        let addressDesc = this.peripheral.address != null ? this.peripheral.address : this.peripheral.id
        this.description = this.name + " (" + addressDesc + ")"

        this.isConnected = false
        this.peripheral.on('connect', () => {
            this.debugLog(`Device connected: ${this.id}`)
            this.isConnected = true
        })
        this.peripheral.on('disconnect', () => {
            this.debugLog(`Device disconnected: ${this.id}`)
            this.isConnected = false
        })
        this.blindsControlCharacteristic = null
        this.position = 0
        this.targetPosition = null
        this.direction = 2 // 0: Down/Decreating, 1: Up/Increasing, 2: Stopped
        this.batteryPercentage = 50
    }

    debugLog(info) {
        //console.log(info)
    }

    setBlindsControlCharacteristic(characteristic) {
        this.blindsControlCharacteristic = characteristic
        this.blindsControlCharacteristic.on('data', (data) => {
            this.debugLog("--------Notification--------")
            var dataArray = new Uint8Array(data)
            this.debugLog(`Data received:` + dataArray)
    
            if (data[1] == AM43Device.AM43_COMMAND_ID_GET_POSITION) {
                this.debugLog("Position update received");
                let percentage = parseInt(dataArray[5])
                this.debugLog(`Closed Percentage ${percentage}`)
                this.position = percentage
                this.emit('position', this.position)
    
            } else if (data[1] == AM43Device.AM43_COMMAND_ID_GET_LIGHTSENSOR) {
                this.debugLog("light sensor update received");
                let percentage = parseInt(dataArray[5])
                this.debugLog(`Light lebel ${percentage}`)
    
            } else if (data[1] == AM43Device.AM43_COMMAND_ID_GET_BATTERYSTATUS) {
                this.debugLog("Battery Status update received");
                let percentage = parseInt(dataArray[7])
                this.debugLog(`Battery Percentage ${percentage}`)
                this.batteryPercentage = percentage
                this.emit("batteryPercentage", this.batteryPercentage)
                
            } else if (data[1] == AM43Device.AM43_NOTIFY_POSITION) {
                this.debugLog("Position notify received");
                let percentage = parseInt(dataArray[4])
                this.debugLog(`Closed Percentage ${percentage}`)
                this.position = percentage
                this.emit('position', this.position)
            } else if (data[1] == AM43Device.AM43_COMMAND_ID_SET_MOVE) {
                this.debugLog("Set move notify received");
                if (dataArray[3] == AM43Device.AM43_RESPONSE_ACK) {
                    this.debugLog("Set move acknowledged")
                } else if (dataArray[3] == AM43_RESPONSE_NACK) {
                    this.debugLog("Set move denied")
                }
    
            } else if (data[1] == AM43Device.AM43_COMMAND_ID_SET_POSITION) {
                this.debugLog("Set position notify received");
                if (dataArray[3] == AM43Device.AM43_RESPONSE_ACK) {
                    this.debugLog("Set position acknowledged")
                } else if (dataArray[3] == AM43Device.AM43_RESPONSE_NACK) {
                    this.debugLog("Set position denied")
                }
            }
             
            if (this.targetPosition != null && this.position != null) {
                var direction = this.targetPosition < this.position ? 1 : 0
                var targetPosition = this.targetPosition
                if (this.position == this.targetPosition) {
                    this.debugLog(`Target position reached, position: ${this.position}, target: ${this.targetPosition}`)
                    targetPosition = null
                } else if (direction == 1 && this.targetPosition - this.position >= 1) {
                    this.debugLog(`Target position reached, position: ${this.position}, target: ${this.targetPosition}, }, diff: ${this.targetPosition - this.position}`)
                    targetPosition = null
                } else if (direction == 0 && this.position - this.targetPosition >= 1) {
                    this.debugLog(`Target position reached, position: ${this.position}, target: ${this.targetPosition}, diff: ${this.position - this.targetPosition}`)
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
    }

    async prepareAsync() {
        await this.connectAsync()
        await this.updatePositionAsync()
    }

    async connectAsync() {
        if (!this.isConnected) {
            await this.peripheral.connectAsync()
        }
        let {characteristics} = await this.peripheral.discoverSomeServicesAndCharacteristicsAsync([AM43Device.AM43_SERVICE_ID], [AM43Device.AM43_CHARACTERISTIC_ID])
        this.setBlindsControlCharacteristic(characteristics[0])
    }

    async disconnectAsync() {
        this.isConnected = false
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
        await this.sendCommandAsync(AM43Device.AM43_COMMAND_ID_SET_POSITION, [position])
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
    
    async openAsync() {
        this.targetPosition = 0
        this.direction = 1
        await this.sendCommandAsync(AM43Device.AM43_COMMAND_ID_SET_MOVE, [AM43_MOVE_OPEN])
        this.emit("direction", this.direction)
        this.emit("targetPosition", this.targetPosition)
    }
    
    async closeAsync() {
        this.targetPosition = 100
        this.direction = 0
        await this.sendCommandAsync(AM43Device.AM43_COMMAND_ID_SET_MOVE, [AM43_MOVE_CLOSE])
        this.emit("direction", this.direction)
        this.emit("targetPosition", this.targetPosition)
    }
    
    async stopAsync() {
        this.targetPosition = null
        this.direction = 2
        await this.sendCommandAsync(AM43Device.AM43_COMMAND_ID_SET_MOVE, [AM43_MOVE_STOP])
        this.emit("direction", this.direction)
        this.emit("targetPosition", this.targetPosition)
    }
    
    async updatePositionAsync() {
        if (!this.blindsControlCharacteristic) {
            return
        }
        await this.sendCommandAsync(AM43Device.AM43_COMMAND_ID_GET_POSITION, [0x1])
    }

    async updateBatteryStatusAsync() {
        if (!this.blindsControlCharacteristic) {
            return
        }
        await this.sendCommandAsync(AM43Device.AM43_COMMAND_ID_GET_BATTERYSTATUS, [0x1])
    }

    async sendCommandAsync(commandID, data) {
        if (!this.isConnected) {
            await this.connectAsync()
        }
        this.debugLog("--------Command--------")
        this.debugLog(`Sending command to device: ${this.id}`)
        var bufferArray = new Uint8Array(data.length + 8)
        var startPackage = AM43Device.AM43_COMMAND_PREFIX
        for (var index = 0; index < startPackage.length; index++) {
            bufferArray[index] = startPackage[index];
        }
        bufferArray[5] = commandID
        var uIntData = Uint8Array.from(data)
        bufferArray[6] = uIntData.length
        var bufferIndex = 7
        for (var index = 0; index < uIntData.length; index++) {
            bufferArray[bufferIndex] = uIntData[index]
            bufferIndex++
        }
        bufferArray[bufferIndex] = this.calculateCommandChecksum(bufferArray)
        bufferIndex++
    
        var buffer = Buffer.from(bufferArray.buffer)
        let hexString = buffer.toString('hex')
        this.debugLog(`Sending command: ${hexString}`)
        await this.blindsControlCharacteristic.writeAsync(buffer, true)
    }

    calculateCommandChecksum(bufferArray) {
        var checksum = 0
        for (var i = 0; i < bufferArray.length - 1; i++) {
            checksum = checksum ^ bufferArray[i]
        }   
        checksum = checksum ^ 0xff;
        return checksum
    }

}

module.exports = AM43Device