import React, { Fragment } from "react"

const BreadCrumbs = ({ onExitBlindsEngineMode, onReturnToDeviceList, selectedDeviceId }) => (
  <nav aria-label="breadcrumb">
    <ol className="breadcrumb">
      <li className="breadcrumb-item"><a href="#" onClick={onExitBlindsEngineMode}>Settings</a></li>
      <li className="breadcrumb-item">Blind Engine</li>
      {selectedDeviceId !== null ? <Fragment>
        <li className="breadcrumb-item">
          <a href="#" onClick={onReturnToDeviceList}>Device List</a>
        </li>
        <li className="breadcrumb-item active" aria-current="page">Motor</li>
      </Fragment> : <Fragment>
        <li className="breadcrumb-item active" aria-current="page">Device List</li>
      </Fragment>
      }
    </ol>
  </nav>
)

export default BreadCrumbs
