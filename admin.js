/* ==========================================================================
   مشروع المخبتين القرآني — admin.js
   تعديل بيانات الطلاب وأيام الدوام محليًا، وتصدير data.js محدّث
   ========================================================================== */

(function () {
  "use strict";

  const supabaseConfig = window.MOKHBITEEN_SUPABASE;
  const supabaseClient = supabaseConfig && window.supabase
    ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
      })
    : null;

  const lockOverlay = document.getElementById("lockOverlay");
  const adminContent = document.getElementById("adminContent");
  const lockForm = document.getElementById("lockForm");
  const lockEmail = document.getElementById("lockEmailInput");
  const lockInput = document.getElementById("lockPasswordInput");
  const lockError = document.getElementById("lockError");
  let adminInitialized = false;

  function unlock() {
    lockOverlay.style.display = "none";
    adminContent.classList.remove("admin-hidden");
    lockError.textContent = "";
    lockEmail.value = "";
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
    lockEmail.value = "";
    lockInput.value = "";
  }

  lockForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!supabaseClient) {
      lockError.textContent = "تعذر الاتصال بخدمة تسجيل الدخول. تحقق من الإنترنت ثم أعد المحاولة.";
      return;
    }
    const submitButton = lockForm.querySelector("button[type='submit']");
    submitButton.disabled = true;
    submitButton.textContent = "جاري التحقق...";
    const { error } = await supabaseClient.auth.signInWithPassword({
      email: lockEmail.value.trim(),
      password: lockInput.value
    });
    submitButton.disabled = false;
    submitButton.textContent = "دخول";
    if (!error) {
      unlock();
    } else {
      lockError.textContent = "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
      lockInput.value = "";
      lockInput.focus();
    }
  });

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    if (supabaseClient) await supabaseClient.auth.signOut();
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
  if (workingData.meta.sitePublished === undefined) workingData.meta.sitePublished = true;

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
     حالة النشر والمعاينة الخاصة
  --------------------------------------------------------------------- */
  const publishStatus = document.getElementById("publishStatus");
  const publishStatusText = document.getElementById("publishStatusText");
  function renderPublicationStatus() {
    const isLive = workingData.meta.sitePublished !== false;
    publishStatus.classList.toggle("is-live", isLive);
    publishStatusText.textContent = isLive
      ? "الموقع مفتوح حاليًا للزوار"
      : "الموقع مغلق حاليًا — الزوار يرون صفحة الانتظار";
  }

  async function updateRemotePublication(isPublished) {
    if (!supabaseClient) {
      showToast("تعذر الاتصال بخدمة النشر");
      return;
    }
    const { data, error } = await supabaseClient
      .from("site_settings")
      .update({ is_published: isPublished, updated_at: new Date().toISOString() })
      .eq("id", "main")
      .select("is_published")
      .single();
    if (error) {
      console.error("تعذر تغيير حالة الموقع:", error);
      showToast("لم تتغير حالة الموقع — تحقق من الاتصال والصلاحيات");
      return;
    }
    workingData.meta.sitePublished = data.is_published;
    saveDraft();
    renderPublicationStatus();
    showToast(isPublished ? "تم فتح الموقع للزوار فورًا" : "تم إغلاق الموقع للزوار فورًا");
  }

  document.getElementById("closeSiteBtn").addEventListener("click", () => updateRemotePublication(false));

  document.getElementById("publishSiteBtn").addEventListener("click", () => updateRemotePublication(true));

  async function loadRemotePublicationStatus() {
    if (!supabaseClient) return;
    const { data, error } = await supabaseClient
      .from("site_settings")
      .select("is_published")
      .eq("id", "main")
      .single();
    if (!error && data) {
      workingData.meta.sitePublished = data.is_published;
      saveDraft();
      renderPublicationStatus();
    }
  }

  document.getElementById("sitePreviewBtn").addEventListener("click", () => {
    saveDraft();
    try { sessionStorage.setItem("mokhbiteen_private_preview_v1", "1"); } catch (e) {}
    const previewWindow = window.open("index.html?preview=1", "_blank");
    if (!previewWindow) showToast("اسمح بالنوافذ المنبثقة لفتح المعاينة");
  });

  /* ---------------------------------------------------------------------
     أرشفة لوحة الشرف في Supabase
  --------------------------------------------------------------------- */
  const archiveCurrentBtn = document.getElementById("archiveCurrentBtn");
  const archiveAdminState = document.getElementById("archiveAdminState");

  function currentArchiveKey() {
    const year = String(workingData.meta.year || new Date().getFullYear()).trim();
    const month = String(workingData.meta.monthLabel || "لوحة").trim().replace(/\s+/g, "-");
    return `${year}-${month}`;
  }

  async function refreshCurrentArchiveState() {
    if (!supabaseClient) return;
    const { data, error } = await supabaseClient
      .from("honor_board_archives")
      .select("archived_at")
      .eq("archive_key", currentArchiveKey())
      .maybeSingle();
    if (error) {
      archiveAdminState.textContent = "الأرشيف غير مهيأ بعد — شغّل ملف supabase-archive-setup.sql في Supabase.";
      archiveAdminState.style.color = "#b8563f";
      return;
    }
    archiveAdminState.style.color = "";
    archiveAdminState.textContent = data
      ? `هذه اللوحة مؤرشفة — آخر حفظ ${new Date(data.archived_at).toLocaleString("ar-JO")}`
      : "هذه اللوحة لم تُؤرشف بعد.";
  }

  archiveCurrentBtn.addEventListener("click", async () => {
    if (!supabaseClient) {
      showToast("تعذر الاتصال بخدمة الأرشيف");
      return;
    }
    const label = workingData.meta.monthLabel || "اللوحة الحالية";
    const year = Number(workingData.meta.year) || new Date().getFullYear();
    const { data: existing, error: checkError } = await supabaseClient
      .from("honor_board_archives")
      .select("id")
      .eq("archive_key", currentArchiveKey())
      .maybeSingle();
    if (checkError) {
      console.error("تعذر فحص الأرشيف:", checkError);
      showToast("الأرشيف غير مهيأ — شغّل ملف SQL أولًا");
      return;
    }
    const message = existing
      ? `لوحة ${label} — ${year} مؤرشفة سابقًا. هل تريد استبدال النسخة المؤرشفة بالبيانات الحالية؟`
      : `سيتم حفظ لوحة ${label} — ${year} كاملة في الأرشيف العام. هل تريد المتابعة؟`;
    if (!confirm(message)) return;

    archiveCurrentBtn.disabled = true;
    archiveCurrentBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جارٍ الأرشفة...';
    recalcAllAndRank();
    saveDraft();
    const snapshot = JSON.parse(JSON.stringify(workingData));
    const archiveRow = {
      archive_key: currentArchiveKey(),
      month_label: label,
      year,
      title: workingData.meta.heroTitle || `لوحة شرف ${label}`,
      data: snapshot,
      archived_at: new Date().toISOString()
    };
    const { error } = await supabaseClient
      .from("honor_board_archives")
      .upsert(archiveRow, { onConflict: "archive_key" });
    archiveCurrentBtn.disabled = false;
    archiveCurrentBtn.innerHTML = '<i class="fa-solid fa-box-archive"></i> أرشفة اللوحة الحالية';
    if (error) {
      console.error("تعذر أرشفة اللوحة:", error);
      showToast("لم تتم الأرشفة — تحقق من إعداد Supabase");
      return;
    }
    showToast(existing ? "تم تحديث النسخة المؤرشفة" : "تمت أرشفة اللوحة بنجاح");
    refreshCurrentArchiveState();
  });

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
  function emptyStudentDay(date, isoDate) {
    return { date: date || "", isoDate: isoDate || "", attendance: 0, memorization: 0, revision: 0, worship: 0, evaluation: 0, dayAverage: 0 };
  }
  function emptyMeeting(index) {
    return {
      id: `meeting-${Date.now()}-${index}`,
      date: "",
      isoDate: "",
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
          <input type="date" data-meeting-date="${index}" value="${day.isoDate || toCalendarDate(day.date)}">
        </div>
        <button class="row-del" data-delete-meeting="${index}" title="حذف اللقاء"><i class="fa-solid fa-trash"></i></button>
      </div>`).join("");
  }

  meetingsManager.addEventListener("change", (e) => {
    if (e.target.dataset.meetingDate === undefined) return;
    const index = Number(e.target.dataset.meetingDate);
    const displayDate = toDisplayDate(e.target.value);
    workingData.days[index].date = displayDate;
    workingData.days[index].isoDate = e.target.value;
    workingData.students.forEach((student) => {
      if (student.days[index]) {
        student.days[index].date = displayDate;
        student.days[index].isoDate = e.target.value;
      }
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
    if (workingData.days.length >= 48) {
      showToast("الحد الأقصى 48 لقاء");
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

  document.getElementById("startNewMonthBtn").addEventListener("click", async () => {
    const label = newMonthLabel.value.trim();
    const year = String(newMonthYear.value || "").trim();
    const count = Math.max(1, Math.min(48, Number(newMeetingsCount.value) || 5));
    if (!label) {
      showToast("اكتب اسم الشهر الجديد أولًا");
      newMonthLabel.focus();
      return;
    }
    if (!confirm(`سيتم تنزيل نسخة احتياطية ثم بدء ${label} وتصفير جميع النتائج. هل تريد المتابعة؟`)) return;
    downloadText(buildFileText(), `نسخة-احتياطية-${workingData.meta.monthLabel.replace(/\s+/g, "-")}.js`);
    workingData.meta.monthLabel = label;
    workingData.meta.year = year || String(new Date().getFullYear());
    workingData.meta.sitePublished = false;
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
    await updateRemotePublication(false);
    showToast(`تم بدء ${label} وإغلاق الموقع للزوار — اختر تواريخ اللقاءات`);
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
    if (workingData.meta.sitePublished === undefined) workingData.meta.sitePublished = true;
    activeDayIndex = 0;
    newMonthYear.value = workingData.meta.year;
    renderAll();
    showToast("تم استرجاع البيانات الأصلية");
  });

  /* ---------------------------------------------------------------------
     التشغيل
  --------------------------------------------------------------------- */
  function renderAll() {
    renderPublicationStatus();
    renderMeta();
    renderMeetingsManager();
    renderDayTabs();
    renderStudentsTable();
    renderAchievements();
  }
  renderAll();
  loadRemotePublicationStatus();
  refreshCurrentArchiveState();

  } // نهاية initAdminPanel

})();
