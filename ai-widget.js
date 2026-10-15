/* QejaConnect AI floating assistant (self-contained).
   Add to any page with:  <script src="ai-widget.js" defer></script>
   Exposes window.openAiChat() / window.closeAiChat().
   Visiting any page that has this widget with ?ai=1 opens the chat on load. */
(function () {
    "use strict";
    if (window.__qcAiLoaded) return;
    window.__qcAiLoaded = true;

    var API_URL = "https://qeja-backend-azkf.onrender.com/ai/chat";
    var WELCOME =
        "Hello!\n\nI'm QejaConnect AI.\n\n" +
        "I can help you navigate QejaConnect, find houses,\ndo quick math, and answer questions about the platform.\n" +
        "If I don't know something yet, teach me and I'll remember!";

    var ICON_BOT = '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>';
    var ICON_X   = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

    var CSS =
        "#qc-ai-button{position:fixed;bottom:20px;right:20px;width:65px;height:65px;border-radius:50%;border:none;cursor:pointer;z-index:9990;background:#1a1535;color:#fff;display:flex;align-items:center;justify-content:center;padding:0;box-shadow:0 5px 20px rgba(0,0,0,.3);transition:transform .15s}" +
        "#qc-ai-button:hover{transform:scale(1.06)}" +
        "#qc-ai-chat{position:fixed;right:20px;bottom:95px;width:370px;height:min(600px,calc(100% - 115px));background:#fff;border-radius:18px;overflow:hidden;display:none;flex-direction:column;box-shadow:0 10px 40px rgba(0,0,0,.3);z-index:9991;font-family:'Segoe UI',system-ui,-apple-system,Roboto,Arial,sans-serif;color:#222}" +
        "#qc-ai-header{background:#1a1535;color:#fff;padding:15px}" +
        "#qc-ai-header h3{margin:0;font-size:18px;font-weight:600}" +
        "#qc-ai-header p{margin:4px 0 0;font-size:12px;opacity:.9}" +
        "#qc-close{float:right;cursor:pointer;display:flex;align-items:center;justify-content:center;width:28px;height:28px;border:none;background:none;color:#fff;padding:0}" +
        "#qc-ai-messages{flex:1;overflow-y:auto;padding:15px;background:#f8fafc}" +
        ".qc-message{margin-bottom:12px;max-width:85%;padding:12px;border-radius:15px;line-height:1.5;font-size:14px;white-space:pre-line;word-wrap:break-word}" +
        ".qc-user{background:#1a1535;color:#fff;margin-left:auto}" +
        ".qc-ai{background:#fff;border:1px solid #ddd}" +
        ".qc-typing{font-style:italic;color:#666}" +
        ".qc-ai a.qc-link{color:#0b57d0;font-weight:700;text-decoration:underline;word-break:break-all;cursor:pointer}" +
        ".qc-ai a.qc-link:hover{color:#0842a0}" +
        "#qc-ai-input-area{display:flex;padding:10px;border-top:1px solid #ddd;background:#fff}" +
        "#qc-ai-input{flex:1;min-width:0;border:1px solid #ccc;border-radius:12px;padding:12px;outline:none;font:inherit;font-size:14px}" +
        "#qc-ai-send{margin-left:8px;border:none;background:#1a1535;color:#fff;border-radius:12px;padding:12px 18px;cursor:pointer;font:inherit;font-size:14px}" +
        "@media(max-width:500px){#qc-ai-chat{width:100%;height:100%;right:0;bottom:0;border-radius:0}#qc-ai-button{bottom:15px;right:15px}}";

    var chat, input, messages;

    function sessionId() {
        var sid = null;
        try { sid = localStorage.getItem("qc_ai_session_id"); } catch (e) {}
        if (!sid) {
            sid = "sess_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
            try { localStorage.setItem("qc_ai_session_id", sid); } catch (e) {}
        }
        return sid;
    }

    // Turns http(s):// and www. URLs into bold blue clickable links.
    // Built from DOM nodes (no innerHTML), so message text can never inject markup.
    var URL_RE = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;
    function fillWithLinks(el, text) {
        var last = 0, m;
        URL_RE.lastIndex = 0;
        while ((m = URL_RE.exec(text)) !== null) {
            var url = m[0], trail = "";
            // keep sentence punctuation outside the link
            var t = url.match(/[.,;:!?)\]}]+$/);
            if (t) { trail = t[0]; url = url.slice(0, -trail.length); }
            if (!url) continue;
            if (m.index > last) el.appendChild(document.createTextNode(text.slice(last, m.index)));
            var a = document.createElement("a");
            a.className = "qc-link";
            a.href = /^https?:\/\//i.test(url) ? url : "https://" + url;
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            a.textContent = url;
            el.appendChild(a);
            last = m.index + url.length;
            URL_RE.lastIndex = last;
        }
        if (last < text.length) el.appendChild(document.createTextNode(text.slice(last)));
    }

    function addMessage(text, cls) {
        var div = document.createElement("div");
        div.className = "qc-message " + cls;
        if (/\bqc-ai\b/.test(cls) && !/qc-typing/.test(cls)) fillWithLinks(div, String(text));
        else div.textContent = text;
        messages.appendChild(div);
        messages.scrollTop = messages.scrollHeight;
        return div;
    }

    window.openAiChat = function () {
        if (!chat) return;
        chat.style.display = "flex";
        input.focus();
    };
    window.closeAiChat = function () {
        if (chat) chat.style.display = "none";
    };

    function send() {
        var message = input.value.trim();
        if (!message) return;
        addMessage(message, "qc-user");
        input.value = "";
        var typing = addMessage("Thinking...", "qc-ai qc-typing");

        var token = null, user = {};
        try { token = localStorage.getItem("token"); } catch (e) {}
        try { user = JSON.parse(localStorage.getItem("loggedUser") || "{}") || {}; } catch (e) {}

        fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify({ message: message, session_id: sessionId(), user_id: user.id ? user.id : null })
        })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            typing.remove();
            addMessage(data.reply || "No response received.", "qc-ai");
        })
        .catch(function () {
            typing.remove();
            addMessage("Unable to connect to QejaConnect AI.", "qc-ai");
        });
    }

    function build() {
        var style = document.createElement("style");
        style.id = "qc-ai-style";
        style.textContent = CSS;
        document.head.appendChild(style);

        var button = document.createElement("button");
        button.id = "qc-ai-button";
        button.type = "button";
        button.setAttribute("aria-label", "Ask QejaConnect AI");
        button.innerHTML = ICON_BOT;
        button.addEventListener("click", window.openAiChat);

        chat = document.createElement("div");
        chat.id = "qc-ai-chat";
        chat.setAttribute("role", "dialog");
        chat.setAttribute("aria-label", "QejaConnect AI chat");
        chat.innerHTML =
            '<div id="qc-ai-header">' +
                '<button type="button" id="qc-close" aria-label="Close chat">' + ICON_X + "</button>" +
                "<h3>QejaConnect AI</h3>" +
                "<p>Learns from you \u2014 powered by QejaConnect's own knowledge base</p>" +
            "</div>" +
            '<div id="qc-ai-messages"></div>' +
            '<div id="qc-ai-input-area"><input id="qc-ai-input" placeholder="Ask me anything..." autocomplete="off">' +
            '<button type="button" id="qc-ai-send">Send</button></div>';

        document.body.appendChild(button);
        document.body.appendChild(chat);

        input    = chat.querySelector("#qc-ai-input");
        messages = chat.querySelector("#qc-ai-messages");
        addMessage(WELCOME, "qc-ai");

        chat.querySelector("#qc-close").addEventListener("click", window.closeAiChat);
        chat.querySelector("#qc-ai-send").addEventListener("click", send);
        input.addEventListener("keydown", function (e) {
            if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); send(); }
        });
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape") window.closeAiChat();
        });

        // Opened via the menu from a page without the widget (home.html?ai=1)
        if (/[?&]ai=1(&|$)/.test(location.search)) {
            window.openAiChat();
            try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) {}
        }
    }

    if (document.body) build();
    else document.addEventListener("DOMContentLoaded", build);
})();
