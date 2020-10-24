#### This plugin is considered a work in progress

# Homebridge AM43 Blinds

A homebridge plugin to control the AM43 based blind motors in HomeKit, these include the A-OK, [Zemismart](https://www.zemismart.com/products/diy-motorized-your-tranditional-roll-shade-which-with-bean-or-cord-chain-smart-home-automation-support-app-timer-remote-control), [Upndown](https://upndown.nl) and other blinds motors that use Bluetooth and the Blinds Engine app.

This Homebridge plugin uses the bluetooth on your computer to search for, and connect to the AM43 blinds.

# Requirements

This plugin requires Node version 10 or newer and Homebridge version 0.4.46 or newer. Homebridge version 1.0 is recommended.

It also requires that the machine that hosts Homebridge has a Bluetooth radio that supports the Bluetooth Low Energy (BLE) protocol. Most machines with Bluetooth 4.0 or newer support this protocol. This includes Macs (that support AirDrop) and Raspberry Pi version 3 or newer. Some systems might also work with a external bluetooth 4.0 USB adapter. For compatibility check the [noble package](https://github.com/abandonware/noble) that is used by this plugin.

# Installation

First make sure to setup the blinds using the blinds engine app, including the upper and lower limit. Kill the app after the setup is finished. Having the app open will make the blinds invisible to this plugin.

---

When running Homebridge on Debian, Ubuntu or Raspberry Pi you will first need to follow the following steps. macOS Users can skip these steps.

1. Install bluetooth packages:
   `sudo apt-get install bluetooth bluez libbluetooth-dev libudev-dev`
2. Give node/homebridge permission to use bluetooth:
   `sudo setcap cap_net_raw+eip $(eval readlink -f $(which node))`

Step 1 must be completed before you can continue with `npm install`.

---

The following command can be used to install the plugin on the Homebridge server:

```bash
npm install -g https://github.com/renssies/homebridge-am43-blinds
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

Now start or restart homebridge and watch the logs. Homebridge will report that any AM43 motors that have been found will not be usable until added to the `allowed_devices` array. The log will also tell you the identifier of the motor to use. After adding the identifer the config should look a little something like this:

```JSON
     {
         "platform": "am43-blinds",
         "allowed_devices": ["02-86-68-35-3c-51"]
     }
```

Please note that the identifiers in `allowed_devices` might be different depending on the platform you're on. However the should be the same between system reboots.

# Debugging

- running homebridge with `DEBUG=AM43` should cause motor-level debug logs to be output

# Known Issues

- [ ] The plugin is mostly untested. So far I've only tested it on a MacBook Pro 2019 and Raspberry Pi 3 Model B+
- [ ] When setting up the motor you have to enter a password, however it doesn't seem to be used in the bluetooth calls I use in this plugin. This might become an issue later.
- [ ] When running this plugin on Raspberry Pi it seems unable to re-connect to the blind after it was disconnected to preserve power. To work around this you can set `hap_interaction_timeout` in config.json to a value of 0. This will however cause the battery to drain faster.

# Todo

- [ ] Implement support for the Solar Panels light sensor, mine seems broken so I've ordered a new unit.

# Thanks

I have to thank [buxtronix/am43](https://github.com/buxtronix/am43), [binsentsu/am43-ctrl](https://github.com/binsentsu/am43-ctrl/) and [TheBazeman/A-OK-AM43-Blinds-Drive](https://github.com/TheBazeman/A-OK-AM43-Blinds-Drive) for the resources to get this plugin working.
