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

  ReactDOM.render(
    React.createElement(App),
    document.querySelector(".am43-app-container")
  )
})()
