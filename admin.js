/* ==========================================================================
   مشروع المخبتين القرآني — admin.js
   تعديل بيانات الطلاب وأيام الدوام محليًا، وتصدير data.js محدّث
   ========================================================================== */

(function () {
  "use strict";

  const supabaseConfig = window.MOKHBITEEN_SUPABASE;
  const supabaseClient = supabaseConfig && window.supabase
    ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
      })
    : null;

  const lockOverlay = document.getElementById("lockOverlay");
  const adminContent = document.getElementById("adminContent");
  const lockForm = document.getElementById("lockForm");
  const lockEmail = document.getElementById("lockEmailInput");
  const lockInput = document.getElementById("lockPasswordInput");
  const lockError = document.getElementById("lockError");
  const passwordAuthStep = document.getElementById("passwordAuthStep");
  const mfaEnrollStep = document.getElementById("mfaEnrollStep");
  const mfaCodeStep = document.getElementById("mfaCodeStep");
  const mfaCodeInput = document.getElementById("mfaCodeInput");
  const mfaQrImage = document.getElementById("mfaQrImage");
  const mfaSecret = document.getElementById("mfaSecret");
  const trustDeviceInput = document.getElementById("trustDeviceInput");
  const authSubmitBtn = document.getElementById("authSubmitBtn");
  const authBackBtn = document.getElementById("authBackBtn");
  const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");
  const TRUST_UNTIL_KEY = "mokhbiteen_admin_trusted_until_v1";
  const TRUST_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
  let authStage = "password";
  let pendingMfaFactorId = null;
  let adminInitialized = false;

  function setAuthStage(stage, enrollment = false) {
    authStage = stage;
    passwordAuthStep.classList.toggle("auth-step-hidden", stage !== "password");
    mfaCodeStep.classList.toggle("auth-step-hidden", stage !== "mfa");
    mfaEnrollStep.classList.toggle("auth-step-hidden", stage !== "mfa" || !enrollment);
    authBackBtn.classList.toggle("auth-step-hidden", stage === "password");
    authSubmitBtn.textContent = stage === "password" ? "دخول" : (enrollment ? "تفعيل ودخول" : "تحقق ودخول");
    lockError.textContent = "";
    if (stage === "mfa") setTimeout(() => mfaCodeInput.focus(), 0);
  }

  function rememberTrustedDevice() {
    if (trustDeviceInput.checked) {
      localStorage.setItem(TRUST_UNTIL_KEY, String(Date.now() + TRUST_DURATION_MS));
    } else {
      localStorage.removeItem(TRUST_UNTIL_KEY);
    }
  }

  function isDeviceTrusted() {
    const trustedUntil = Number(localStorage.getItem(TRUST_UNTIL_KEY) || 0);
    if (trustedUntil > Date.now()) return true;
    localStorage.removeItem(TRUST_UNTIL_KEY);
    return false;
  }

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
    mfaCodeInput.value = "";
    setAuthStage("password");
  }

  async function beginMfaEnrollment() {
    const factorsResult = await supabaseClient.auth.mfa.listFactors();
    const unverified = (factorsResult.data?.totp || []).filter((factor) => factor.status !== "verified");
    for (const factor of unverified) await supabaseClient.auth.mfa.unenroll({ factorId: factor.id });
    const { data, error } = await supabaseClient.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "لوحة تحكم المخبتين"
    });
    if (error) throw error;
    pendingMfaFactorId = data.id;
    mfaQrImage.src = data.totp.qr_code;
    mfaSecret.textContent = `المفتاح الاحتياطي: ${data.totp.secret}`;
    setAuthStage("mfa", true);
  }

  async function continueAfterPassword() {
    const { data, error } = await supabaseClient.auth.mfa.listFactors();
    if (error) throw error;
    const verifiedFactor = (data.totp || []).find((factor) => factor.status === "verified");
    if (verifiedFactor) {
      pendingMfaFactorId = verifiedFactor.id;
      mfaQrImage.removeAttribute("src");
      mfaSecret.textContent = "";
      setAuthStage("mfa", false);
    } else {
      await beginMfaEnrollment();
    }
  }

  async function verifyMfaCode() {
    const code = mfaCodeInput.value.replace(/\D/g, "");
    if (code.length !== 6) throw new Error("أدخل رمز التحقق المكوّن من 6 أرقام.");
    const { error } = await supabaseClient.auth.mfa.challengeAndVerify({
      factorId: pendingMfaFactorId,
      code
    });
    if (error) throw error;
    rememberTrustedDevice();
    unlock();
  }

  lockForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!supabaseClient) {
      lockError.textContent = "تعذر الاتصال بخدمة تسجيل الدخول. تحقق من الإنترنت ثم أعد المحاولة.";
      return;
    }
    authSubmitBtn.disabled = true;
    const originalLabel = authSubmitBtn.textContent;
    authSubmitBtn.textContent = "جاري التحقق...";
    try {
      if (authStage === "password") {
        const { error } = await supabaseClient.auth.signInWithPassword({
          email: lockEmail.value.trim(),
          password: lockInput.value
        });
        if (error) throw error;
        await continueAfterPassword();
      } else {
        await verifyMfaCode();
      }
    } catch (error) {
      console.error("تعذر إكمال تسجيل الدخول:", error);
      lockError.textContent = authStage === "password"
        ? "البريد الإلكتروني أو كلمة المرور غير صحيحة."
        : (error.message === "أدخل رمز التحقق المكوّن من 6 أرقام." ? error.message : "رمز التحقق غير صحيح أو انتهت صلاحيته.");
      if (authStage === "password") {
        lockInput.value = "";
        lockInput.focus();
      } else {
        mfaCodeInput.select();
      }
    } finally {
      authSubmitBtn.disabled = false;
      if (lockOverlay.style.display !== "none") {
        const isEnrollment = !mfaEnrollStep.classList.contains("auth-step-hidden");
        authSubmitBtn.textContent = authStage === "password" ? originalLabel : (isEnrollment ? "تفعيل ودخول" : "تحقق ودخول");
      }
    }
  });

  authBackBtn.addEventListener("click", async () => {
    localStorage.removeItem(TRUST_UNTIL_KEY);
    if (supabaseClient) await supabaseClient.auth.signOut({ scope: "local" });
    pendingMfaFactorId = null;
    setAuthStage("password");
    lockEmail.focus();
  });

  forgotPasswordBtn.addEventListener("click", async () => {
    if (!supabaseClient) {
      lockError.textContent = "تعذر الاتصال بخدمة استعادة كلمة المرور.";
      return;
    }
    const email = lockEmail.value.trim();
    if (!email) {
      lockError.textContent = "اكتب بريدك الإلكتروني أولًا، ثم اضغط نسيت كلمة المرور.";
      lockEmail.focus();
      return;
    }
    forgotPasswordBtn.disabled = true;
    forgotPasswordBtn.textContent = "جاري إرسال الرابط...";
    const redirectTo = new URL("reset-password.html", window.location.href).href;
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });
    forgotPasswordBtn.disabled = false;
    forgotPasswordBtn.textContent = "نسيت كلمة المرور؟";
    lockError.textContent = error
      ? "تعذر إرسال الرابط. تحقق من البريد أو حاول بعد قليل."
      : "تم إرسال رابط تغيير كلمة المرور إلى بريدك. افحص البريد الوارد والرسائل غير المرغوب فيها.";
  });

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    localStorage.removeItem(TRUST_UNTIL_KEY);
    if (supabaseClient) await supabaseClient.auth.signOut({ scope: "local" });
    lockAdmin();
    lockInput.focus();
  });

  // قفل الصفحة عند مغادرتها، بما في ذلك العودة للموقع العام وزر الرجوع في المتصفح.
  window.addEventListener("pagehide", lockAdmin);

  async function restoreTrustedSession() {
    if (!supabaseClient || !isDeviceTrusted()) {
      if (supabaseClient) await supabaseClient.auth.signOut({ scope: "local" });
      lockAdmin();
      return;
    }
    const { data: sessionData } = await supabaseClient.auth.getSession();
    if (!sessionData.session) {
      localStorage.removeItem(TRUST_UNTIL_KEY);
      lockAdmin();
      return;
    }
    const { data: aalData } = await supabaseClient.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalData?.currentLevel === "aal2") unlock();
    else {
      localStorage.removeItem(TRUST_UNTIL_KEY);
      await supabaseClient.auth.signOut({ scope: "local" });
      lockAdmin();
    }
  }

  window.addEventListener("pageshow", restoreTrustedSession);
  restoreTrustedSession();

  async function initAdminPanel() {

  const STORAGE_KEY = "mokhbiteen_draft_data_v2";
  const WEIGHTS = { attendance: 0.10, memorization: 0.30, revision: 0.30, worship: 0.20, evaluation: 0.10 };

  const liveSaveState = document.getElementById("liveSaveState");

  async function loadRemoteBoard() {
    if (!supabaseClient) return null;
    const { data, error } = await supabaseClient
      .from("live_board")
      .select("data,updated_at")
      .eq("id", "main")
      .maybeSingle();
    if (error) {
      console.warn("تعذر تحميل البيانات المباشرة:", error);
      liveSaveState.textContent = "قاعدة البيانات المباشرة غير مهيأة بعد — شغّل ملف supabase-live-data-setup.sql.";
      liveSaveState.style.color = "#b8563f";
      return null;
    }
    if (data?.data) {
      liveSaveState.textContent = `تم تحميل آخر نسخة من الموقع — ${new Date(data.updated_at).toLocaleString("ar-JO")}`;
      return data.data;
    }
    liveSaveState.textContent = "لا توجد بيانات مباشرة بعد؛ أول عملية حفظ سترفع اللوحة الحالية إلى Supabase.";
    return null;
  }

  // Supabase هو المصدر الأساسي، والمسودة المحلية وdata.js احتياط فقط.
  let workingData = await loadRemoteBoard() || loadDraft() || JSON.parse(JSON.stringify(MOKHBITEEN_DATA));
  sanitizeLegacyMeetingText(workingData);
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
  function sanitizeLegacyMeetingText(boardData) {
    (boardData.days || []).forEach((day) => {
      ["achievement", "nextRequired"].forEach((field) => {
        const value = String(day[field] || "").trim();
        if (!value || value.startsWith("يُضاف")) day[field] = "----";
      });
    });
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

  function recalcAllAndRank(sortStudents = true) {
    workingData.students.forEach(recalcStudent);
    if (sortStudents) {
      workingData.students.sort((a, b) => b.final - a.final);
      workingData.students.forEach((s, i) => (s.rank = i + 1));
    }

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
    // نحسب ونحفظ في الخلفية من دون ترتيب الصفوف أو إعادة بناء الجدول أثناء الكتابة.
    // بذلك يبقى المؤشر داخل الخانة ولا تقفز الصفحة إلى الأعلى.
    recalcAllAndRank(false);
    saveDraft();
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
     الحفظ المباشر وExcel
  --------------------------------------------------------------------- */
  const saveLiveDataBtn = document.getElementById("saveLiveDataBtn");
  const excelImportInput = document.getElementById("excelImportInput");
  const excelImportPreview = document.getElementById("excelImportPreview");
  const downloadCumulativeExcelBtn = document.getElementById("downloadCumulativeExcelBtn");
  let pendingExcelData = null;

  async function saveLiveBoard() {
    if (!supabaseClient) throw new Error("Supabase unavailable");
    sanitizeLegacyMeetingText(workingData);
    recalcAllAndRank();
    saveDraft();
    const snapshot = JSON.parse(JSON.stringify(workingData));
    const { error } = await supabaseClient.from("live_board").upsert({
      id: "main",
      data: snapshot,
      updated_at: new Date().toISOString()
    }, { onConflict: "id" });
    if (error) throw error;
  }

  saveLiveDataBtn.addEventListener("click", async () => {
    saveLiveDataBtn.disabled = true;
    saveLiveDataBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جارٍ الحفظ...';
    try {
      await saveLiveBoard();
      liveSaveState.style.color = "var(--emerald)";
      liveSaveState.textContent = `تم الحفظ على الموقع — ${new Date().toLocaleString("ar-JO")}`;
      showToast("تم حفظ التعديلات على الموقع مباشرة");
    } catch (error) {
      console.error("تعذر حفظ البيانات المباشرة:", error);
      liveSaveState.style.color = "#b8563f";
      liveSaveState.textContent = "فشل الحفظ — تأكد من تشغيل ملف إعداد قاعدة البيانات الجديدة.";
      showToast("لم يتم الحفظ على الموقع");
    } finally {
      saveLiveDataBtn.disabled = false;
      saveLiveDataBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> حفظ التعديلات على الموقع';
    }
  });

  function excelCellText(cell) {
    const value = cell?.value;
    if (value && typeof value === "object" && Array.isArray(value.richText)) return value.richText.map((part) => part.text).join("");
    return String(value ?? "").trim();
  }

  function parseImportedWorkbook(workbook) {
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error("ملف Excel لا يحتوي ورقة بيانات");
    const monthLabel = excelCellText(sheet.getCell("B2"));
    const year = Number(sheet.getCell("D2").value);
    if (!monthLabel || !year) throw new Error("لم أجد اسم الشهر والسنة في B2 وD2");

    const meetingGroups = [];
    let col = 3;
    while (col <= sheet.columnCount) {
      const title = excelCellText(sheet.getCell(4, col));
      if (!title.startsWith("اللقاء")) break;
      const dateMatch = title.match(/\(([^)]+)\)/);
      meetingGroups.push({ startCol: col, date: dateMatch ? dateMatch[1] : "", meetingNumber: meetingGroups.length + 1 });
      col += 6;
    }
    if (!meetingGroups.length) throw new Error("لم أجد أعمدة اللقاءات في الصف الرابع");

    const importedStudents = [];
    for (let row = 6; row <= sheet.rowCount; row++) {
      const name = excelCellText(sheet.getCell(row, 2));
      if (!name) continue;
      const existing = workingData.students.find((student) => normalizeName(student.name) === normalizeName(name));
      const studentDays = meetingGroups.map((meeting) => ({
        date: meeting.date,
        attendance: clampScore(sheet.getCell(row, meeting.startCol).value),
        memorization: clampScore(sheet.getCell(row, meeting.startCol + 1).value),
        revision: clampScore(sheet.getCell(row, meeting.startCol + 2).value),
        worship: clampScore(sheet.getCell(row, meeting.startCol + 3).value),
        evaluation: clampScore(sheet.getCell(row, meeting.startCol + 4).value),
        dayAverage: 0
      }));
      importedStudents.push({
        id: existing?.id ?? row - 5,
        name,
        photo: existing?.photo || "assets/logo.png",
        final: 0, attendance: 0, memorization: 0, revision: 0, worship: 0, evaluation: 0,
        days: studentDays,
        rank: row - 5
      });
    }
    if (!importedStudents.length) throw new Error("لم أجد أسماء طلاب ابتداءً من الصف السادس");

    const importedDays = meetingGroups.map((meeting) => ({
      id: `${year}-${meeting.meetingNumber}`,
      date: meeting.date,
      meetingNumber: meeting.meetingNumber,
      groupAverage: 0,
      presentCount: 0,
      totalCount: importedStudents.length,
      achievement: "----",
      nextRequired: "----",
      note: "",
      motivation: ""
    }));
    const imported = JSON.parse(JSON.stringify(workingData));
    imported.meta.monthLabel = monthLabel;
    imported.meta.year = String(year);
    imported.meta.heroTitle = `لوحة شرف ${monthLabel}`;
    imported.days = importedDays;
    imported.students = importedStudents;
    return imported;
  }

  function normalizeName(value) {
    return String(value || "").trim().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/\s+/g, " ");
  }
  function clampScore(value) { return Math.max(0, Math.min(100, Number(value) || 0)); }

  excelImportInput.addEventListener("change", async () => {
    const file = excelImportInput.files?.[0];
    if (!file) return;
    pendingExcelData = null;
    excelImportPreview.classList.add("is-visible");
    excelImportPreview.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جارٍ قراءة الملف والتحقق منه...';
    try {
      if (!window.ExcelJS) throw new Error("تعذر تحميل قارئ Excel");
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      pendingExcelData = parseImportedWorkbook(workbook);
      excelImportPreview.innerHTML = `
        <b><i class="fa-solid fa-circle-check" style="color:var(--emerald)"></i> الملف صالح للاستيراد</b><br>
        الشهر: ${escapeAttr(pendingExcelData.meta.monthLabel)} — السنة: ${escapeAttr(pendingExcelData.meta.year)}<br>
        الطلاب: ${pendingExcelData.students.length} — اللقاءات: ${pendingExcelData.days.length}<br>
        <button type="button" class="btn btn-teal btn-sm" id="confirmExcelImportBtn" style="margin-top:12px"><i class="fa-solid fa-check"></i> اعتماد البيانات في لوحة التحكم</button>`;
    } catch (error) {
      console.error("تعذر استيراد Excel:", error);
      excelImportPreview.innerHTML = `<b style="color:#b8563f"><i class="fa-solid fa-triangle-exclamation"></i> لم يتم قبول الملف</b><br>${escapeAttr(error.message)}`;
    }
    excelImportInput.value = "";
  });

  excelImportPreview.addEventListener("click", (event) => {
    if (!event.target.closest("#confirmExcelImportBtn") || !pendingExcelData) return;
    if (!confirm(`سيتم استبدال مسودة لوحة التحكم ببيانات ${pendingExcelData.meta.monthLabel}. لن تُنشر حتى تضغط حفظ التعديلات على الموقع. هل تريد المتابعة؟`)) return;
    workingData = pendingExcelData;
    activeDayIndex = 0;
    recalcAllAndRank();
    saveDraft();
    renderAll();
    excelImportPreview.innerHTML = '<b style="color:var(--emerald)"><i class="fa-solid fa-circle-check"></i> تم اعتماد الملف كمسودة. راجع النتائج ثم اضغط حفظ التعديلات على الموقع.</b>';
    showToast("تم استيراد Excel إلى المسودة");
  });

  function addMonthBlock(sheet, monthData, startRow) {
    const meta = monthData.meta || {};
    const days = monthData.days || [];
    const students = [...(monthData.students || [])].sort((a, b) => (a.rank || 999) - (b.rank || 999));
    const totalCols = 2 + days.length * 6 + 1;
    const titleRow = startRow;
    const metaRow = startRow + 1;
    const groupRow = startRow + 3;
    const axesRow = startRow + 4;
    const dataStartRow = startRow + 5;
    sheet.mergeCells(titleRow, 1, titleRow, totalCols);
    sheet.getCell(titleRow, 1).value = `${meta.projectName || "مشروع المخبتين القرآني"} — ${meta.heroTitle || meta.monthLabel || "لوحة الشرف"}`;
    sheet.getCell(metaRow, 1).value = "الشهر"; sheet.getCell(metaRow, 2).value = meta.monthLabel || "";
    sheet.getCell(metaRow, 3).value = "السنة"; sheet.getCell(metaRow, 4).value = Number(meta.year) || new Date().getFullYear();
    sheet.mergeCells(groupRow, 1, axesRow, 1); sheet.getCell(groupRow, 1).value = "الترتيب";
    sheet.mergeCells(groupRow, 2, axesRow, 2); sheet.getCell(groupRow, 2).value = "اسم الطالب";
    const axes = ["الدوام", "الحفظ", "المراجعة", "العبادات", "التقييم", "معدل اللقاء"];
    days.forEach((day, index) => {
      const start = 3 + index * 6;
      sheet.mergeCells(groupRow, start, groupRow, start + 5);
      sheet.getCell(groupRow, start).value = `اللقاء ${index + 1} (${day.date || "--/--"})`;
      axes.forEach((axis, axisIndex) => sheet.getCell(axesRow, start + axisIndex).value = axis);
    });
    const monthlyStart = 3 + days.length * 6;
    sheet.mergeCells(groupRow, monthlyStart, axesRow, monthlyStart);
    sheet.getCell(groupRow, monthlyStart).value = "معدل الشهر";

    students.forEach((student, studentIndex) => {
      const row = dataStartRow + studentIndex;
      sheet.getCell(row, 1).value = student.rank || studentIndex + 1;
      sheet.getCell(row, 2).value = student.name;
      days.forEach((day, dayIndex) => {
        const start = 3 + dayIndex * 6;
        const score = student.days?.[dayIndex] || {};
        [score.attendance, score.memorization, score.revision, score.worship, score.evaluation].forEach((value, index) => sheet.getCell(row, start + index).value = Number(value) || 0);
        sheet.getCell(row, start + 5).value = { formula: `${sheet.getCell(row,start).address}*10%+${sheet.getCell(row,start+1).address}*30%+${sheet.getCell(row,start+2).address}*30%+${sheet.getCell(row,start+3).address}*20%+${sheet.getCell(row,start+4).address}*10%`, result: Number(score.dayAverage) || 0 };
      });
      const meetingAverageRefs = days.map((_, dayIndex) => sheet.getCell(row, 3 + dayIndex * 6 + 5).address);
      sheet.getCell(row, monthlyStart).value = { formula: `AVERAGE(${meetingAverageRefs.join(",")})`, result: Number(student.final) || 0 };
    });

    sheet.getRow(titleRow).height = 34; sheet.getRow(groupRow).height = 28; sheet.getRow(axesRow).height = 34;
    sheet.getColumn(1).width = 10; sheet.getColumn(2).width = 28;
    for (let colIndex = 3; colIndex <= totalCols; colIndex++) sheet.getColumn(colIndex).width = 13;
    sheet.getCell(titleRow,1).font = { name: "Arial", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getCell(titleRow,1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF16232C" } };
    sheet.getCell(titleRow,1).alignment = { horizontal: "center", vertical: "middle" };
    [groupRow,axesRow].forEach((row) => sheet.getRow(row).eachCell((cell) => {
      cell.font = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: row === groupRow ? "FF1F6B52" : "FF2B7A62" } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    }));
    if (students.length) {
      const dataEndRow = dataStartRow + students.length - 1;
      for (let row = dataStartRow; row <= dataEndRow; row++) {
        sheet.getRow(row).height = 23;
        for (let colIndex = 1; colIndex <= totalCols; colIndex++) {
          const cell = sheet.getCell(row, colIndex);
          cell.alignment = { horizontal: colIndex === 2 ? "right" : "center", vertical: "middle" };
          cell.border = { bottom: { style: "thin", color: { argb: "FFE1E7E3" } } };
          if (colIndex >= 3) cell.numFmt = "0.0";
        }
      }
    }
    return { nextRow: dataStartRow + students.length + 3, totalCols };
  }

  async function downloadWorkbook(workbook, filename) {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob); link.download = filename; link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  downloadCumulativeExcelBtn.addEventListener("click", async () => {
    if (!window.ExcelJS || !supabaseClient) return showToast("تعذر تشغيل تصدير Excel");
    downloadCumulativeExcelBtn.disabled = true;
    downloadCumulativeExcelBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جارٍ إنشاء الملف...';
    try {
      const { data: archives, error } = await supabaseClient.from("honor_board_archives").select("archive_key,data,year,archived_at").order("year", { ascending: true }).order("archived_at", { ascending: true });
      if (error) throw error;
      const months = new Map((archives || []).map((archive) => [archive.archive_key, archive.data]));
      months.set(currentArchiveKey(), JSON.parse(JSON.stringify(workingData)));
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "مشروع المخبتين القرآني";
      workbook.calcProperties.fullCalcOnLoad = true;
      const sheet = workbook.addWorksheet("الأرشيف التراكمي", { views: [{ rightToLeft: true, state: "frozen", ySplit: 5, xSplit: 2 }] });
      let nextRow = 1;
      let maxCols = 3;
      months.forEach((monthData) => {
        const block = addMonthBlock(sheet, monthData, nextRow);
        nextRow = block.nextRow;
        maxCols = Math.max(maxCols, block.totalCols);
      });
      sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
      for (let colIndex = 3; colIndex <= maxCols; colIndex++) sheet.getColumn(colIndex).width = 13;
      await downloadWorkbook(workbook, `أرشيف-مشروع-المخبتين-${new Date().toISOString().slice(0,10)}.xlsx`);
      showToast("تم تنزيل ملف Excel التراكمي");
    } catch (error) {
      console.error("تعذر إنشاء Excel التراكمي:", error);
      showToast("تعذر إنشاء ملف Excel");
    } finally {
      downloadCumulativeExcelBtn.disabled = false;
      downloadCumulativeExcelBtn.innerHTML = '<i class="fa-solid fa-file-arrow-down"></i> تنزيل الأرشيف التراكمي Excel';
    }
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
