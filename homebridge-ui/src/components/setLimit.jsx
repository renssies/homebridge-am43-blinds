import React, { useEffect, useState } from "react"

const SetLimit = ({ deviceId, openOrClose, onClose }) => {
  const [canSet, setCanSet] = useState(false)
  useEffect(() => {
    homebridge.request("/adjust_limit", { device_id: deviceId, openOrClose, phase: "SET" })

    const onSetSuccess = () => {
      setCanSet(true)
    }

    homebridge.addEventListener("limit-set-success", onSetSuccess)
    return () => {
      homebridge.request("/adjust_limit", { device_id: deviceId, openOrClose, phase: "CANCEL" })
      homebridge.removeEventListener("limit-set-success", onSetSuccess)
    }
  }, [])

  const saveAdjustment = () => homebridge.request("/adjust_limit", { device_id: deviceId, openOrClose, phase: "SAVE" })

  const openMotor = () => homebridge.request("/move_motor", { device_id: deviceId, command: "OPEN" })
  const stopMotor = () => homebridge.request("/move_motor", { device_id: deviceId, command: "STOP" })
  const closeMotor = () => homebridge.request("/move_motor", { device_id: deviceId, command: "CLOSE" })

  return <div className="card-body">
    <div className="d-flex justify-content-around p-2">
      <button type="button" disabled={!canSet} className="btn btn-primary" onMouseDown={openMotor} onMouseUp={stopMotor}>Open</button>
      <button type="button" disabled={!canSet} className="btn btn-danger" onMouseDown={stopMotor}>Stop</button>
      <button type="button" disabled={!canSet} className="btn btn-primary" onMouseDown={closeMotor} onMouseUp={stopMotor}>Close</button>
    </div>

    <button type="button" disabled={!canSet} className="btn btn-primary w-100" onClick={saveAdjustment}>Save</button>
    <button type="button" className="btn btn-secondary w-100" onClick={onClose}>Cancel</button>
  </div>
}

export default SetLimit
