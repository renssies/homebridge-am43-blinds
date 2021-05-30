import React, { Fragment, useEffect, useState } from "react"
import { useHomebridgeConfig } from "../hooks/useHomebridgeConfig"
import SetLimit from "./setLimit"
import MotorIcon from "./motorIcon"

const LIMIT_MODES = {
  OPENED: "OPENED",
  CLOSED: "CLOSED"
}

const MotorInfo = ({ deviceId }) => {
  const [device, setDevice] = useState(null)
  const [newName, setNewName] = useState(null)
  const [passcode, setPasscode] = useState("8888")
  const [hasAuthed, setHasAuthed] = useState(false)
  const { config, updateConfig } = useHomebridgeConfig()

  const [limitUI, setLimitUI] = useState(null)

  const allowedDevices = config?.[0]?.allowed_devices || []

  const isInAllowedDevices = allowedDevices.includes(device?.address)

  const removeFromAllowedDevices = async () => {
    await updateConfig([{ ...config[0], allowed_devices: allowedDevices.filter((address) => address !== device.address) }])
  }

  const addToAllowedDevices = async () => {
    await updateConfig([{ ...config[0], allowed_devices: [...allowedDevices, device.address] }])
  }

  useEffect(() => {
    homebridge.showSpinner()
    homebridge.request('/connect_to_device', { device_id: deviceId }).then(
      (deviceResult) => {
        homebridge.hideSpinner()
        setNewName(deviceResult.localName)
        setDevice(deviceResult)
      }
    )

    const setAuthTrue = () =>
      setHasAuthed(true)

    homebridge.addEventListener("auth-success", setAuthTrue)
    return function () {
      homebridge.removeEventListener("auth-success", setAuthTrue)
    }
  }, [])

  useEffect(() => {
    const nameChangeSuccess = () => {
      setDevice((d) => ({ ...d, localName: newName }))
    }

    homebridge.addEventListener("name-change-success", nameChangeSuccess)

    return function () {
      homebridge.removeEventListener("name-change-success", nameChangeSuccess)
    }
  }, [newName])

  const submitNewName = async () => {
    homebridge.request('/rename_device', { device_id: deviceId, new_name: newName })
  }

  const submitPassCode = () => {
    homebridge.request('/auth_with_passcode', { device_id: deviceId, passcode })
  }

  return <div className="card-body d-flex">
    <div className="mr-3">
      <MotorIcon />
    </div>
    {device &&
      <div className="w-100">
        <div className="input-group mb-3">
          <div className="input-group-prepend">
            <span className="input-group-text" id="motor-name">Name</span>
          </div>
          <input value={newName} disabled={!hasAuthed} onChange={({ target }) => setNewName(target.value)} type="text" className="form-control" placeholder="Motor Name" aria-label="local name" aria-describedby="motor-name" />
          {(device.localName !== newName && newName?.length > 0) &&
            <div className="input-group-append">
              <button type="button" onClick={submitNewName} className="btn-outline-secondary">Update</button>
            </div>
          }
        </div>

        <div className="input-group mb-3">
          <div className="input-group-prepend">
            <span className="input-group-text" id="motor-address">Address</span>
          </div>
          <input value={device.address} type="text" disabled className="form-control" aria-label="local name" aria-describedby="motor-address" />
        </div>
        {!hasAuthed &&
          <div className="input-group mb-3">
            <div className="input-group-prepend">
              <span className="input-group-text" id="passcode-label">Passcode</span>
            </div>
            <input value={passcode} pattern="[0-9]{4}" onChange={({ target }) => setPasscode(target.value)} type="text" className="form-control" placeholder="(default 8888)" aria-label="passcode" aria-describedby="passcode-label" />
            <div className="input-group-append">
              <button type="button" onClick={submitPassCode} className="btn-outline-secondary">Auth</button>
            </div>
          </div>
        }
        {hasAuthed &&
          <Fragment>
            <div className="card border-light mb-3">
              <button type="button" onClick={() => setLimitUI((l) => l === null ? LIMIT_MODES.OPENED : null)}
                className="card-header btn btn-outline-secondary btn-sm m-0">
                Set Open Limit
               </button>
              {limitUI === LIMIT_MODES.OPENED &&
                <SetLimit openOrClose={limitUI} deviceId={deviceId} onClose={() => setLimitUI(null)} />
              }
            </div>
            <div className="card border-light mb-3">
              <button type="button" onClick={() => setLimitUI((l) => l === null ? LIMIT_MODES.CLOSED : null)}
                className="card-header btn btn-outline-secondary btn-sm m-0">
                Set Close Limit
               </button>
              {limitUI === LIMIT_MODES.CLOSED &&
                <SetLimit openOrClose={limitUI} deviceId={deviceId} onClose={() => setLimitUI(null)} />
              }
            </div>
          </Fragment>
        }
        {config && <button type="button" className={`btn ${isInAllowedDevices ? "btn-danger" : "btn-secondary"}`} onClick={isInAllowedDevices ? removeFromAllowedDevices : addToAllowedDevices}>{isInAllowedDevices ? "Remove from" : "Add to"} Allowed List (on save)</button>}
      </div>
    }
    {!device && <div><div className="alert alert-secondary" role="alert">
      Attempting to connect to motor...
    </div></div>}
  </div>
}

export default MotorInfo
