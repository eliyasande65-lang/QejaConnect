/* QejaConnect shared icon set + side menu.
   Usage: put <div class="overlay" id="overlay" onclick="closeMenu()"></div>
          <div class="side-menu" id="sideMenu"></div>
          <script src="sidemenu.js"></script>
   in the page, and link sidemenu.css in <head>. */
(function () {
    "use strict";

    // ── Icon registry (Lucide-style, 24x24, stroke = currentColor) ──
    var ICONS = {"menu":"<line x1=\"3\" y1=\"6\" x2=\"21\" y2=\"6\"/><line x1=\"3\" y1=\"12\" x2=\"21\" y2=\"12\"/><line x1=\"3\" y1=\"18\" x2=\"21\" y2=\"18\"/>","x":"<path d=\"M18 6 6 18\"/><path d=\"m6 6 12 12\"/>","home":"<path d=\"m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"/><polyline points=\"9 22 9 12 15 12 15 22\"/>","bot":"<path d=\"M12 8V4H8\"/><rect width=\"16\" height=\"12\" x=\"4\" y=\"8\" rx=\"2\"/><path d=\"M2 14h2\"/><path d=\"M20 14h2\"/><path d=\"M15 13v2\"/><path d=\"M9 13v2\"/>","bell":"<path d=\"M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9\"/><path d=\"M10.3 21a1.94 1.94 0 0 0 3.4 0\"/>","flame":"<path d=\"M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z\"/>","check-circle":"<path d=\"M22 11.08V12a10 10 0 1 1-5.93-9.14\"/><polyline points=\"22 4 12 14.01 9 11.01\"/>","map":"<polygon points=\"3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21\"/><line x1=\"9\" x2=\"9\" y1=\"3\" y2=\"18\"/><line x1=\"15\" x2=\"15\" y1=\"6\" y2=\"21\"/>","map-pin":"<path d=\"M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z\"/><circle cx=\"12\" cy=\"10\" r=\"3\"/>","bookmark":"<path d=\"m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z\"/>","message":"<path d=\"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z\"/>","alert-triangle":"<path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3\"/><path d=\"M12 9v4\"/><path d=\"M12 17h.01\"/>","alert-circle":"<circle cx=\"12\" cy=\"12\" r=\"10\"/><line x1=\"12\" x2=\"12\" y1=\"8\" y2=\"12\"/><line x1=\"12\" x2=\"12.01\" y1=\"16\" y2=\"16\"/>","info":"<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16v-4\"/><path d=\"M12 8h.01\"/>","bed":"<path d=\"M2 4v16\"/><path d=\"M2 8h18a2 2 0 0 1 2 2v10\"/><path d=\"M2 17h20\"/><path d=\"M6 8v9\"/>","bath":"<path d=\"M9 6 6.5 3.5a1.5 1.5 0 0 0-1-.5C4.683 3 4 3.683 4 4.5V17a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5\"/><line x1=\"10\" x2=\"8\" y1=\"5\" y2=\"7\"/><line x1=\"2\" x2=\"22\" y1=\"12\" y2=\"12\"/><line x1=\"7\" x2=\"7\" y1=\"19\" y2=\"21\"/><line x1=\"17\" x2=\"17\" y1=\"19\" y2=\"21\"/>","building":"<rect width=\"16\" height=\"20\" x=\"4\" y=\"2\" rx=\"2\"/><path d=\"M9 22v-4h6v4\"/><path d=\"M8 6h.01\"/><path d=\"M16 6h.01\"/><path d=\"M12 6h.01\"/><path d=\"M12 10h.01\"/><path d=\"M12 14h.01\"/><path d=\"M16 10h.01\"/><path d=\"M16 14h.01\"/><path d=\"M8 10h.01\"/><path d=\"M8 14h.01\"/>","maximize":"<path d=\"M8 3H5a2 2 0 0 0-2 2v3\"/><path d=\"M21 8V5a2 2 0 0 0-2-2h-3\"/><path d=\"M3 16v3a2 2 0 0 0 2 2h3\"/><path d=\"M16 21h3a2 2 0 0 0 2-2v-3\"/>","calendar":"<rect width=\"18\" height=\"18\" x=\"3\" y=\"4\" rx=\"2\"/><path d=\"M16 2v4\"/><path d=\"M8 2v4\"/><path d=\"M3 10h18\"/>","wallet":"<path d=\"M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1\"/><path d=\"M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4\"/>","megaphone":"<path d=\"m3 11 18-5v12L3 14v-3z\"/><path d=\"M11.6 16.8a3 3 0 1 1-5.8-1.6\"/>","wrench":"<path d=\"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z\"/>","sparkles":"<path d=\"m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z\"/>","gift":"<rect x=\"3\" y=\"8\" width=\"18\" height=\"4\" rx=\"1\"/><path d=\"M12 8v13\"/><path d=\"M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7\"/><path d=\"M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5\"/>","arrow-up-right":"<path d=\"M7 7h10v10\"/><path d=\"M7 17 17 7\"/>","users":"<path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/><path d=\"M22 21v-2a4 4 0 0 0-3-3.87\"/><path d=\"M16 3.13a4 4 0 0 1 0 7.75\"/>","mail":"<rect width=\"20\" height=\"16\" x=\"2\" y=\"4\" rx=\"2\"/><path d=\"m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7\"/>","dashboard":"<rect width=\"7\" height=\"9\" x=\"3\" y=\"3\" rx=\"1\"/><rect width=\"7\" height=\"5\" x=\"14\" y=\"3\" rx=\"1\"/><rect width=\"7\" height=\"9\" x=\"14\" y=\"12\" rx=\"1\"/><rect width=\"7\" height=\"5\" x=\"3\" y=\"16\" rx=\"1\"/>","user":"<path d=\"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2\"/><circle cx=\"12\" cy=\"7\" r=\"4\"/>","life-buoy":"<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"m4.93 4.93 4.24 4.24\"/><path d=\"m14.83 9.17 4.24-4.24\"/><path d=\"m14.83 14.83 4.24 4.24\"/><path d=\"m9.17 14.83-4.24 4.24\"/><circle cx=\"12\" cy=\"12\" r=\"4\"/>","log-out":"<path d=\"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4\"/><polyline points=\"16 17 21 12 16 7\"/><line x1=\"21\" x2=\"9\" y1=\"12\" y2=\"12\"/>","moon":"<path d=\"M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z\"/>","key":"<path d=\"m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4\"/>","log-in":"<path d=\"M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4\"/><polyline points=\"10 17 15 12 10 7\"/><line x1=\"15\" x2=\"3\" y1=\"12\" y2=\"12\"/>"};
    window.QC_ICONS = ICONS;
    window.qcIcon = function (name) {
        return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (ICONS[name] || "") + "</svg>";
    };

    var menu = document.getElementById("sideMenu");
    if (!menu) return;

    function store(key) {
        try { return localStorage.getItem(key); } catch (e) { return null; }
    }
    var token = store("token");
    var role  = store("role");
    var page  = (location.pathname.split("/").pop() || "index.html").toLowerCase();

    // The Theme item only appears on pages that actually ship dark-mode styles.
    function supportsDark() {
        try {
            for (var i = 0; i < document.styleSheets.length; i++) {
                var rules = document.styleSheets[i].cssRules || [];
                for (var j = 0; j < rules.length; j++) {
                    if (rules[j].selectorText && rules[j].selectorText.indexOf("body.dark") !== -1) return true;
                }
            }
        } catch (e) { /* cross-origin sheet */ }
        return false;
    }

    function item(o) {
        var active = o.href && o.href.toLowerCase() === page ? " active-link" : "";
        var attrs  = (o.id ? ' id="' + o.id + '"' : "") + (o.action ? ' data-qc-action="' + o.action + '"' : "");
        var badge  = o.badgeId ? '<span id="' + o.badgeId + '" class="menu-badge" style="display:none;">0</span>' : "";
        return '<a href="' + o.href + '" class="' + (o.cls || "") + active + '"' + attrs + ">" +
               qcIcon(o.icon) + '<span class="menu-label">' + o.label + "</span>" + badge + "</a>";
    }
    function section(t) { return '<div class="menu-section">' + t + "</div>"; }

    var myHouse = role === "landlord" ? "landlord_tenants.html" : "mytenancy.html";

    var nav =
        section("Account") +
        item({ href: "home.html",            icon: "home",      label: "Home" }) +
        item({ href: "hostdashboard.html",   icon: "dashboard", label: "Dashboard", id: "menuDashboard", badgeId: "menuDashboardBadge" }) +
        item({ href: "myprofile.html",       icon: "user",      label: "Profile" }) +
        item({ href: myHouse,                icon: "key",       label: "My house" }) +
        item({ href: "bookings.html",        icon: "bookmark",  label: "My bookings" }) +
        item({ href: "notification.html",    icon: "bell",      label: "Notification" }) +
        section("Explore") +
        item({ href: "landlords.html",       icon: "building",  label: "Landlords" }) +
        item({ href: "#",                    icon: "users",     label: "Chat with housemates", action: "group" }) +
        item({ href: "refer-earn.html",      icon: "gift",      label: "Refer &amp; earn" }) +
        section("Help") +
        item({ href: "mymessages.html",      icon: "life-buoy", label: "Support team", id: "menuMessages", badgeId: "navNotifBadge" }) +
        item({ href: "#",                    icon: "bot",       label: "Ask QejaConnect AI", action: "ai" }) +
        item({ href: "about.html",           icon: "info",      label: "About us" }) +
        item({ href: "contact.html",         icon: "mail",      label: "Contact" });

    var footer = "";
    if (supportsDark()) {
        footer += '<button type="button" class="menu-item" data-qc-action="theme">' + qcIcon("moon") + '<span class="menu-label">Theme</span></button>';
    }
    footer += token
        ? item({ href: "index.html", icon: "log-out", label: "Log out", cls: "logout", action: "logout" })
        : item({ href: "login.html", icon: "log-in",  label: "Log in" });

    menu.className = "side-menu";
    menu.setAttribute("role", "navigation");
    menu.setAttribute("aria-label", "Main menu");
    menu.innerHTML =
        '<div class="side-menu-header">' +
            '<div class="side-menu-brand"><img src="logo.jpg" alt="QejaConnect logo">' +
            "<div><strong>QejaConnect</strong><span>Quality accommodation</span></div></div>" +
            '<button type="button" class="menu-close" onclick="closeMenu()" aria-label="Close menu">' + qcIcon("x") + "</button>" +
        "</div>" +
        '<div class="side-menu-nav">' + nav + "</div>" +
        '<div class="side-menu-footer">' + footer + "</div>";

    // Overlay (create if the page didn't include one)
    var overlay = document.getElementById("overlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.className = "overlay";
        overlay.id = "overlay";
        overlay.onclick = function () { window.closeMenu(); };
        menu.parentNode.insertBefore(overlay, menu);
    }

    // Hamburger buttons: swap the ☰ character for an SVG
    var burgers = document.querySelectorAll(".menu-btn");
    for (var b = 0; b < burgers.length; b++) {
        burgers[b].innerHTML = qcIcon("menu");
        burgers[b].setAttribute("aria-label", "Open menu");
    }

    function setOpen(open) {
        menu.classList.toggle("active", open);
        overlay.classList.toggle("active", open);
        document.body.classList.toggle("menu-open", open);
    }
    window.toggleMenu = function () { setOpen(!menu.classList.contains("active")); };
    window.closeMenu  = function () { setOpen(false); };

    // Stay in sync even if a page toggles the .active class itself
    if (window.MutationObserver) {
        new MutationObserver(function () {
            document.body.classList.toggle("menu-open", menu.classList.contains("active"));
        }).observe(menu, { attributes: true, attributeFilter: ["class"] });
    }
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") window.closeMenu();
    });

    // ── Fallbacks used when a page doesn't define its own ──
    function fallbackGoToMyGroup() {
        var uid = null;
        try { uid = JSON.parse(store("loggedUser") || "{}").id; } catch (e) {}
        if (!token || !uid) { alert("Please login first"); return; }
        if (role === "landlord") { location.href = "my-groups.html"; return; }
        fetch("https://qeja-backend-azkf.onrender.com/tenancy/tenant/" + uid, {
            headers: { "Authorization": "Bearer " + token }
        }).then(function (r) { return r.json(); }).then(function (data) {
            if (!data.success || !data.tenancy) {
                alert("You don't have an active tenancy yet, so there's no group chat to join.");
                return;
            }
            location.href = "property-group.html?property_id=" + data.tenancy.property_id;
        }).catch(function () { alert("Couldn't open your group chat. Please try again."); });
    }
    function fallbackToggleTheme() {
        document.body.classList.toggle("dark");
        try { localStorage.setItem("theme", document.body.classList.contains("dark") ? "dark" : "light"); } catch (e) {}
    }

    menu.addEventListener("click", function (e) {
        var el = e.target.closest ? e.target.closest("[data-qc-action]") : null;
        if (!el) return;
        var action = el.getAttribute("data-qc-action");

        if (action === "logout") {
            try { ["token", "role", "loggedUser"].forEach(function (k) { localStorage.removeItem(k); }); } catch (err) {}
            return; // let the link navigate
        }
        e.preventDefault();
        window.closeMenu();
        if (action === "group") {
            (typeof window.goToMyGroup === "function" ? window.goToMyGroup : fallbackGoToMyGroup)();
        } else if (action === "ai") {
            if (typeof window.openAiChat === "function") window.openAiChat();
            else location.href = "home.html?ai=1";   // pages without the widget hand off to home
        } else if (action === "theme") {
            (typeof window.toggleTheme === "function" ? window.toggleTheme : fallbackToggleTheme)();
        }
    });
})();
