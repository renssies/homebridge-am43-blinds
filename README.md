#### This plugin is considered a work a progress

# Homebridge AM43 Blinds 

A homebridge plugin to control the AM43 based blind motors in HomeKit, these include the A-OK and Zemismart blinds motors as long as the motor uses Bluetooth and the Blinds Engine app. 

This Homebridge plugin uses the bluetooth on your computer to search for, and connect to the AM43 blinds.

# Installation

First make sure you are running Homebridge on a system that has Bluetooth Low Energy protocol support. Most devices with Bluetooth 4.0 or newer support this protocol. This includes most mordern Macs and Raspberry Pi's. To see what systems are supported you can check out the info on the [noble package](https://github.com/abandonware/noble) used by this plugin. You might also have to install additional system packages when using Linux or Raspberry Pi OS.

Next make sure to setup the blind using the blinds engine app, including the upper and lower limit. Kill the app after the setup is finished. Having the app open will make the blinds invisible to this plugin. 

The following command can be used to install the plugin on the Homebridge server:

```bash
npm install -g https://github.com/renssies/homebridge-am43-blinds
```

After that you will need to enter the following details into the ~/.homebridge/config.json:

```JSON
{
  "platforms":[
         {
             "platform": "am43-blinds",
         }
     ]
 }
```
Now start of restart homebridge and all nearby AM43 blinds motors should appear in HomeKit.

# Known Issues
- [ ] The motor uses a lot of power because the plugin keeps it connected. Therefor it is advised to use this plugin with motors that are connected to AC, not just the solar panel
- [ ] The plugin is mostly untested. So far I've only tested it on a MacBook Pro 2019. 
- [ ] When seting up the motor you have to enter a password, however it doesn't seem to be used in the bluetooth calls I use in this plugin. This might become an issue later.

# Todo
- [ ] Implement support for the Solar Panels light sensor, mine seems broken so I've ordered a new unit. 
- [ ] Disconnect the motors after some time to converse power.
- [ ] Poll the state of the battery and blind for a more updated state in HomeKit when manually controlled.

# Thanks

I have to thank [buxtronix/am43](https://github.com/buxtronix/am43), [binsentsu/am43-ctrl](https://github.com/binsentsu/am43-ctrl/) and [TheBazeman/A-OK-AM43-Blinds-Drive](https://github.com/TheBazeman/A-OK-AM43-Blinds-Drive) for the resources to get this plugin working. 
 
