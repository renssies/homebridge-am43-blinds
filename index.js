const AM43Platform = require("./lib/AM43Platform.js")

module.exports = function (api) {
    api.registerPlatform('homebridge-am43-blinds', 'am43-blinds', AM43Platform)
}
