import React, { useState, useEffect } from 'react'
import DeviceList from "./deviceList"
import BreadCrumbs from "./breadCrumbs"

const App = () => {
  const [inBlindEngineMode, setInBlindEngineMode] = useState(false)

  useEffect(() => {
    if (inBlindEngineMode) {
      homebridge.hideSchemaForm();
    }
    else {
      homebridge.showSchemaForm();
    }
  }, [inBlindEngineMode])

  if (inBlindEngineMode) {
    return <div className="card">
      <BreadCrumbs onExitBlindsEngineMode={() => setInBlindEngineMode(false)} />
      <DeviceList />
    </div>
  }

  return <div className="d-flex justify-content-center"><button type="button" className="btn btn-primary w-75" onClick={() =>
    setInBlindEngineMode(true)
  }>Blind Engine</button></div>
}

export default App
