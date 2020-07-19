const AM43Device = require("./AM43Device")
const packageJSON = require('../package.json')
const noble = require("@abandonware/noble");

class AM43Platform {
    constructor(log, config, api) {
        log.info("Starting AM43 platform")
        this.configJSON = config
        this.packageJSON = packageJSON
        this.log = log
        this.api = api
        this.accessories = []

        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;

        api.on('didFinishLaunching', () => {
            this.didFinishedLaunching()
        })

        api.on('shutdown', () => {
            this.shutdown()
        })
    }

    didFinishedLaunching() {
        // Start scanning with noble!
        noble.on('discover', (peripheral) => {
            let device = new AM43Device(peripheral)
            
            let uuid = this.api.hap.uuid.generate(device.id)
            let existingAccesory = this.accessories.find(accessory => accessory.UUID == uuid)
            if (!existingAccesory) {
                this.log.info("Found new AM43 Motor: " + device.description)
                let accessory = this.createAccessory(device, uuid)
                this.configureServicesOnAccessory(accessory)
                this.configureDeviceOnAccessory(accessory, device)
                this.api.registerPlatformAccessories('homebridge-am43-blinds', 'am43-blinds', [accessory]);
            } else {
                this.log.info("Found existing AM43 Motor: " + device.description)
                this.configureDeviceOnAccessory(existingAccesory, device)
            }
        })

        noble.startScanning([AM43Device.AM43_SERVICE_ID])
        setTimeout(() => {
            noble.stopScanning((error) => {
                if (!error) {
                    let devices = this.accessories.filter(accessory => accessory.am43device != null)
                    this.log.info("Stopped searching for AM43 Blinds, found " + devices.length + " devices")
                    return
                }
                this.log.error("Failed to stop searching for AM43 blinds")
             })
        }, 10000)
    }

    shutdown() {
        this.log.info("Homebridge is shutting down, disconnecting AM43 motors and saving state")
        this.accessories.forEach((accessory) => {
            if (!accessory.am43device) {
                return
            }
            accessory.context.am43.lastPosition = accessory.am43device.position
            accessory.context.am43.lastBatteryPercentage = accessory.am43device.batteryPercentage
            accessory.am43device.disconnectAsync()
        })   
    }

    configureAccessory(accessory) {
        accessory.updateReachability(false)
        this.configureServicesOnAccessory(accessory)
        accessory.log = this.log
        this.accessories.push(accessory)
    }

    createAccessory(device, uuid) {
        let accessory = new this.api.platformAccessory(device.name, uuid)
        accessory.am43device = device
        accessory.log = this.log
        return accessory
    }

    configureDeviceOnAccessory(accessory, device) {
        accessory.updateReachability(true)
        accessory.am43device = device
        if (!accessory.context.am43) {
            accessory.context.am43 = {}
        }
        accessory.context.am43.id = device.id
        accessory.context.am43.address = device.address
        if (accessory.context.am43.lastPosition) {
            accessory.am43device.position = accessory.context.am43.lastPosition
        }
        if (accessory.context.am43.lastBatteryPercentage) {
            accessory.am43device.batteryPercentage = accessory.context.am43.lastBatteryPercentage
        }

        accessory.lastPositionUpdate = null
        accessory.secondsSinceLastPositionUpdate = function() {
            if (this.lastPositionUpdate) {
                return Math.floor((new Date() - this.lastPositionUpdate) / 1000)
            } else {
                return 60 * 60
            }
        }

        device.on('direction', (direction) => {
            this.log.debug("Notifying of new direction (0 down, 1 up): " + direction)
            let targetPosition = accessory.am43device.targetPosition ? accessory.am43device.targetPosition :  accessory.am43device.position
            accessory.windowCoveringService.getCharacteristic(this.Characteristic.PositionState).updateValue(direction)
            if (direction == 2) {
                accessory.windowCoveringService.getCharacteristic(this.Characteristic.CurrentPosition).updateValue(100 - accessory.am43device.position)
                accessory.windowCoveringService.getCharacteristic(this.Characteristic.TargetPosition).updateValue(100 - targetPosition)
            }
        })

        device.on('targetPosition', (position) => {
            this.log.debug("Notifying of new target position: " + position)
            let targetPosition = position ? position :  accessory.am43device.position
            accessory.windowCoveringService.getCharacteristic(this.Characteristic.TargetPosition).updateValue(100 - targetPosition)
        })

        device.on('position', (position) => {
            this.log.debug("Notifying of new position: " + position)
            accessory.lastPositionUpdate = new Date()
            accessory.windowCoveringService.getCharacteristic(this.Characteristic.CurrentPosition).updateValue(100 - position)
        })

        device.on('batteryPercentage', (percentage) => {
            this.log.debug("Notifying of new battery percentage: " + percentage)
            accessory.batteryService.getCharacteristic(this.Characteristic.BatteryLevel).updateValue(percentage)
        })

        device.prepareAsync()
    }

