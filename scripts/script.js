// custom-lanyard.js
// File hoàn chỉnh: kết nối tới Lanyard, cập nhật trạng thái và ép tên hiển thị cố định.
// Nếu muốn hiển thị tên Discord thực, để customDisplayName hoặc customUsername = "".

const userID = ""; // <-- giữ hoặc đổi ID bạn muốn
const customDisplayName = "HongAnh"; // <-- đặt tên hiển thị bạn muốn, hoặc "" để dùng Discord
const customUsername = "DanhMC"; // <-- đặt username bạn muốn, hoặc "" để dùng Discord

const DEBUG = false; // bật true để log payload chi tiết

const elements = {
  statusBox: document.querySelector(".status"),
  statusImage: document.getElementById("status-image"),
  displayName: document.querySelector(".display-name"),
  username: document.querySelector(".username"), // nút/buton id="textToCopy" trong HTML cũ
  customStatus: document.querySelector(".custom-status"),
  customStatusText: document.querySelector(".custom-status-text"),
  customStatusEmoji: document.getElementById("custom-status-emoji"),
};

function safeText(el, text) {
  if (!el) return;
  el.textContent = text ?? "";
}

function startWebSocket() {
  try {
    const ws = new WebSocket("wss://api.lanyard.rest/socket");
    ws.onopen = () => {
      ws.send(JSON.stringify({ op: 2, d: { subscribe_to_id: userID } }));
      if (DEBUG) console.log("Lanyard WS opened, subscribed to:", userID);
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const { t, d } = payload;
        if (DEBUG) console.log("Lanyard message:", payload);
        if (t === "INIT_STATE" || t === "PRESENCE_UPDATE") {
          updateStatus(d || {});
        }
      } catch (err) {
        console.error("Failed to parse WS message", err);
      }
    };

    ws.onerror = (error) => {
      console.error("Lỗi WebSocket:", error);
      try { ws.close(); } catch (e) {}
    };

    ws.onclose = (ev) => {
      if (DEBUG) console.log("WebSocket đóng, thử kết nối lại...", ev);
      // reconnect với delay
      setTimeout(startWebSocket, 1000);
    };
  } catch (err) {
    console.error("Không thể tạo WebSocket:", err);
  }
}

function updateStatus(lanyardData) {
  // defensive: default values
  const discord_user = lanyardData.discord_user ?? {};
  const discord_status = lanyardData.discord_status ?? "offline";
  const activities = Array.isArray(lanyardData.activities) ? lanyardData.activities : [];

  if (DEBUG) console.log("updateStatus - user:", discord_user, "status:", discord_status, "activities:", activities);

  // Tên hiển thị: ưu tiên custom, nếu rỗng dùng từ Discord
  const discordDisplay = discord_user.display_name || discord_user.username || "";
  const discordUsername = discord_user.username || "";

  const displayNameToShow = customDisplayName && customDisplayName.trim() !== "" ? customDisplayName : discordDisplay;
  let usernameToShow = customUsername && customUsername.trim() !== "" ? customUsername : discordUsername;

  // nếu username lấy từ Discord có dạng "Ninja - 400" mà bạn vẫn để dùng Discord,
  // có thể muốn "lọc" phần "- số" ở cuối — giữ lại nếu bạn muốn.
  if (!customUsername && typeof usernameToShow === "string") {
    usernameToShow = usernameToShow.replace(/\s*-\s*\d+$/,'').trim();
  }

  // Gán an toàn
  safeText(elements.displayName, displayNameToShow);
  safeText(elements.username, usernameToShow);

  // status image + aria-label
  let imagePath = "./public/status/offline.svg";
  let label = "Offline";
  switch (discord_status) {
    case "online":
      imagePath = "./public/status/online.svg";
      label = "Online";
      break;
    case "idle":
      imagePath = "./public/status/idle.svg";
      label = "Idle / AFK";
      break;
    case "dnd":
      imagePath = "./public/status/dnd.svg";
      label = "Do Not Disturb";
      break;
    case "offline":
      imagePath = "./public/status/offline.svg";
      label = "Offline";
      break;
    default:
      imagePath = "./public/status/offline.svg";
      label = discord_status || "Unknown";
      break;
  }

  // detect streaming activity (type 1) with URL containing twitch/youtube
  try {
    const isStreaming = activities.some((activity) =>
      activity?.type === 1 &&
      typeof activity?.url === "string" &&
      (activity.url.includes("twitch.tv") || activity.url.includes("youtube.com"))
    );
    if (isStreaming) {
      imagePath = "./public/status/streaming.svg";
      label = "Streaming";
    }
  } catch (e) {
    // ignore
  }

  if (elements.statusImage) elements.statusImage.src = imagePath;
  if (elements.statusBox) elements.statusBox.setAttribute("aria-label", label);

  // custom status (activities[0] thường là custom status nếu có)
  const primary = activities[0] || null;
  const stateText = primary?.state ?? null;
  const emoji = primary?.emoji ?? null;

  if (stateText) {
    safeText(elements.customStatusText, stateText);
  } else {
    safeText(elements.customStatusText, "Not doing anything!");
  }

  // emoji xử lý và hiển thị
  if (elements.customStatusEmoji) {
    if (emoji?.id) {
      elements.customStatusEmoji.style.display = ""; // bật hiển thị theo CSS mặc định
      // sử dụng CDN Discord (đảm bảo đúng đường dẫn)
      elements.customStatusEmoji.src = `https://cdn.discordapp.com/emojis/${emoji.id}.webp?size=24`;
      elements.customStatusEmoji.alt = emoji?.name ?? "emoji";
    } else if (emoji?.name) {
      // emoji dạng unicode/text — bạn có thể map icon tĩnh nếu muốn
      elements.customStatusEmoji.style.display = "";
      elements.customStatusEmoji.src = "./public/icons/poppy.png"; // fallback
      elements.customStatusEmoji.alt = emoji.name;
    } else {
      elements.customStatusEmoji.style.display = "none";
      elements.customStatusEmoji.src = "";
      elements.customStatusEmoji.alt = "";
    }
  }

  // show/hide block custom status toàn bộ
  if (!stateText && !emoji) {
    if (elements.customStatus) elements.customStatus.style.display = "none";
  } else {
    if (elements.customStatus) elements.customStatus.style.display = "flex";
  }
}

// Khởi chạy
startWebSocket();
