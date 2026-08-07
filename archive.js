(function () {
  "use strict";
  const content = document.getElementById("archiveContent");

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
  }
  function number(value) { return Number(value || 0).toFixed(1); }
  function meetingText(value) {
    const text = String(value || "").trim();
    return !text || text.startsWith("يُضاف") ? "----" : text;
  }

  function renderArchive(row) {
    const data = row.data;
    const meta = data.meta || {};
    const students = [...(data.students || [])].sort((a, b) => (a.rank || 999) - (b.rank || 999));
    const winners = students.slice(0, 3);
    const stats = data.stats || {};
    document.title = `${row.title} | مشروع المخبتين القرآني`;
    content.innerHTML = `
      <header class="archive-hero">
        <img src="assets/logo.png" alt="شعار المشروع">
        <span>من أرشيف مشروع المخبتين القرآني</span>
        <h1>${escapeHtml(row.title)}</h1>
        <p>${escapeHtml(row.month_label)} — ${escapeHtml(row.year)} · نسخة محفوظة كما نُشرت</p>
      </header>
      <div class="archive-inner">
        <section class="archive-section">
          <div class="archive-section-head"><span>أصحاب المراكز الأولى</span><h2>منصة التتويج</h2></div>
          <div class="archive-podium">${winners.map((student, index) => `
            <article class="archive-winner">
              <img src="${escapeHtml(student.photo || "assets/logo.png")}" alt="صورة ${escapeHtml(student.name)}">
              <strong>${index + 1}. ${escapeHtml(student.name)}</strong>
              <b>${number(student.final)}</b>
            </article>`).join("")}</div>
        </section>
        <div class="archive-stats">
          <div class="archive-stat"><i class="fa-solid fa-users"></i><strong>${students.length}</strong><span>عدد الطلاب</span></div>
          <div class="archive-stat"><i class="fa-solid fa-calendar-check"></i><strong>${(data.days || []).length}</strong><span>عدد اللقاءات</span></div>
          <div class="archive-stat"><i class="fa-solid fa-chart-line"></i><strong>${number(stats.groupAverage)}%</strong><span>معدل المجموعة</span></div>
          <div class="archive-stat"><i class="fa-solid fa-user-check"></i><strong>${number(stats.attendanceRate)}%</strong><span>نسبة الحضور</span></div>
        </div>
        <section class="archive-section">
          <div class="archive-section-head"><span>رحلة الشهر</span><h2>اللقاءات والمحطات</h2></div>
          <div class="archive-meetings">${(data.days || []).map((day) => `
            <article class="archive-meeting">
              <div class="archive-meeting-head"><b>اللقاء ${escapeHtml(day.meetingNumber)}</b><span>${escapeHtml(day.date)}</span></div>
              <dl>
                <div><dt>إنجاز اليوم</dt><dd>${escapeHtml(meetingText(day.achievement))}</dd></div>
                <div><dt>المطلوب للقاء القادم</dt><dd>${escapeHtml(meetingText(day.nextRequired))}</dd></div>
              </dl>
            </article>`).join("")}</div>
        </section>
        <section class="archive-section">
          <div class="archive-section-head"><span>نتائج الشهر</span><h2>ترتيب الطلاب</h2></div>
          <div class="archive-students"><table><thead><tr><th>الترتيب</th><th>الطالب</th><th>الدوام</th><th>الحفظ</th><th>المراجعة</th><th>العبادات</th><th>التقييم</th><th>المعدل النهائي</th></tr></thead>
          <tbody>${students.map((student) => `<tr>
            <td>${escapeHtml(student.rank)}</td>
            <td><div class="archive-student-name"><img src="${escapeHtml(student.photo || "assets/logo.png")}" alt=""><span>${escapeHtml(student.name)}</span></div></td>
            <td>${number(student.attendance)}%</td><td>${number(student.memorization)}%</td><td>${number(student.revision)}%</td><td>${number(student.worship)}%</td><td>${number(student.evaluation)}%</td><td class="archive-score">${number(student.final)}%</td>
          </tr>`).join("")}</tbody></table></div>
        </section>
      </div>`;
  }

  async function loadArchive() {
    const key = new URLSearchParams(location.search).get("key");
    if (!key) {
      content.innerHTML = '<div class="archive-error"><i class="fa-solid fa-circle-exclamation"></i><p>لم يتم تحديد لوحة مؤرشفة.</p></div>';
      return;
    }
    try {
      const config = window.MOKHBITEEN_SUPABASE;
      const response = await fetch(
        `${config.url}/rest/v1/honor_board_archives?select=archive_key,month_label,year,title,data&archive_key=eq.${encodeURIComponent(key)}`,
        { headers: { apikey: config.publishableKey }, cache: "no-store" }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const rows = await response.json();
      if (!rows.length) throw new Error("Archive not found");
      renderArchive(rows[0]);
    } catch (error) {
      console.error("تعذر فتح اللوحة المؤرشفة:", error);
      content.innerHTML = '<div class="archive-error"><i class="fa-solid fa-box-open"></i><p>تعذر العثور على هذه اللوحة المؤرشفة.</p></div>';
    }
  }

  loadArchive();
})();
