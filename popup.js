console.log("Popup script loaded")

document.getElementById("copyData").addEventListener("click", function () {
  console.log("Copy button clicked")
  const status = document.getElementById("status")
  status.textContent = "Fetching data..."

  chrome.runtime.sendMessage({ action: "getData" })
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Popup received message:", message)
  const status = document.getElementById("status")

  if (message.action === "dataFetched") {
    navigator.clipboard
      .writeText(message.data)
      .then(() => {
        status.textContent = "Data copied to clipboard!"
        setTimeout(() => {
          status.textContent = ""
        }, 2000)
      })
      .catch((err) => {
        console.error("Clipboard error:", err)
        status.textContent = "Failed to copy data"
      })
  } else if (message.action === "error") {
    status.textContent = message.error
    setTimeout(() => {
      status.textContent = ""
    }, 3000)
  }
})
