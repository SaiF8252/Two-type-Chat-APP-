(() => {
  const socket = io(window.location.origin);
  const $messages = document.getElementById("messages");
  const $text = document.getElementById("text");
  const $files = document.getElementById("files");
  const $pick = document.getElementById("pick");
  const $send = document.getElementById("send");
  const $name = document.getElementById("nameInput");
  const $saveName = document.getElementById("saveName");
  const $conn = document.getElementById("conn");
  const $activeUsers = document.getElementById("activeUsers");
  const $userList = document.getElementById("user-list");

  let sidebarVisible = false;
  let myName = localStorage.getItem("chatName") || "";
  if (myName) $name.value = myName;

  // Save name
  $saveName.addEventListener("click", () => {
    myName = ($name.value || "").trim() || "Guest";
    localStorage.setItem("chatName", myName);
    socket.emit("user:join", myName);
  });

  $pick.addEventListener("click", () => $files.click());

  socket.on("connect", () => {
    $conn.textContent = `Connected (${socket.id.slice(0, 5)})`;
    socket.emit("user:join", myName || "Guest");
  });

  socket.on("disconnect", () => {
    $conn.textContent = "Disconnected";
  });

  // Toggle sidebar on ESC key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      sidebarVisible = !sidebarVisible;
      $userList.style.left = sidebarVisible ? "0" : "-220px";
    }
  });

  // Update active users
  socket.on("active-users", (users) => {
    $activeUsers.innerHTML = "";
    users.forEach((u) => {
      const li = document.createElement("li");
      li.textContent = u === myName ? `${u} (You)` : u;
      $activeUsers.appendChild(li);
    });
    $activeUsers.scrollTop = $activeUsers.scrollHeight;
  });

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function formatTime(date = new Date()) {
    let h = date.getHours();
    const m = date.getMinutes().toString().padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  }

  function renderMessage(
    { msgId, text, files = [], senderName, senderId },
    mine
  ) {
    const wrap = document.createElement("li");
    wrap.className = mine ? "meMsg" : "otherMsg";

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    if (text) bubble.appendChild(document.createTextNode(text));

    if (files.length) {
      const box = document.createElement("div");
      box.className = "msg-file";
      files.forEach((f) => {
        if (f.mimetype?.startsWith("image/")) {
          const img = document.createElement("img");
          img.src = f.url;
          img.alt = f.name;
          box.appendChild(img);
        } else {
          const a = document.createElement("a");
          a.href = f.url;
          a.target = "_blank";
          a.textContent =
            f.mimetype === "application/pdf"
              ? `📄 ${f.name}`
              : f.mimetype?.startsWith("video/")
              ? `🎬 ${f.name}`
              : f.name;
          box.appendChild(a);
        }
      });
      bubble.appendChild(box);
    }

    const meta = document.createElement("div");
    meta.className = "meta";
    const time = formatTime();
    meta.textContent = mine
      ? `You - ${time}`
      : `${senderName || "Anon"} - ${time}`;
    const tick = document.createElement("span");
    tick.className = "tick sent";
    tick.dataset.msgId = msgId;
    meta.appendChild(tick);

    const container = document.createElement("div");
    container.appendChild(bubble);
    container.appendChild(meta);
    wrap.appendChild(container);
    $messages.prepend(wrap);
  }

  async function uploadFiles() {
    const files = $files.files;
    if (!files || !files.length) return [];
    const fd = new FormData();
    for (const f of files) fd.append("files", f);
    const res = await fetch("/upload", { method: "POST", body: fd });
    const json = await res.json();
    return json.files || [];
  }

  async function SendMessage() {
    const text = ($text.value || "").trim();
    if (!text && (!$files.files || !$files.files.length)) return;
    const msgId = uid();
    const files = await uploadFiles();
    const payload = { msgId, text, files };
    renderMessage(
      { ...payload, senderName: myName, senderId: socket.id },
      true
    );
    socket.emit("chat:send", payload);
    $text.value = "";
    $files.value = "";
  }

  $text.addEventListener("keydown", async function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      await SendMessage();
    }
  });

  $send.addEventListener("click", SendMessage);

  socket.on("chat:receive", (payload) => {
    if (payload.senderId === socket.id) return;
    renderMessage(payload, false);
    socket.emit("chat:seen", {
      msgId: payload.msgId,
      senderId: payload.senderId,
    });
  });

  socket.on("chat:seen:update", ({ msgId }) => {
    const el = document.querySelector(`.tick[data-msg-id="${msgId}"]`);
    if (el) el.className = "tick seen";
  });
})();
