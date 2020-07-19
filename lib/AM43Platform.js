const AM43DeviceModule = require("./AM43Device")
const AM43Device = AM43DeviceModule.AM43Device
const AM43DeviceStaticVariables = AM43DeviceModule.StaticVariables
const packageJSON = require('../package.json')
const noble = require("@abandonware/noble")
const poll = require("poll").default

var StaticVariables = {
    CONFIG_KEY_SCANNING_TIMEOUT: "scanning_timeout",
    CONFIG_KEY_POLL_INTERVAL: "poll_interval",
    CONFIG_KEY_HAP_INTERACTION_TIMEOUT: "hap_interaction_timeout",
    CONFIG_KEY_ALLOWED_DEVICES: "allowed_devices",
    DEFAULT_HAP_INTERACTION_TIMEOUT: 1.5 * 60, // The minimum amount of time since HAP has interacted with the device before it should disconnect. In seconds
    DEFAULT_POLL_INTERVAL: 5 * 60, // The time between polling requests for the position, battery and light sensor. In seconds
    DEFAULT_SCANNING_TIMEOUT: 10, // The time for which the plugin should scan for devices during launch. In seconds
    POSITION_UPDATE_INTERVAL: 2 * 60, // The minimum time between the request for position updates. In seconds
    MISSING_DEVICES_SCANNING_TIMEOUT: 5, // The time for which the plugin should scan for devices when it is missing a device. In seconds
    HAP_NO_INTERACTION_GRACE_PERIOD: 5, // The grace period that is applied when the HAP interaction timeout has been reached. This is to give HAP some time to interact with the device before disconnection. In seconds
    MINIMUM_POLL_INTERVAL: 5 // The minimum required poll interval. In seconds.
}

class AM43Platform {

