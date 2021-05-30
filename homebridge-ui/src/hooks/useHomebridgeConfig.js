import { useEffect, useState } from "react"

const useHomebridgeConfig = () => {
  const [config, setConfig] = useState(null)
  const [savedConfig, setSavedConfig] = useState(null)

  useEffect(() => {
    homebridge.getPluginConfig().then((currentConfig) => {
      setConfig(currentConfig)
      setSavedConfig(currentConfig)
    })
  }, [])

  const updateConfig = async (newConfig) => {
    await homebridge.updatePluginConfig(newConfig)
    setConfig(newConfig)
  }

  const saveConfig = async () => {
    await homebridge.savePluginConfig()
  }

  return { config, updateConfig, saveConfig }
}

export { useHomebridgeConfig }
