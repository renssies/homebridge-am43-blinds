#### This plugin is considered a work in progress, it works, but it has some stability issues. See "Known Issues" and "Troubleshooting" below.

# Homebridge AM43 Blinds

A homebridge plugin to control the AM43 based blind motors in HomeKit, these include the A-OK, [Zemismart](https://www.zemismart.com/products/diy-motorized-your-tranditional-roll-shade-which-with-bean-or-cord-chain-smart-home-automation-support-app-timer-remote-control), [Upndown](https://upndown.nl) and other blinds motors that use Bluetooth and the Blinds Engine app.

This Homebridge plugin uses the Bluetooth on your computer to search for, and connect to the AM43 blinds.

# Requirements

This plugin requires Node version 10 or newer and Homebridge version 0.4.46 or newer. Homebridge version 1.0 is recommended.

It also requires that the machine that hosts Homebridge has a Bluetooth radio that supports the Bluetooth Low Energy (BLE) protocol. Most machines with Bluetooth 4.0 or newer support this protocol. This includes Macs (that support AirDrop) and Raspberry Pi version 3 or newer. Some systems might also work with an external Bluetooth 4.0 USB adapter. For compatibility check the [noble package](https://github.com/abandonware/noble) that is used by this plugin.

# Installation

First make sure to set up the blinds using the blinds engine app, including the upper and lower limit. Kill the app after the setup is finished. Having the app open will make the blinds invisible to this plugin.

---

When running Homebridge on Debian, Ubuntu, or Raspberry Pi you will first need to follow the following steps. macOS Users can skip these steps.

1. Install bluetooth packages:
   `sudo apt-get install bluetooth bluez libbluetooth-dev libudev-dev`
2. Give node/homebridge permission to use bluetooth:
   `sudo setcap cap_net_raw+eip $(eval readlink -f $(which node))`

Step 1 must be completed before you can continue with `npm install`.

---

The plugin can be installed using the homebridge-config-ui-x or by using the following command:

```bash
npm install -g homebridge-am43-blinds
```
If you have issues installing the plugin, add `--unsafe-perm` to the install command mentioned above.

After that you will need to enter the following details into the ~/.homebridge/config.json:

```JSON
{
  "platforms":[
         {
             "platform": "am43-blinds",
             "allowed_devices": []
         }
     ]
 }
```

Now start or restart homebridge and watch the logs. Homebridge will report that any AM43 motors that have been found will not be usable until added to the `allowed_devices` array. The log will also tell you the identifier of the motor to use. After adding the identifier the config should look a little something like this:

```JSON
     {
         "platform": "am43-blinds",
         "allowed_devices": ["02-86-68-35-3c-51"]
     }
```

Please note that the identifiers in `allowed_devices` might be different depending on the platform you're on. However, they should be the same between system reboots.

# Debugging

Running homebridge with `DEBUG=AM43` should cause motor-level debug logs to be output. 

# Known Issues

- [ ] The plugin hasn't been tested thoroughly but it does seem to work on most platforms that have Bluetooth 4.0.
- [ ] When setting up the motor you have to enter a password, however, it doesn't seem to be used in the Bluetooth calls I use in this plugin. This might become an issue later.

# Todo

- [ ] Implement support for the Solar Panels light sensor, mine seems broken so I've ordered a new unit.

# Troubleshooting

There are some issues with the plugin, but try the following tips before making an issue: 

### Move the homebridge device closer to the motor or use an external adapter. 
Some devices have a very bad Bluetooth range. Some Raspberry Pi boards reportedly only have a range of 3 meters (10 feet). In some houses, the technical rooms or rooms with the incoming connections can also have a type of fireproofing which lowers the range of Bluetooth and wifi even more. 

If moving the homebridge device closer isn't an option you can always use a compatible external Bluetooth dongle. Do make sure the dongle supports Bluetooth version 4.0 or newer. You can combine this with a USB extension cable to get outside the desired range. 

When using an external dongle on Linux (including Raspberry Pi) you will have to switch it manually. See [here](https://github.com/abandonware/noble#multiple-adapters-linux-specific) for more details. You will need to make sure the `NOBLE_HCI_DEVICE_ID` environment variable is set correctly before or when homebridge launches.

### Some other device is using the blinds motor
The blinds motor only supports one connection. So before it can be found and used by homebridge you will have to force stop the blind engine app and make sure no other homebridge instance is connecting to the motor. 

If this doesn't work turn off Bluetooth on the devices that use and have used the blind engine app.

### The motor gets into the "No response" state after working before. 

This is likely because your homebridge device has issues reconnecting to the device after it is disconnected to save power. You can add `hap_interaction_timeout` with a value of 0 to the config.json. However, this does mean the motor will use more power and it might deplete the battery faster than the solar panel can charge it.

# Thanks

I have to thank [buxtronix/am43](https://github.com/buxtronix/am43), [binsentsu/am43-ctrl](https://github.com/binsentsu/am43-ctrl/) and [TheBazeman/A-OK-AM43-Blinds-Drive](https://github.com/TheBazeman/A-OK-AM43-Blinds-Drive) for the resources to get this plugin working.

Also thanks to these contributors:
- [@neil-morrison44](https://github.com/neil-morrison44)
