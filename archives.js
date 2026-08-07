(function () {
  "use strict";
  const grid = document.getElementById("archivesGrid");
  if (!grid) return;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
  }

  async function loadArchives() {
    try {
      const config = window.MOKHBITEEN_SUPABASE;
      if (!config) throw new Error("Missing Supabase configuration");
      const response = await fetch(
        `${config.url}/rest/v1/honor_board_archives?select=archive_key,month_label,year,title,archived_at&order=year.desc,archived_at.desc`,
        { headers: { apikey: config.publishableKey }, cache: "no-store" }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const archives = await response.json();
      if (!archives.length) {
        grid.innerHTML = '<div class="archives-empty"><i class="fa-solid fa-box-open"></i><p>ستظهر لوحات الشرف السابقة هنا بعد أرشفة أول لوحة.</p></div>';
        return;
      }
      grid.innerHTML = archives.map((archive) => `
        <a class="archive-card" href="archive.html?key=${encodeURIComponent(archive.archive_key)}">
          <span class="archive-card-year">${escapeHtml(archive.year)}</span>
          <h3>${escapeHtml(archive.title)}</h3>
          <p>${escapeHtml(archive.month_label)} — نسخة محفوظة من لوحة الشرف</p>
          <span class="archive-card-footer"><span>عرض اللوحة</span><i class="fa-solid fa-arrow-left"></i></span>
        </a>`).join("");
    } catch (error) {
      console.error("تعذر تحميل أرشيف لوحات الشرف:", error);
      grid.innerHTML = '<div class="archives-empty"><i class="fa-solid fa-box-open"></i><p>لم يُفعّل الأرشيف بعد.</p></div>';
    }
  }

  loadArchives();
})();
