import React, { Fragment } from "react"

const BreadCrumbs = ({ onExitBlindsEngineMode, onReturnToDeviceList, selectedDevice }) => (
  <nav aria-label="breadcrumb">
    <ol className="breadcrumb">
      <li className="breadcrumb-item"><a href="#" onClick={onExitBlindsEngineMode}>Settings</a></li>
      <li className="breadcrumb-item">Blind Engine</li>
      {selectedDevice ? <Fragment>
        <li className={`breadcrumb-item ${selectedDevice ? "" : "active"}`}>
          <a href="#" onClick={onReturnToDeviceList}>Device List</a>
        </li>
        <li className="breadcrumb-item active" aria-current="page">{selectedDevice.localName}</li>
      </Fragment> : <Fragment>
        <li className="breadcrumb-item active" aria-current="page">Device List</li>
      </Fragment>
      }
    </ol>
  </nav>
)

export default BreadCrumbs
