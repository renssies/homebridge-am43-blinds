import React, { useState, useEffect } from 'react'

const DeviceList = () => {
  const [devices, setDevices] = useState([])
  useEffect(() => {

  }, [])

  const scanForDevices = () => {
    homebridge.showSpinner()
    homebridge.request('/scan_for_devices', { scan_time: 20e3 }).then(
      (scanResults) => {
        homebridge.hideSpinner()
        setDevices(scanResults)
      }
    )
  }

  return <div>
    <ol className="list-group">{devices.map(({ address, localName }) =>
      <button className="list-group-item list-group-item-action">
        <h5>{localName}</h5>
        <p>{address}</p>
      </button>)}</ol>
    <button type="button" className="btn btn-primary" onClick={scanForDevices}>Scan For Devices</button>
  </div>
}

export default DeviceList