    configureServicesOnAccessory(accessory) {
        this.configureWindowCoveringServiceOnAccessory(accessory)
        this.configureInformationServiceOnAccessory(accessory)
        this.configureBatteryServiceOnAccessory(accessory)
    }

    configureInformationServiceOnAccessory(accessory) {
        var service = accessory.getService(this.Service.AccessoryInformation);
        if (!service) {
            service = accessory.addService(this.Service.AccessoryInformation);
        }

        service.getCharacteristic(this.Characteristic.Manufacturer).updateValue("renssies")

        service.getCharacteristic(this.Characteristic.Model).updateValue("AM43")

        service.getCharacteristic(this.Characteristic.Name).updateValue("AM43 Blind Motor")

        service.getCharacteristic(this.Characteristic.SerialNumber)
        .on('get', function(callback) {
            return callback(null, this.am43device.id)
        }.bind(accessory));

        service.getCharacteristic(this.Characteristic.FirmwareRevision)
        .on('get', function(callback) {
            return callback(null, this.packageJSON.version)
        }.bind(this));

        accessory.informationService = service
    }

    configureBatteryServiceOnAccessory(accessory) {
      var service = accessory.getService(this.Service.BatteryService);
      if (!service) {
          service = accessory.addService(this.Service.BatteryService);
      }

      service.getCharacteristic(this.Characteristic.BatteryLevel)
        .on('get', function(callback) {
            this.am43device.updateBatteryStatusAsync()
            return callback(null, this.am43device.batteryPercentage)
        }.bind(accessory));

      service.getCharacteristic(this.Characteristic.ChargingState).updateValue(0)

      service.getCharacteristic(this.Characteristic.StatusLowBattery)
        .on('get', function(callback) {
            return callback(null, this.am43device.batteryPercentage <= 10)
        }.bind(accessory));

        accessory.batteryService = service
    }

    configureWindowCoveringServiceOnAccessory(accessory) {
        var service = accessory.getService(this.Service.WindowCovering);
        if (!service) {
            service = accessory.addService(this.Service.WindowCovering);
        }

        service.getCharacteristic(this.Characteristic.CurrentPosition)
            .on('get', function(callback) {
                let position = 100 - this.am43device.position
                this.log.debug("Reporting position: " + position)
                if (this.secondsSinceLastPositionUpdate() > 120) {
                    this.log.debug("Requesting position update")
                    this.am43device.updatePositionAsync()
                }
                return callback(null, position)
            }.bind(accessory));

        service.getCharacteristic(this.Characteristic.TargetPosition)
            .on('get', function(callback) {
                var targetPosition = this.am43device.targetPosition ? this.am43device.targetPosition : this.am43device.position
                targetPosition = 100 - targetPosition
                this.log.debug("Reporting target position: " + targetPosition)
                return callback(null, targetPosition)
            }.bind(accessory))
            .on('set', async function(value, callback) {
                let targetPosition = 100 - value 
                this.log.debug("setting target position: " + targetPosition)
                await this.am43device.setPositionAsync(targetPosition, true)
                return callback(null)
            }.bind(accessory));

        service.getCharacteristic(this.Characteristic.PositionState)
            .on('get', function(callback) {
                this.log.debug("Reporting direction: " + direction)
                callback(null, this.am43device.direction)
            }.bind(accessory));

        service.getCharacteristic(this.Characteristic.HoldPosition)
            .on('set', async function(callback) {
                await this.am43device.stopAsync()
                callback(null)
            }.bind(accessory));

        accessory.windowCoveringService = service
    }

    identify (callback) {
        this.log.info("Identifying AM43 Blinds platform")
        callback()
    }
}

module.exports = AM43Platform