    constructor(log, config, api) {
        this.configJSON = config
        this.log = log
        this.api = api
        
        this.packageJSON = packageJSON
        this.accessories = []

        this.log.info("Starting AM43 platform")

        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;

        this.isScanning = false

        let configuredAllowedDevicesList = this.configJSON[StaticVariables.CONFIG_KEY_ALLOWED_DEVICES]
        if (configuredAllowedDevicesList !== undefined) {
            if (configuredAllowedDevicesList == null) {
                this.allowedDevices = null
            }  else if (Array.isArray(configuredAllowedDevicesList)) {
                this.allowedDevices = configuredAllowedDevicesList
            } else {
                this.log.error(`The config.json defines '${StaticVariables.CONFIG_KEY_ALLOWED_DEVICES}' list but it seems to be an invalid format. The list should be an array, example: ['MAC1', 'MAC2']`)
                this.allowedDevices = []
            }
        } else {
            this.log.debug(`No ${StaticVariables.CONFIG_KEY_ALLOWED_DEVICES} field found. Ignoring all devices`)
            this.allowedDevices = []
        }

        if (this.configJSON[StaticVariables.CONFIG_KEY_HAP_INTERACTION_TIMEOUT] != undefined && this.configJSON[StaticVariables.CONFIG_KEY_HAP_INTERACTION_TIMEOUT] <= 0) {
            this.log.warn("Automatic disconnection of AM43 devices is disabled and the connection will be kept open. This might cause higher power usage of the devices but improve responsiveness.")
        }

        if (this.configJSON[StaticVariables.CONFIG_KEY_POLL_INTERVAL] != undefined && this.configJSON[StaticVariables.CONFIG_KEY_POLL_INTERVAL] < StaticVariables.MINIMUM_POLL_INTERVAL) {
            this.log.warn(`Polling for devices is disabled due too a low poll interval. This might cause an incorrect state in HomeKit apps. Polling requires a value of ${StaticVariables.MINIMUM_POLL_INTERVAL} (seconds) or higher.`)
        }

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
            if (this.allowedDevices != null) {
                let deviceIdentifier = peripheral.address != null ? peripheral.address : peripheral.id
                if (!this.allowedDevices.includes(deviceIdentifier)) {
                    this.log.warn(`Device ${device.description} is not found on the '${StaticVariables.CONFIG_KEY_ALLOWED_DEVICES}' array in config.json and is ignored.`)
                    this.log.warn(`Add it to config.json to be able to use the device, you can use this identifier: '${deviceIdentifier}'. Example: ' "allowed_devices": ["${deviceIdentifier}"] '`)
                    this.log.warn(`Or set '${StaticVariables.CONFIG_KEY_ALLOWED_DEVICES}' to 'null' to allow all devices. Setting 'null' is not recommended!`)
                    return
                }
            }

            let uuid = this.api.hap.uuid.generate(device.id)
            let existingAccessory = this.accessories.find(accessory => accessory.UUID == uuid)
            if (!existingAccessory) {
                this.log.info("Found new AM43 Motor: " + device.description)
                let accessory = this.createAccessory(device, uuid)
                this.configureDeviceOnAccessory(accessory, device)
                this.api.registerPlatformAccessories('homebridge-am43-blinds', 'am43-blinds', [accessory]);
            } else {
                this.log.info("Found known AM43 Motor: " + device.description)
                this.configureDeviceOnAccessory(existingAccessory, device)
                this.api.updatePlatformAccessories([existingAccessory])
            }
        })

        let scanningTimeout = this.configJSON[StaticVariables.CONFIG_KEY_SCANNING_TIMEOUT] ? this.configJSON[StaticVariables.CONFIG_KEY_SCANNING_TIMEOUT] : StaticVariables.DEFAULT_SCANNING_TIMEOUT
        this.startScanningForDevices(scanningTimeout)
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

    startScanningForDevices(timeout) {
        if (this.isScanning) {
            return
        }
        this.isScanning = true
        this.log.info("Started scanning for AM43 blinds, stopping in " + timeout + " seconds")
        noble.startScanning([AM43DeviceStaticVariables.AM43_SERVICE_ID])
        
        setTimeout(() => {
            this.isScanning = false
            noble.stopScanning((error) => {
                if (!error) {
                    let devices = this.accessories.filter(accessory => accessory.am43device != null)
                    this.log.info("Stopped searching for AM43 Blinds, found " + devices.length + " devices")
                    return
                }
                this.log.error("Failed to stop searching for AM43 blinds")
             })
        }, timeout * 1000)
    }

    configureAccessory(accessory) {
        accessory.updateReachability(false)
        this.configureServicesOnAccessory(accessory)
        this.configurePropertiesOnAccessory(accessory)
        this.accessories.push(accessory)
    }

    createAccessory(device, uuid) {
        let accessory = new this.api.platformAccessory(device.name, uuid)
        accessory.am43device = device
        this.configureServicesOnAccessory(accessory)
        this.configurePropertiesOnAccessory(accessory)
        return accessory
    }

    configurePropertiesOnAccessory(accessory) {
        accessory.lastPositionUpdate = null
        accessory.secondsSinceLastPositionUpdate = function() {
            return this.lastPositionUpdate ? Math.floor((new Date() - this.lastPositionUpdate) / 1000) : 60 * 60
        }

        accessory.log = this.log

        accessory.hapInteractionTimeout = this.configJSON[StaticVariables.CONFIG_KEY_HAP_INTERACTION_TIMEOUT] != undefined ? this.configJSON[StaticVariables.CONFIG_KEY_HAP_INTERACTION_TIMEOUT] : StaticVariables.DEFAULT_HAP_INTERACTION_TIMEOUT
        accessory.lastHAPInteraction = null // The last time the homekit accessory procotol tried to interact with the device, this is used to disconnect the device to conserve power.
        accessory.secondsSinceLastHAPInteraction = function() {
            return this.lastHAPInteraction ? Math.floor((new Date() - this.lastHAPInteraction) / 1000) : 0 // If HomeKit hasn't interacted yet we keep the device connected.
        }.bind(accessory)
        accessory.disconnectIfUninteracted = function() {
            if (!this.am43device.isConnected) { return }
            if (this.hapInteractionTimeout > 0 && this.secondsSinceLastHAPInteraction() >= this.hapInteractionTimeout) {
                this.log.debug("Disconnecting AM43 due too HAP inactivity")
                this.am43device.disconnectAsync()
            }
        }.bind(accessory)
        accessory.checkForHAPInteractionTimeout = function() {
            if (!this.am43device.isConnected) { return }
            if (this.hapInteractionTimeout > 0 && this.secondsSinceLastHAPInteraction() >= this.hapInteractionTimeout) {
                this.log.debug("HAP interaction timeout reached, starting " + StaticVariables.HAP_NO_INTERACTION_GRACE_PERIOD + " second grace period")
                // We wait a few seconds before disconnecting the device because updating the device's characteristics might trigger an automation.
                setTimeout(() => {
                    accessory.disconnectIfUninteracted()
                }, StaticVariables.HAP_NO_INTERACTION_GRACE_PERIOD * 1000)
            }
        }.bind(accessory)

        accessory.scanForMissingDevices = function() {
            this.startScanningForDevices(StaticVariables.MISSING_DEVICES_SCANNING_TIMEOUT)
            this.log.debug("Started scan for missing devices");
        }.bind(this)

        accessory.updateInformation = async function() {
            if (!this.am43device) {
                return
            }
            this.log.debug("Updating device information from poll")
            await new Promise(r => setTimeout(r, 200));
            await this.am43device.updatePositionAsync()
            await new Promise(r => setTimeout(r, 200));
            await this.am43device.updateBatteryStatusAsync()
        }
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
            var targetPosition = position ? position :  accessory.am43device.position
            targetPosition = 100 - targetPosition // In AM43 Devices 100% means fully closed, but in HomeKit 100% means fully opened
            this.log.debug("Notifying of new target position: " + targetPosition)
            accessory.windowCoveringService.getCharacteristic(this.Characteristic.TargetPosition).updateValue(targetPosition)
        })

        device.on('position', (position) => {
            position = 100 - position // In AM43 Devices 100% means fully closed, but in HomeKit 100% means fully opened
            this.log.debug("Notifying of new position: " + position)
            accessory.lastPositionUpdate = new Date()
            accessory.windowCoveringService.getCharacteristic(this.Characteristic.CurrentPosition).updateValue(position)
            if (device.direction == 2) {
                accessory.windowCoveringService.getCharacteristic(this.Characteristic.TargetPosition).updateValue(position)
            }

            accessory.checkForHAPInteractionTimeout()
        })

        device.on('batteryPercentage', (percentage) => {
            this.log.debug("Notifying of new battery percentage: " + percentage)
            accessory.batteryService.getCharacteristic(this.Characteristic.BatteryLevel).updateValue(percentage)
            accessory.batteryService.getCharacteristic(this.Characteristic.StatusLowBattery).updateValue(percentage <= 10)

            accessory.checkForHAPInteractionTimeout()
        })

        device.prepareAsync()

        let pollInterval = this.configJSON[StaticVariables.CONFIG_KEY_POLL_INTERVAL] != undefined ? this.configJSON[StaticVariables.CONFIG_KEY_POLL_INTERVAL] : StaticVariables.DEFAULT_POLL_INTERVAL
        if (pollInterval >= StaticVariables.MINIMUM_POLL_INTERVAL) {
            setTimeout(() => {
                poll(accessory.updateInformation.bind(accessory), pollInterval * 1000)
            }, pollInterval * 1000)
        }
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
            if (!this.am43device) {
                callback("No device found please try again", null)
                return
            }
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
            if (!this.am43device) {
                callback("No device found please try again", null)
                return
            }
            this.am43device.updateBatteryStatusAsync()
            return callback(null, this.am43device.batteryPercentage)
        }.bind(accessory));

      service.getCharacteristic(this.Characteristic.ChargingState).updateValue(0)

      service.getCharacteristic(this.Characteristic.StatusLowBattery)
        .on('get', function(callback) {
            if (!this.am43device) {
                callback("No device found please try again", null)
                return
            }
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
                if (!this.am43device) {
                    this.scanForMissingDevices()
                    callback("No device found please try again", null)
                    return
                }
                this.lastHAPInteraction = new Date()

                if (this.secondsSinceLastPositionUpdate() > StaticVariables.POSITION_UPDATE_INTERVAL || !this.am43device.isConnected) {
                    this.log.debug("Requesting position update")
                    this.am43device.updatePositionAsync()
                }

                let position = 100 - this.am43device.position // In AM43 Devices 100% means fully closed, but in HomeKit 100% means fully opened
                this.log.debug("Reporting position: " + position)
                return callback(null, position)
            }.bind(accessory));

        service.getCharacteristic(this.Characteristic.TargetPosition)
            .on('get', function(callback) {
                if (!this.am43device) {
                    callback("No device found please try again", null)
                    return
                }
                this.lastHAPInteraction = new Date()

                var targetPosition = this.am43device.targetPosition ? this.am43device.targetPosition : this.am43device.position
                targetPosition = 100 - targetPosition
                this.log.debug("Reporting target position: " + targetPosition)
                return callback(null, targetPosition)
            }.bind(accessory))
            .on('set', async function(value, callback) {
                if (!this.am43device) {
                    callback("No device found please try again")
                    return
                }
                this.lastHAPInteraction = new Date()

                let targetPosition = 100 - value // In AM43 Devices 100% means fully closed, but in HomeKit 100% means fully opened
                this.log.debug("setting target position: " + targetPosition)
                try {
                    await this.am43device.setPositionAsync(targetPosition, true)
                    setTimeout(() => {
                        this.log.debug("Checking for HAP interaction timeout after setting target position")
                        this.checkForHAPInteractionTimeout()
                    }, (this.hapInteractionTimeout * 1000) + 500) // Wait until the hap interaction timeout to check.
                    return callback(null)
                } catch (error) {
                    callback(error)
                }
            }.bind(accessory));

        service.getCharacteristic(this.Characteristic.PositionState)
            .on('get', function(callback) {
                if (!this.am43device) {
                    callback("No device found please try again", null)
                    return
                }
                this.lastHAPInteraction = new Date()
                this.log.debug("Reporting direction: " + direction)
                callback(null, this.am43device.direction)
            }.bind(accessory));

        service.getCharacteristic(this.Characteristic.HoldPosition)
            .on('set', async function(boolean, callback) {
                if (!this.am43device) {
                    callback("No device found please try again")
                    return
                }
                this.lastHAPInteraction = new Date()
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