// Warn when opened with file:// because Web Storage behavior for file URLs is not guaranteed.
(() => {
  "use strict";
  if (location.protocol !== "file:") return;

  const nav = document.querySelector(".nav-tabs");
  if (!nav || document.getElementById("localMemoryNotice")) return;
  const note = document.createElement("article");
  note.id = "localMemoryNotice";
  note.className = "algorithm-note";
  note.style.marginBottom = "18px";
  note.innerHTML = `
    <h3>本地记忆模式</h3>
    <p>你当前是直接用 <code>file://</code> 打开的。为了让学习记录、30天计划和复习进度长期稳定保存在同一个浏览器存储空间，建议在 Windows 下双击项目里的 <strong>启动IELT.bat</strong>，以后固定从 <strong>http://127.0.0.1:8787/</strong> 打开。</p>`;
  nav.insertAdjacentElement("beforebegin", note);
})();
