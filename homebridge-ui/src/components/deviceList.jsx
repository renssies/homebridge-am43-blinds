import React, { useState, useEffect } from 'react'
import MotorIcon from "./motorIcon"

const DeviceList = () => {
  const [devices, setDevices] = useState([])
  useEffect(() => {
    const addDevice = ({ data: device }) => setDevices([...devices, device])
    homebridge.addEventListener('device-discovered', addDevice);
    return () => homebridge.removeEventListener("device-discovered", addDevice)
  }, [devices])

  const scanForDevices = () => {
    setDevices([])
    homebridge.showSpinner()
    homebridge.request('/scan_for_devices', { scan_time: 20e3 }).then(
      (scanResults) => {
        homebridge.hideSpinner()
        setDevices(scanResults)
      }
    )
  }

  return <div className="card-body">
    <ol className="list-group">{devices.map(({ address, localName }) =>
      <button className="list-group-item list-group-item-action d-flex flex-row" key={address}>
        <div className="mr-4">
          <MotorIcon small />
        </div>
        <div>
          <h5>{localName}</h5>
          <p>{address}</p>
        </div>
      </button>)}</ol>
    <button type="button" className="btn btn-primary w-100" onClick={scanForDevices}>Scan For Devices</button>
  </div>
}

export default DeviceList