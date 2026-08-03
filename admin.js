/* ==========================================================================
   مشروع المخبتين القرآني — admin.js
   تعديل بيانات الطلاب وأيام الدوام محليًا، وتصدير data.js محدّث
   ========================================================================== */

(function () {
  "use strict";

  /* ---------------------------------------------------------------------
     حماية الصفحة بكلمة مرور
     ---------------------------------------------------------------------
     لتغييرها: افتح المتصفح على أي موقع، اذهب إلى Console (أدوات المطور)،
     واكتب الأمر التالي بعد وضع كلمة المرور الجديدة مكان NEW_PASSWORD:

       crypto.subtle.digest('SHA-256', new TextEncoder().encode('NEW_PASSWORD'))
         .then(b => console.log(Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('')))

     ثم انسخ القيمة الناتجة وضعها بدل القيمة الحالية في ADMIN_PASSWORD_HASH بالأسفل.
     ملاحظة: هذه حماية أساسية من جهة المتصفح فقط لمنع الدخول العرضي، وليست
     حماية قوية بمستوى خادم حقيقي — لا تستخدمها لبيانات حساسة جدًا.
  --------------------------------------------------------------------- */
  const ADMIN_PASSWORD_HASH = "28710d9171458c30b4a85ec6f7d481463bfda0da1897f7740a1ede970d31f3ad";

  async function sha256(text) {
    const enc = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  const lockOverlay = document.getElementById("lockOverlay");
  const adminContent = document.getElementById("adminContent");
  const lockForm = document.getElementById("lockForm");
  const lockInput = document.getElementById("lockPasswordInput");
  const lockError = document.getElementById("lockError");
  let adminInitialized = false;

  function unlock() {
    lockOverlay.style.display = "none";
    adminContent.classList.remove("admin-hidden");
    lockError.textContent = "";
    lockInput.value = "";
    if (!adminInitialized) {
      adminInitialized = true;
      initAdminPanel();
    }
  }

  function lockAdmin() {
    adminContent.classList.add("admin-hidden");
    lockOverlay.style.display = "flex";
    lockError.textContent = "";
    lockInput.value = "";
  }

  lockForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const val = lockInput.value;
    let hash;
    try {
      hash = await sha256(val);
    } catch (err) {
      // إن لم يدعم المتصفح Web Crypto (نادر جدًا)، لا يمكن التحقق بأمان
      lockError.textContent = "تعذر التحقق من كلمة المرور في هذا المتصفح.";
      return;
    }
    if (hash === ADMIN_PASSWORD_HASH) {
      unlock();
    } else {
      lockError.textContent = "كلمة المرور غير صحيحة، حاول مرة أخرى.";
      lockInput.value = "";
      lockInput.focus();
    }
  });

  document.getElementById("logoutBtn").addEventListener("click", () => {
    lockAdmin();
    lockInput.focus();
  });

  // قفل الصفحة عند مغادرتها، بما في ذلك العودة للموقع العام وزر الرجوع في المتصفح.
  window.addEventListener("pagehide", lockAdmin);
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) lockAdmin();
  });

  function initAdminPanel() {

  const STORAGE_KEY = "mokhbiteen_draft_data_v2";
  const WEIGHTS = { attendance: 0.10, memorization: 0.30, revision: 0.30, worship: 0.20, evaluation: 0.10 };

  // تحميل نسخة العمل: من التخزين المحلي إن وجدت، وإلا من data.js الأصلي
  let workingData = loadDraft() || JSON.parse(JSON.stringify(MOKHBITEEN_DATA));
  let activeDayIndex = 0;
  if (!workingData.meta.year) workingData.meta.year = String(new Date().getFullYear());

  function loadDraft() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function saveDraft() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(workingData)); } catch (e) {}
  }
  function showToast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2400);
  }

  /* ---------------------------------------------------------------------
     بيانات عامة
  --------------------------------------------------------------------- */
  const metaFields = document.getElementById("metaFields");
  const metaDefs = [
    ["heroTitle", "عنوان لوحة الشرف"],
    ["heroDesc", "الوصف القصير"],
    ["monthLabel", "اسم الشهر"],
    ["year", "السنة"],
    ["supervisor", "اسم المشرف"],
    ["supervisorTitle", "صفة المشرف"]
  ];
  function renderMeta() {
    metaFields.innerHTML = "";
    metaDefs.forEach(([key, label]) => {
      const div = document.createElement("div");
      div.className = "meta-field";
      div.innerHTML = `<label>${label}</label><input type="text" data-meta="${key}" value="${escapeAttr(workingData.meta[key] || "")}">`;
      metaFields.appendChild(div);
    });
  }
  metaFields.addEventListener("input", (e) => {
    const key = e.target.dataset.meta;
    if (!key) return;
    workingData.meta[key] = e.target.value;
    saveDraft();
  });

  /* ---------------------------------------------------------------------
     تبويبات الأيام
  --------------------------------------------------------------------- */
  const dayTabs = document.getElementById("dayTabs");
  function renderDayTabs() {
    dayTabs.innerHTML = "";
    workingData.days.forEach((d, i) => {
      const btn = document.createElement("button");
      btn.className = "admin-tab" + (i === activeDayIndex ? " active" : "");
      btn.textContent = `اللقاء ${d.meetingNumber} (${d.date || "بدون تاريخ"})`;
      btn.addEventListener("click", () => { activeDayIndex = i; renderDayTabs(); renderStudentsTable(); });
      dayTabs.appendChild(btn);
    });
  }

  /* ---------------------------------------------------------------------
     جدول تعديل الطلاب لليوم النشط
  --------------------------------------------------------------------- */
  const studentsEditTable = document.getElementById("studentsEditTable");

  function recalcStudent(st) {
    // إعادة حساب متوسطات الطالب عبر الأيام الخمسة، ثم المعدل النهائي
    const n = st.days.length || 1;
    const sum = { attendance: 0, memorization: 0, revision: 0, worship: 0, evaluation: 0 };
    st.days.forEach((d) => {
      sum.attendance += d.attendance;
      sum.memorization += d.memorization;
      sum.revision += d.revision;
      sum.worship += d.worship;
      sum.evaluation += d.evaluation;
      d.dayAverage = round1(
        d.attendance * WEIGHTS.attendance + d.memorization * WEIGHTS.memorization +
        d.revision * WEIGHTS.revision + d.worship * WEIGHTS.worship + d.evaluation * WEIGHTS.evaluation
      );
    });
    st.attendance = round1(sum.attendance / n);
    st.memorization = round1(sum.memorization / n);
    st.revision = round1(sum.revision / n);
    st.worship = round1(sum.worship / n);
    st.evaluation = round1(sum.evaluation / n);
    st.final = round1(
      st.attendance * WEIGHTS.attendance + st.memorization * WEIGHTS.memorization +
      st.revision * WEIGHTS.revision + st.worship * WEIGHTS.worship + st.evaluation * WEIGHTS.evaluation
    );
  }

  function recalcAllAndRank() {
    workingData.students.forEach(recalcStudent);
    workingData.students.sort((a, b) => b.final - a.final);
    workingData.students.forEach((s, i) => (s.rank = i + 1));

    // تحديث متوسط كل يوم للمجموعة وإحصائيات عامة
    workingData.days.forEach((d) => {
      let sum = 0, count = 0, present = 0;
      workingData.students.forEach((st) => {
        const dd = st.days[workingData.days.indexOf(d)];
        if (dd) { sum += dd.dayAverage; count++; if (dd.attendance > 0) present++; }
      });
      d.groupAverage = count ? round1(sum / count) : 0;
      d.presentCount = present;
      d.totalCount = count;
    });

    const totalStudents = workingData.students.length;
    const finals = workingData.students.map((s) => s.final);
    const attendances = workingData.students.map((s) => s.attendance);
    workingData.stats.studentsCount = totalStudents;
    workingData.stats.daysCount = workingData.days.length;
    workingData.stats.groupAverage = round1(finals.reduce((a, b) => a + b, 0) / totalStudents);
    workingData.stats.topAverage = round1(Math.max(...finals));
    workingData.stats.attendanceRate = round1(attendances.reduce((a, b) => a + b, 0) / totalStudents);

    workingData.criteriaAverages = {
      attendance: round1(avgField("attendance")),
      memorization: round1(avgField("memorization")),
      revision: round1(avgField("revision")),
      worship: round1(avgField("worship")),
      evaluation: round1(avgField("evaluation"))
    };
  }
  function avgField(field) {
    const arr = workingData.students.map((s) => s[field]);
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
  function round1(v) { return Math.round(v * 10) / 10; }
  function escapeAttr(s) { return String(s).replace(/"/g, "&quot;"); }

  /* ---------------------------------------------------------------------
     إدارة الشهر واللقاءات
  --------------------------------------------------------------------- */
  const meetingsManager = document.getElementById("meetingsManager");
  const newMonthLabel = document.getElementById("newMonthLabel");
  const newMonthYear = document.getElementById("newMonthYear");
  const newMeetingsCount = document.getElementById("newMeetingsCount");
  newMonthYear.value = workingData.meta.year;

  function pad2(value) { return String(value).padStart(2, "0"); }
  function toCalendarDate(displayDate) {
    if (!displayDate) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(displayDate)) return displayDate;
    const parts = String(displayDate).split("/");
    if (parts.length !== 2) return "";
    return `${workingData.meta.year}-${pad2(parts[1])}-${pad2(parts[0])}`;
  }
  function toDisplayDate(calendarDate) {
    if (!calendarDate) return "";
    const [year, month, day] = calendarDate.split("-");
    if (year) workingData.meta.year = year;
    return `${day}/${month}`;
  }
  function emptyStudentDay(date) {
    return { date: date || "", attendance: 0, memorization: 0, revision: 0, worship: 0, evaluation: 0, dayAverage: 0 };
  }
  function emptyMeeting(index) {
    return {
      id: `meeting-${Date.now()}-${index}`,
      date: "",
      meetingNumber: index + 1,
      groupAverage: 0,
      presentCount: 0,
      totalCount: workingData.students.length,
      achievement: "يُضاف إنجاز هذا اللقاء",
      nextRequired: "يُضاف المطلوب للقاء القادم",
      note: "",
      motivation: ""
    };
  }
  function renumberMeetings() {
    workingData.days.forEach((day, index) => { day.meetingNumber = index + 1; });
  }
  function renderMeetingsManager() {
    meetingsManager.innerHTML = workingData.days.map((day, index) => `
      <div class="meeting-manage-row">
        <strong>اللقاء ${index + 1}</strong>
        <div class="meta-field">
          <label>تاريخ اللقاء</label>
          <input type="date" data-meeting-date="${index}" value="${toCalendarDate(day.date)}">
        </div>
        <button class="row-del" data-delete-meeting="${index}" title="حذف اللقاء"><i class="fa-solid fa-trash"></i></button>
      </div>`).join("");
  }

  meetingsManager.addEventListener("change", (e) => {
    if (e.target.dataset.meetingDate === undefined) return;
    const index = Number(e.target.dataset.meetingDate);
    const displayDate = toDisplayDate(e.target.value);
    workingData.days[index].date = displayDate;
    workingData.students.forEach((student) => {
      if (student.days[index]) student.days[index].date = displayDate;
    });
    recalcAllAndRank();
    saveDraft();
    renderMeta();
    renderDayTabs();
    renderStudentsTable();
    renderAchievements();
    showToast("تم تحديث تاريخ اللقاء");
  });

  meetingsManager.addEventListener("click", (e) => {
    const button = e.target.closest("[data-delete-meeting]");
    if (!button) return;
    if (workingData.days.length <= 1) {
      showToast("يجب أن يبقى لقاء واحد على الأقل");
      return;
    }
    const index = Number(button.dataset.deleteMeeting);
    if (!confirm(`هل تريد حذف اللقاء ${index + 1} ودرجاته؟`)) return;
    workingData.days.splice(index, 1);
    workingData.students.forEach((student) => student.days.splice(index, 1));
    renumberMeetings();
    activeDayIndex = Math.min(activeDayIndex, workingData.days.length - 1);
    recalcAllAndRank();
    saveDraft();
    renderAll();
    showToast("تم حذف اللقاء");
  });

  document.getElementById("addMeetingBtn").addEventListener("click", () => {
    if (workingData.days.length >= 12) {
      showToast("الحد الأقصى 12 لقاء");
      return;
    }
    workingData.days.push(emptyMeeting(workingData.days.length));
    workingData.students.forEach((student) => student.days.push(emptyStudentDay("")));
    renumberMeetings();
    recalcAllAndRank();
    saveDraft();
    renderAll();
    showToast("تمت إضافة لقاء جديد — اختر تاريخه من التقويم");
  });

  document.getElementById("startNewMonthBtn").addEventListener("click", () => {
    const label = newMonthLabel.value.trim();
    const year = String(newMonthYear.value || "").trim();
    const count = Math.max(1, Math.min(12, Number(newMeetingsCount.value) || 5));
    if (!label) {
      showToast("اكتب اسم الشهر الجديد أولًا");
      newMonthLabel.focus();
      return;
    }
    if (!confirm(`سيتم تنزيل نسخة احتياطية ثم بدء ${label} وتصفير جميع النتائج. هل تريد المتابعة؟`)) return;
    downloadText(buildFileText(), `نسخة-احتياطية-${workingData.meta.monthLabel.replace(/\s+/g, "-")}.js`);
    workingData.meta.monthLabel = label;
    workingData.meta.year = year || String(new Date().getFullYear());
    newMonthYear.value = workingData.meta.year;
    workingData.meta.heroTitle = `لوحة شرف ${label}`;
    workingData.days = Array.from({ length: count }, (_, index) => emptyMeeting(index));
    workingData.students.forEach((student) => {
      student.days = workingData.days.map(() => emptyStudentDay(""));
    });
    activeDayIndex = 0;
    recalcAllAndRank();
    saveDraft();
    newMonthLabel.value = "";
    renderAll();
    showToast(`تم بدء ${label} — اختر تواريخ اللقاءات من التقويم`);
  });

  function renderStudentsTable() {
    const dayIdx = activeDayIndex;
    let html = `
      <div class="student-row-edit head">
        <span>#</span><span>الاسم</span><span>الدوام</span><span>الحفظ</span><span>المراجعة</span><span>العبادات</span><span>التقييم</span><span></span>
      </div>`;
    workingData.students.forEach((st, si) => {
      const d = st.days[dayIdx];
      html += `
        <div class="student-row-edit" data-si="${si}">
          <span>${st.rank}</span>
          <input type="text" data-field="name" value="${escapeAttr(st.name)}">
          <input type="number" min="0" max="100" data-field="attendance" value="${d.attendance}">
          <input type="number" min="0" max="100" data-field="memorization" value="${d.memorization}">
          <input type="number" min="0" max="100" data-field="revision" value="${d.revision}">
          <input type="number" min="0" max="100" data-field="worship" value="${d.worship}">
          <input type="number" min="0" max="100" data-field="evaluation" value="${d.evaluation}">
          <button class="row-del" data-del="${si}" title="حذف الطالب"><i class="fa-solid fa-trash"></i></button>
        </div>`;
    });
    studentsEditTable.innerHTML = html;
  }

  studentsEditTable.addEventListener("input", (e) => {
    const row = e.target.closest(".student-row-edit");
    if (!row || row.classList.contains("head")) return;
    const si = parseInt(row.dataset.si);
    const field = e.target.dataset.field;
    const st = workingData.students[si];
    if (field === "name") {
      st.name = e.target.value;
    } else {
      const v = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
      st.days[activeDayIndex][field] = v;
    }
    recalcAllAndRank();
    saveDraft();
    renderStudentsTable();
  });

  studentsEditTable.addEventListener("click", (e) => {
    const delBtn = e.target.closest("[data-del]");
    if (!delBtn) return;
    const si = parseInt(delBtn.dataset.del);
    if (confirm(`هل تريد حذف الطالب "${workingData.students[si].name}"؟`)) {
      workingData.students.splice(si, 1);
      recalcAllAndRank();
      saveDraft();
      renderStudentsTable();
      showToast("تم حذف الطالب");
    }
  });

  document.getElementById("addStudentBtn").addEventListener("click", () => {
    const newId = Math.max(0, ...workingData.students.map((s) => s.id)) + 1;
    const emptyDays = workingData.days.map((d) => ({
      date: d.date, attendance: 0, memorization: 0, revision: 0, worship: 0, evaluation: 0, dayAverage: 0
    }));
    workingData.students.push({
      id: newId, name: "طالب جديد", final: 0, attendance: 0, memorization: 0,
      revision: 0, worship: 0, evaluation: 0, days: emptyDays, rank: workingData.students.length + 1
    });
    recalcAllAndRank();
    saveDraft();
    renderStudentsTable();
    showToast("تمت إضافة طالب جديد");
  });

  /* ---------------------------------------------------------------------
     إنجازات الأيام
  --------------------------------------------------------------------- */
  const daysAchievements = document.getElementById("daysAchievements");
  function renderAchievements() {
    daysAchievements.innerHTML = "";
    workingData.days.forEach((d, i) => {
      const box = document.createElement("div");
      box.style.marginBottom = "22px";
      box.style.paddingBottom = "18px";
      box.style.borderBottom = "1px solid rgba(31,107,82,.1)";
      box.innerHTML = `
        <h3 style="margin:0 0 10px;color:var(--navy-deep);font-size:1rem">اللقاء ${d.meetingNumber} — ${d.date || "بدون تاريخ"}</h3>
        <div class="day-field-grid">
          <div class="meta-field"><label>الإنجاز</label><textarea rows="2" data-day="${i}" data-field="achievement">${d.achievement}</textarea></div>
          <div class="meta-field"><label>المطلوب للقاء القادم</label><textarea rows="2" data-day="${i}" data-field="nextRequired">${d.nextRequired}</textarea></div>
          <div class="meta-field"><label>ملاحظة عامة</label><textarea rows="2" data-day="${i}" data-field="note">${d.note}</textarea></div>
          <div class="meta-field"><label>عبارة تحفيزية</label><textarea rows="2" data-day="${i}" data-field="motivation">${d.motivation}</textarea></div>
        </div>`;
      daysAchievements.appendChild(box);
    });
  }
  daysAchievements.addEventListener("input", (e) => {
    const dayIdx = e.target.dataset.day;
    const field = e.target.dataset.field;
    if (dayIdx === undefined || !field) return;
    workingData.days[dayIdx][field] = e.target.value;
    saveDraft();
  });

  /* ---------------------------------------------------------------------
     التصدير
  --------------------------------------------------------------------- */
  function buildFileText() {
    return `// بيانات ${workingData.meta.projectName} - ${workingData.meta.monthLabel}\n// يمكن تعديل أي قيمة هنا مباشرة\nconst MOKHBITEEN_DATA = ` +
      JSON.stringify(workingData, null, 2) + ";\n";
  }

  function downloadText(text, filename) {
    const blob = new Blob([text], { type: "text/javascript;charset=utf-8" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  document.getElementById("exportBtn").addEventListener("click", () => {
    downloadText(buildFileText(), "data.js");
    showToast("تم تنزيل data.js — استبدل به الملف القديم");
  });

  document.getElementById("previewBtn").addEventListener("click", () => {
    const pre = document.getElementById("exportPreview");
    pre.style.display = pre.style.display === "none" ? "block" : "none";
    pre.textContent = buildFileText();
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    if (!confirm("سيتم استرجاع البيانات الأصلية والتخلي عن كل التعديلات المحلية. هل أنت متأكد؟")) return;
    localStorage.removeItem(STORAGE_KEY);
    workingData = JSON.parse(JSON.stringify(MOKHBITEEN_DATA));
    if (!workingData.meta.year) workingData.meta.year = String(new Date().getFullYear());
    activeDayIndex = 0;
    newMonthYear.value = workingData.meta.year;
    renderAll();
    showToast("تم استرجاع البيانات الأصلية");
  });

  /* ---------------------------------------------------------------------
     التشغيل
  --------------------------------------------------------------------- */
  function renderAll() {
    renderMeta();
    renderMeetingsManager();
    renderDayTabs();
    renderStudentsTable();
    renderAchievements();
  }
  renderAll();

  } // نهاية initAdminPanel

})();
