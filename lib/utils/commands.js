const { DeviceValues } = require("homebridge-am43-blinds/lib/utils/values")

const calculateCommandChecksum = (bufferArray) => {
  let checksum = 0
  for (let i = 0; i < bufferArray.length - 1; i++) {
    checksum = checksum ^ bufferArray[i]
  }
  checksum = checksum ^ 0xff
  return checksum
}

const buildCommandBuffer = function (commandID, data) {
  const bufferArray = new Uint8Array(data.length + 8)
  const startPackage = DeviceValues.AM43_COMMAND_PREFIX
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

  bufferArray[bufferIndex] = calculateCommandChecksum(bufferArray)
  bufferIndex++

  return Buffer.from(bufferArray.buffer)
}

module.exports = {
  buildCommandBuffer,
}
