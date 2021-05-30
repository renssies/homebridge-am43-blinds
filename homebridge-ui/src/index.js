import React from "react"
import ReactDOM from "react-dom"
import App from "./components/app"
;(async () => {
  homebridge.addEventListener("reset-success", () => {
    homebridge.toast.success("Reset BLE Connections")
  })

  homebridge.addEventListener("reset-fail", () => {
    homebridge.toast.warning("Might have reset BLE Connections")
  })

  homebridge.addEventListener("auth-error", () => {
    homebridge.toast.error("check passcode", "Auth Error")
  })

  homebridge.addEventListener("auth-success", () => {
    homebridge.toast.success("Auth Success")
  })

  homebridge.addEventListener("limit-set-success", () => {
    homebridge.toast.warning(
      "Motor can overun until this mode's exited",
      "Limit Adjustment Mode Entered"
    )
  })

  homebridge.addEventListener("limit-cancel-success", () => {
    homebridge.toast.success("Limit Adjustment Mode Exited")
  })

  homebridge.addEventListener("limit-save-success", () => {
    homebridge.toast.success("Limit Saved!")
  })

  ReactDOM.render(
    React.createElement(App),
    document.querySelector(".am43-app-container")
  )
})()
