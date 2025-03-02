/**
 * Updates the avatar image in the popup.
 * Replaces "npc" in the image's src with the user's avatar picture
 * and adds the avatar element as a CSS class.
 * @param {Object} avatarInfo - Contains `picture` and `element` properties.
 */
export function updateAvatarImage(avatarInfo) {
  const avatarImg = document.getElementById("avatar")

  if (avatarInfo) {
    // Update the avatar to the user's image.
    // Here we construct the URL using the provided picture name.
    avatarImg.src = `https://granblue.team/profile/${avatarInfo.picture}@2x.png`
    // Add the avatar-specific class.
    avatarImg.classList.add(avatarInfo.element)
  } else {
    // Reset the avatar to the default "npc" image.
    avatarImg.src = "https://granblue.team/profile/npc@2x.png"
    // Remove any extra classes, retaining only the base 'avatar' class.
    avatarImg.className = "avatar"
  }
}

/**
 * Refreshes the UI based on stored authentication data.
 * Hides main buttons if the user is logged in and updates the avatar.
 */
export async function refreshAuthUI() {
  const { gbAuth, noticeAcknowledged } = await chrome.storage.local.get(
    "gbAuth"
  )
  const mainButtons = document.getElementById("main-buttons")
  const warningNotice = document.getElementById("warning")

  if (gbAuth && gbAuth.access_token) {
    mainButtons.style.display = "none"
    warningNotice.style.display = "none"
    updateMainMessage()

    // Update avatar if available
    if (gbAuth.avatar) {
      updateAvatarImage(gbAuth.avatar)
    }

    // Update logged in username in the logged-in pane
    const loggedInUsernameElem = document.getElementById("loggedInUsername")
    if (loggedInUsernameElem && gbAuth.user && gbAuth.user.username) {
      loggedInUsernameElem.textContent = gbAuth.user.username
    }
  } else {
    if (noticeAcknowledged) {
      warningNotice.style.display = "none"
      mainButtons.style.display = "flex"
    } else {
      warningNotice.style.display = "flex"
      mainButtons.style.display = "none"
    }
  }
}

export function updateMainMessage() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs[0]) return
    const url = tabs[0].url
    console.log("Active tab URL:", url)

    const messageElem = document.querySelector("#mainPane .message")
    const importContainer = document.getElementById("import-container")

    if (url.includes("#party")) {
      // If on a party page, show the import container and hide the message.
      if (importContainer) {
        importContainer.style.display = "flex"
      }
      if (messageElem) {
        messageElem.style.display = "none"
      }
    } else {
      // Otherwise, hide the import container.
      if (importContainer) {
        importContainer.style.display = "none"
      }
      // And update the message:
      if (messageElem) {
        // For example, if the URL doesn't match a specific list page, show the blue notice.
        if (!url.includes("#list") && !url.includes("#party/index/0/npc/0")) {
          messageElem.innerHTML = `
            <div class="blue notice">
              <p>Navigate to a party or inventory team to get started</p>
            </div>
          `
        } else {
          // Otherwise revert to the default message.
          messageElem.innerHTML = `
            <p>
              This extension lets you quickly and easily import your parties and
              inventory into granblue.team.
            </p>
          `
        }
        messageElem.style.display = "block"
      }
    }
  })
}

export function resetMainMessage() {
  const messageElem = document.querySelector("#mainPane .message")
  if (messageElem) {
    messageElem.innerHTML = `
      <p>
        This extension lets you quickly and easily import your parties and inventory into granblue.team.
      </p>
    `
  }
}

export function updateStatus(message, type = "info") {
  const notice = document.getElementById("import-notice")
  const status = document.getElementById("import-status")
  notice.style.display = "block"
  notice.className = `status-${type}`
  status.textContent = message
}

export function resetStatus() {
  const notice = document.getElementById("import-notice")
  const status = document.getElementById("import-status")
  notice.style.display = "none"
  notice.className = ""
  status.textContent = ""
}
