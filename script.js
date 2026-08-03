/* ==========================================================================
   مشروع المخبتين القرآني — script.js
   مسؤول عن عرض البيانات، الحسابات، الترتيب، الرسوم البيانية والحركات
   ========================================================================== */

(function () {
  "use strict";

  const PREVIEW_KEY = "mokhbiteen_private_preview_v1";
  const DRAFT_KEY = "mokhbiteen_draft_data_v2";
  let isPrivatePreview = false;
  try {
    isPrivatePreview = new URLSearchParams(window.location.search).get("preview") === "1" &&
      sessionStorage.getItem(PREVIEW_KEY) === "1";
  } catch (e) {}

  let DATA = MOKHBITEEN_DATA;
  if (isPrivatePreview) {
    try {
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) DATA = JSON.parse(draft);
    } catch (e) {}
  }
  const students = DATA.students; // مرتبون مسبقًا حسب المعدل
  const days = DATA.days;

  /* مزامنة النصوص العامة مع data.js حتى تظهر تعديلات لوحة التحكم */
  const meta = DATA.meta;
  if (isPrivatePreview) {
    document.body.classList.remove("site-status-loading");
    document.body.classList.add("preview-mode");
  } else {
    checkPublishedStatus();
  }

  async function checkPublishedStatus() {
    // أمنيًا: إذا تعذر التحقق من Supabase يبقى الموقع مغلقًا بدل عرض بيانات قديمة.
    let isPublished = false;
    try {
      const config = window.MOKHBITEEN_SUPABASE;
      if (config) {
        const response = await fetch(`${config.url}/rest/v1/site_settings?select=is_published&id=eq.main`, {
          headers: { apikey: config.publishableKey },
          cache: "no-store"
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const rows = await response.json();
        if (rows.length) isPublished = rows[0].is_published;
      }
    } catch (error) {
      console.error("تعذر قراءة حالة نشر الموقع؛ تم استخدام data.js كخيار احتياطي:", error);
    }
    document.body.classList.remove("site-status-loading", "site-closed");
    if (!isPublished) document.body.classList.add("site-closed");
  }

  if (!isPrivatePreview) {
    // مزامنة التبويبات المفتوحة مسبقًا دون حاجة إلى تحديث الصفحة يدويًا.
    setInterval(checkPublishedStatus, 15000);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) checkPublishedStatus();
    });
  }
  const closedEyebrow = document.querySelector(".site-closed-eyebrow");
  if (closedEyebrow) closedEyebrow.textContent = meta.projectName;
  function setText(id, value) {
    const el = document.getElementById(id);
    if (el && value) el.textContent = value;
  }
  document.title = `${meta.projectName} | ${meta.heroTitle}`;
  const pageDescription = document.getElementById("pageDescription");
  if (pageDescription) pageDescription.content = `${meta.heroTitle} — ${meta.projectName}`;
  setText("navProjectName", meta.projectName);
  setText("heroProjectName", meta.projectName);
  setText("heroVerse", `﴿ ${meta.verse} ﴾`);
  setText("heroVerseRef", meta.verseRef);
  setText("heroTitle", meta.heroTitle);
  setText("heroDesc", meta.heroDesc);
  setText("statsSectionSub", `أبرز الأرقام التي تلخص مسيرة المجموعة خلال ${meta.monthLabel}`);
  setText("podiumSectionTitle", `نجوم ${meta.projectName} — ${meta.monthLabel}`);
  setText("journeySectionTitle", `رحلة ${meta.monthLabel}`);
  setText("journeySectionSub", `${days.length} محطات مباركة، في كل واحدة منها جهد وأثر ومتابعة`);
  setText("journeyActionText", `رحلة ${meta.monthLabel}`);
  setText("studentsSectionSub", `${students.length} طالبًا، وكل واحد منهم له بصمته وجهده الخاص هذا الشهر`);
  setText("footerVerse", `﴿ ${meta.verse} ﴾`);
  setText("footerProjectLine", `${meta.projectName} — ${meta.heroTitle}`);
  setText("supervisorName", meta.supervisor);
  setText("supervisorTitle", meta.supervisorTitle);
  setText("footerCopyright", `جميع الحقوق محفوظة © ${meta.projectName}`);

  /* مشغل تلاوة الآية — يعمل فقط بطلب الزائر */
  const verseAudio = document.getElementById("verseAudio");
  const verseAudioToggle = document.getElementById("verseAudioToggle");
  const verseAudioProgress = document.getElementById("verseAudioProgress");
  const verseAudioTime = document.getElementById("verseAudioTime");
  function formatAudioTime(seconds) {
    if (!Number.isFinite(seconds)) return "0:00";
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
  }
  function updateAudioUI() {
    const duration = Number.isFinite(verseAudio.duration) ? verseAudio.duration : 0;
    verseAudioProgress.value = duration ? (verseAudio.currentTime / duration) * 100 : 0;
    verseAudioTime.textContent = `${formatAudioTime(verseAudio.currentTime)} / ${formatAudioTime(duration)}`;
  }
  verseAudioToggle.addEventListener("click", () => {
    if (verseAudio.paused) {
      verseAudio.play().catch(() => showToast("تعذر تشغيل التلاوة في هذا المتصفح"));
    } else {
      verseAudio.pause();
    }
  });
  verseAudio.addEventListener("play", () => {
    verseAudioToggle.innerHTML = '<i class="fa-solid fa-pause" aria-hidden="true"></i>';
    verseAudioToggle.setAttribute("aria-label", "إيقاف تلاوة الآية مؤقتًا");
  });
  verseAudio.addEventListener("pause", () => {
    verseAudioToggle.innerHTML = '<i class="fa-solid fa-play" aria-hidden="true"></i>';
    verseAudioToggle.setAttribute("aria-label", "تشغيل تلاوة الآية");
  });
  verseAudio.addEventListener("loadedmetadata", updateAudioUI);
  verseAudio.addEventListener("timeupdate", updateAudioUI);
  verseAudio.addEventListener("ended", updateAudioUI);
  verseAudioProgress.addEventListener("input", () => {
    if (Number.isFinite(verseAudio.duration)) {
      verseAudio.currentTime = (Number(verseAudioProgress.value) / 100) * verseAudio.duration;
    }
  });

  /* ---------------------------------------------------------------------
     أدوات مساعدة
  --------------------------------------------------------------------- */
  function initials(name) {
    const parts = name.trim().split(/\s+/);
    return (parts[0] ? parts[0][0] : "") + (parts[1] ? parts[1][0] : "");
  }

  function avatarInner(st) {
    return st.photo
      ? `<img src="${st.photo}" alt="${st.name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
      : initials(st.name);
  }

  function scoreLevel(v) {
    if (v >= 85) return "high";
    if (v >= 60) return "mid";
    return "low";
  }

  function animateNumber(el, target, decimals, duration) {
    const start = 0;
    const startTime = performance.now();
    function tick(now) {
      const p = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = start + (target - start) * eased;
      el.textContent = decimals ? val.toFixed(decimals) : Math.round(val);
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = decimals ? target.toFixed(decimals) : target;
    }
    requestAnimationFrame(tick);
  }

  function showToast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2600);
  }

  /* ---------------------------------------------------------------------
     شريط التنقل
  --------------------------------------------------------------------- */
  const navbar = document.getElementById("navbar");
  const navToggle = document.getElementById("navToggle");
  const navLinks = document.getElementById("navLinks");

  window.addEventListener("scroll", () => {
    navbar.classList.toggle("scrolled", window.scrollY > 40);
  });
  navToggle.addEventListener("click", () => navLinks.classList.toggle("open"));
  document.querySelectorAll(".nav-link").forEach((a) =>
    a.addEventListener("click", () => navLinks.classList.remove("open"))
  );

  /* ---------------------------------------------------------------------
     الإحصائيات
  --------------------------------------------------------------------- */
  const statsGrid = document.getElementById("statsGrid");
  const statsConfig = [
    { icon: "fa-user-graduate", value: DATA.stats.studentsCount, label: "عدد الطلاب", decimals: 0, suffix: "" },
    { icon: "fa-calendar-days", value: DATA.stats.daysCount, label: "أيام الدوام", decimals: 0, suffix: "" },
    { icon: "fa-chart-line", value: DATA.stats.groupAverage, label: "متوسط المجموعة", decimals: 1, suffix: " / 100" },
    { icon: "fa-star", value: DATA.stats.topAverage, label: "أعلى معدل", decimals: 1, suffix: " / 100" },
    { icon: "fa-clipboard-check", value: DATA.stats.attendanceRate, label: "نسبة الالتزام بالدوام", decimals: 1, suffix: "%" }
  ];
  statsConfig.forEach((s) => {
    const card = document.createElement("div");
    card.className = "stat-card";
    card.innerHTML = `
      <div class="stat-icon"><i class="fa-solid ${s.icon}"></i></div>
      <div class="stat-value"><span class="counter" data-target="${s.value}" data-decimals="${s.decimals}">0</span>${s.suffix}</div>
      <div class="stat-label">${s.label}</div>`;
    statsGrid.appendChild(card);
  });

  /* ---------------------------------------------------------------------
     منصة التتويج
  --------------------------------------------------------------------- */
  const podiumWrap = document.getElementById("podiumWrap");
  const top3 = students.slice(0, 3);
  const order = [top3[1], top3[0], top3[2]]; // الثاني - الأول - الثالث
  const medalIcons = { 1: "fa-crown", 2: "fa-medal", 3: "fa-medal" };
  const medalLabel = { 1: "المركز الأول", 2: "المركز الثاني", 3: "المركز الثالث" };

  order.forEach((st) => {
    if (!st) return;
    const card = document.createElement("div");
    card.className = `podium-card rank-${st.rank} reveal`;
    card.innerHTML = `
      <div class="podium-rank-badge">${st.rank}</div>
      <div class="podium-avatar-wrap">
        ${st.rank === 1 ? '<i class="fa-solid fa-crown podium-crown"></i>' : ""}
        <div class="podium-avatar">${avatarInner(st)}</div>
      </div>
      <div class="podium-name">${st.name}</div>
      <div class="podium-score">${st.final.toFixed(1)}</div>
      <div class="podium-base">
        <i class="fa-solid ${medalIcons[st.rank]} medal-icon"></i>
        ${medalLabel[st.rank]}
      </div>`;
    podiumWrap.appendChild(card);
  });

  function launchConfetti() {
    const colors = ["#c9a24b", "#1f6b52", "#e6c878", "#3f7d6f"];
    for (let i = 0; i < 60; i++) {
      const piece = document.createElement("div");
      piece.className = "confetti-piece";
      piece.style.right = Math.random() * 100 + "%";
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDuration = 2 + Math.random() * 1.6 + "s";
      piece.style.borderRadius = Math.random() > 0.5 ? "50%" : "2px";
      podiumWrap.appendChild(piece);
      setTimeout(() => piece.remove(), 3800);
    }
  }

  /* حفظ لوحة الشرف كصورة */
  document.getElementById("saveImageBtn").addEventListener("click", () => {
    if (window.location.protocol === "file:") {
      showToast("افتح start-site.bat ثم استخدم رابط 127.0.0.1 لحفظ الصورة");
      return;
    }
    if (typeof html2canvas === "undefined") {
      showToast("تعذر تحميل أداة الحفظ، تحقق من الاتصال بالإنترنت");
      return;
    }
    showToast("جاري تجهيز الصورة...");
    html2canvas(podiumWrap, {
      backgroundColor: "#faf6ec",
      scale: 2,
      useCORS: true,
      allowTaint: false,
      imageTimeout: 15000,
      logging: false
    }).then((canvas) => {
      const link = document.createElement("a");
      link.download = `لوحة-شرف-المخبتين-${meta.monthLabel.replace(/\s+/g, "-")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      showToast("تم حفظ الصورة بنجاح");
    }).catch((error) => {
      console.error("تعذر حفظ لوحة الشرف:", error);
      showToast("تعذر حفظ الصورة؛ تأكد أن الموقع مفتوح عبر localhost وأن الصور ظاهرة");
    });
  });

  /* ---------------------------------------------------------------------
     رحلة شهر 7 (Timeline)
  --------------------------------------------------------------------- */
  const timeline = document.getElementById("timeline");

  function meetingMonth(day) {
    let iso = day.isoDate || "";
    if (!iso && /^\d{2}\/\d{2}$/.test(day.date || "")) {
      const [dd, mm] = day.date.split("/");
      iso = `${meta.year || new Date().getFullYear()}-${mm}-${dd}`;
    }
    if (!iso) return { key: "undated", label: "لقاءات دون تاريخ" };
    const parsed = new Date(`${iso}T12:00:00`);
    return {
      key: iso.slice(0, 7),
      label: new Intl.DateTimeFormat("ar-JO", { month: "long", year: "numeric" }).format(parsed)
    };
  }

  const monthGroups = [];
  days.forEach((day) => {
    const month = meetingMonth(day);
    let group = monthGroups.find((item) => item.key === month.key);
    if (!group) {
      group = { ...month, days: [] };
      monthGroups.push(group);
    }
    group.days.push(day);
  });

  monthGroups.forEach((group) => {
    const validAverages = group.days.map((day) => Number(day.groupAverage) || 0);
    const monthAverage = validAverages.length
      ? validAverages.reduce((sum, value) => sum + value, 0) / validAverages.length
      : 0;
    const section = document.createElement("section");
    section.className = "timeline-month reveal";
    section.innerHTML = `
      <div class="timeline-month-head">
        <div>
          <span class="timeline-month-label"><i class="fa-regular fa-calendar"></i> ${group.label}</span>
          <span class="timeline-month-count">${group.days.length} ${group.days.length === 1 ? "لقاء" : "لقاءات"}</span>
        </div>
        <div class="timeline-month-average"><small>متوسط الشهر</small><strong>${monthAverage.toFixed(1)}</strong></div>
      </div>
      <div class="timeline-month-scroll">
        <div class="timeline-track"></div>
        <div class="timeline-month-list"></div>
      </div>`;

    const list = section.querySelector(".timeline-month-list");
    group.days.forEach((d) => {
      const node = document.createElement("div");
      node.className = "timeline-node reveal";
      node.innerHTML = `
        <div class="timeline-dot"><i class="fa-solid fa-book-quran"></i></div>
        <div class="timeline-meeting">اللقاء ${d.meetingNumber}</div>
        <div class="timeline-date">${d.date || "بدون تاريخ"}</div>
        <div class="timeline-card">
          <div class="timeline-avg">${d.groupAverage.toFixed(1)}</div>
          <div class="timeline-meta">
            <i class="fa-solid fa-users"></i> ${d.presentCount} من ${d.totalCount} حاضر
          </div>
          <button class="timeline-btn" data-day="${d.id}">عرض تفاصيل اليوم</button>
        </div>`;
      list.appendChild(node);
    });
    timeline.appendChild(section);
  });

  /* ---------------------------------------------------------------------
     بطاقات الطلاب
  --------------------------------------------------------------------- */
  const studentsGrid = document.getElementById("studentsGrid");
  const RADIUS = 44;
  const CIRC = 2 * Math.PI * RADIUS;

  students.forEach((st) => {
    const card = document.createElement("div");
    card.className = "student-card reveal";
    card.dataset.id = st.id;
    card.innerHTML = `
      <div class="student-rank-tag">الترتيب ${st.rank}</div>
      <div class="progress-ring-wrap">
        <svg width="104" height="104" viewBox="0 0 104 104">
          <circle class="progress-ring-bg" cx="52" cy="52" r="${RADIUS}"></circle>
          <circle class="progress-ring-fill" cx="52" cy="52" r="${RADIUS}"
            stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC}"
            data-offset-target="${CIRC - (st.final / 100) * CIRC}"></circle>
        </svg>
        <div class="progress-ring-avatar">${avatarInner(st)}</div>
        <div class="progress-ring-score">${st.final.toFixed(1)}</div>
      </div>
      <div class="student-name">${st.name}</div>
      <div class="student-icons">
        <span><i class="fa-solid fa-calendar-check"></i><b>${st.attendance.toFixed(0)}%</b></span>
        <span><i class="fa-solid fa-book-quran"></i><b>${st.memorization.toFixed(0)}%</b></span>
        <span><i class="fa-solid fa-rotate"></i><b>${st.revision.toFixed(0)}%</b></span>
        <span><i class="fa-solid fa-hands-praying"></i><b>${st.worship.toFixed(0)}%</b></span>
        <span><i class="fa-solid fa-clipboard-check"></i><b>${st.evaluation.toFixed(0)}%</b></span>
      </div>
      <button class="student-btn">عرض التفاصيل</button>`;
    studentsGrid.appendChild(card);
  });

  /* ---------------------------------------------------------------------
     نوافذ Modal — تفاصيل الطالب
  --------------------------------------------------------------------- */
  const studentModal = document.getElementById("studentModal");
  const studentModalBox = document.getElementById("studentModalBox");
  let miniChartInstance = null;

  function openStudentModal(st) {
    studentModalBox.innerHTML = `
      <button class="modal-close" data-close><i class="fa-solid fa-xmark"></i></button>
      <div class="modal-header">
        <div class="modal-avatar">${avatarInner(st)}</div>
        <div>
          <div class="modal-title">${st.name}</div>
          <div class="modal-sub">الترتيب ${st.rank} من ${students.length} — المعدل النهائي ${st.final.toFixed(1)} / 100</div>
        </div>
      </div>
      <div class="modal-stats-grid">
        <div class="modal-stat"><i class="fa-solid fa-calendar-check"></i><b>${st.attendance.toFixed(0)}%</b><span>الدوام</span></div>
        <div class="modal-stat"><i class="fa-solid fa-book-quran"></i><b>${st.memorization.toFixed(0)}%</b><span>الحفظ</span></div>
        <div class="modal-stat"><i class="fa-solid fa-rotate"></i><b>${st.revision.toFixed(0)}%</b><span>المراجعة</span></div>
        <div class="modal-stat"><i class="fa-solid fa-hands-praying"></i><b>${st.worship.toFixed(0)}%</b><span>العبادات</span></div>
        <div class="modal-stat"><i class="fa-solid fa-clipboard-check"></i><b>${st.evaluation.toFixed(0)}%</b><span>التقييم</span></div>
      </div>
      <h4 style="margin:0 0 10px;color:var(--navy-deep)">نتيجة كل يوم</h4>
      <div class="modal-days-list">
        ${st.days.map(dd => `
          <div class="modal-day-row">
            <div class="modal-day-date">${dd.date}</div>
            <div class="modal-bar-track"><div class="modal-bar-fill" data-w="${dd.dayAverage}"></div></div>
            <div class="modal-day-val">${dd.dayAverage.toFixed(0)}</div>
          </div>`).join("")}
      </div>
      <h4 style="margin:0 0 10px;color:var(--navy-deep)">تطور الأداء عبر الشهر</h4>
      <div class="modal-mini-chart-scroll">
        <div class="modal-mini-chart" style="width:${Math.max(560, st.days.length * 62)}px"><canvas id="miniChart"></canvas></div>
      </div>`;

    studentModal.classList.add("open");
    document.body.style.overflow = "hidden";

    requestAnimationFrame(() => {
      studentModalBox.querySelectorAll(".modal-bar-fill").forEach((el) => {
        el.style.width = el.dataset.w + "%";
      });
    });

    if (typeof Chart === "undefined") return;
    if (miniChartInstance) miniChartInstance.destroy();
    const ctx = document.getElementById("miniChart").getContext("2d");
    miniChartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels: st.days.map((d) => d.date),
        datasets: [{
          label: "معدل اليوم",
          data: st.days.map((d) => d.dayAverage),
          borderColor: "#1f6b52",
          backgroundColor: "rgba(201,162,75,.18)",
          tension: 0.35,
          fill: true,
          pointBackgroundColor: "#c9a24b",
          pointRadius: 5,
          pointHoverRadius: 7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { min: 0, max: 100, ticks: { stepSize: 25 } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  studentsGrid.addEventListener("click", (e) => {
    const card = e.target.closest(".student-card");
    if (!card) return;
    const st = students.find((s) => String(s.id) === card.dataset.id);
    if (st) openStudentModal(st);
  });

  /* ---------------------------------------------------------------------
     نوافذ Modal — تفاصيل اليوم
  --------------------------------------------------------------------- */
  const dayModal = document.getElementById("dayModal");
  const dayModalBox = document.getElementById("dayModalBox");

  function badgeClass(v) {
    if (v >= 85) return "high";
    if (v >= 60) return "mid";
    return "low";
  }

  function openDayModal(dayId) {
    const d = days.find((x) => x.id === dayId);
    if (!d) return;
    const dayIndex = days.indexOf(d);

    const rows = students.map((st) => {
      const dd = st.days[dayIndex];
      return { name: st.name, ...dd };
    }).sort((a, b) => b.dayAverage - a.dayAverage);

    dayModalBox.innerHTML = `
      <button class="modal-close" data-close><i class="fa-solid fa-xmark"></i></button>
      <div class="modal-header">
        <div class="modal-avatar"><i class="fa-solid fa-book-quran"></i></div>
        <div>
          <div class="modal-title">اللقاء ${d.meetingNumber} — ${d.date}</div>
          <div class="modal-sub">متوسط المجموعة ${d.groupAverage.toFixed(1)} — الحضور ${d.presentCount} من ${d.totalCount}</div>
        </div>
      </div>
      <div class="ach-row" style="margin-bottom:6px"><b>إنجاز اليوم:</b> ${d.achievement}</div>
      <div class="ach-row" style="margin-bottom:18px"><b>المطلوب للقاء القادم:</b> ${d.nextRequired}</div>

      <div class="day-modal-head-row">
        <span>الطالب</span><span>الدوام</span><span>الحفظ</span><span>المراجعة</span><span>العبادات</span><span>التقييم</span>
      </div>
      <div class="day-modal-grid">
        ${rows.map(r => `
          <div class="day-student-row">
            <div class="dsr-name">${r.name}</div>
            <div class="dsr-cell"><span class="dsr-badge ${badgeClass(r.attendance)}">${r.attendance.toFixed(0)}</span></div>
            <div class="dsr-cell"><span class="dsr-badge ${badgeClass(r.memorization)}">${r.memorization.toFixed(0)}</span></div>
            <div class="dsr-cell"><span class="dsr-badge ${badgeClass(r.revision)}">${r.revision.toFixed(0)}</span></div>
            <div class="dsr-cell"><span class="dsr-badge ${badgeClass(r.worship)}">${r.worship.toFixed(0)}</span></div>
            <div class="dsr-cell"><span class="dsr-badge ${badgeClass(r.evaluation)}">${r.evaluation.toFixed(0)}</span></div>
          </div>`).join("")}
      </div>`;

    dayModal.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  timeline.addEventListener("click", (e) => {
    const btn = e.target.closest(".timeline-btn");
    if (!btn) return;
    openDayModal(btn.dataset.day);
  });

  [studentModal, dayModal].forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal || e.target.closest("[data-close]")) {
        modal.classList.remove("open");
        document.body.style.overflow = "";
      }
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      [studentModal, dayModal].forEach((m) => m.classList.remove("open"));
      document.body.style.overflow = "";
    }
  });

  /* ---------------------------------------------------------------------
     الظهور عند التمرير (Intersection Observer)
  --------------------------------------------------------------------- */
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in-view");
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  document.querySelectorAll(".reveal, .podium-card, .timeline-node, .student-card, .ach-card")
    .forEach((el) => revealObserver.observe(el));

  // عدادات الإحصائيات + Progress rings تُشغَّل عند ظهورها
  const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.querySelectorAll(".counter").forEach((c) => {
          animateNumber(c, parseFloat(c.dataset.target), parseInt(c.dataset.decimals), 1600);
        });
        statsObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });
  statsObserver.observe(statsGrid);

  const ringObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const fill = entry.target.querySelector(".progress-ring-fill");
        if (fill) fill.style.strokeDashoffset = fill.dataset.offsetTarget;
        ringObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.4 });
  document.querySelectorAll(".student-card").forEach((c) => ringObserver.observe(c));

  // احتفال بسيط عند ظهور منصة التتويج
  const podiumObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        setTimeout(launchConfetti, 400);
        podiumObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.4 });
  podiumObserver.observe(podiumWrap);

})();
