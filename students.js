(function () {
  "use strict";

  const students = window.MOKHBITEEN_GROUP_STUDENTS || [];
  const PREVIEW_KEY = "mokhbiteen_private_preview_v1";
  let activeIndex = 0;
  let visibleIndices = students.map((_, index) => index);
  let isPreview = false;

  try {
    isPreview = new URLSearchParams(location.search).get("preview") === "1" &&
      sessionStorage.getItem(PREVIEW_KEY) === "1";
  } catch (error) {}

  const rosterList = document.getElementById("rosterList");
  const rosterEmpty = document.getElementById("rosterEmpty");
  const search = document.getElementById("studentSearch");

  if (isPreview) {
    document.body.classList.remove("directory-status-loading");
    document.body.classList.add("directory-preview-mode");
    document.getElementById("homeLink").href = "index.html?preview=1";
    document.getElementById("backLink").href = "index.html?preview=1";
  } else {
    checkPublishedStatus();
    setInterval(checkPublishedStatus, 15000);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) checkPublishedStatus();
    });
  }

  async function checkPublishedStatus() {
    let published = false;
    try {
      const config = window.MOKHBITEEN_SUPABASE;
      if (config) {
        const response = await fetch(`${config.url}/rest/v1/site_settings?select=is_published&id=eq.main`, {
          headers: { apikey: config.publishableKey },
          cache: "no-store"
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const rows = await response.json();
        published = Boolean(rows.length && rows[0].is_published);
      }
    } catch (error) {
      console.error("تعذر التحقق من حالة نشر الموقع:", error);
    }
    document.body.classList.remove("directory-status-loading", "directory-closed-mode");
    if (!published) document.body.classList.add("directory-closed-mode");
  }

  function normalize(value) {
    return value.trim().toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");
  }

  function juzLabel(amount) {
    if (amount === 1) return "جزء واحد";
    if (amount === 2) return "جزآن";
    if (amount >= 3 && amount <= 10) return `${amount} أجزاء`;
    return `${amount} جزءًا`;
  }

  function renderRoster() {
    rosterList.innerHTML = visibleIndices.map((studentIndex) => {
      const student = students[studentIndex];
      const selected = studentIndex === activeIndex;
      return `<button type="button" class="roster-item${selected ? " is-active" : ""}" data-index="${studentIndex}" aria-pressed="${selected}">
        <span>${String(studentIndex + 1).padStart(2, "0")}</span><strong>${student.name}</strong><i class="fa-solid fa-chevron-left"></i>
      </button>`;
    }).join("");
    rosterEmpty.hidden = visibleIndices.length > 0;
  }

  function showStudent(index, updateHash = true) {
    activeIndex = index;
    const student = students[index];
    document.getElementById("recordNumber").textContent = `الطالب ${String(index + 1).padStart(2, "0")}`;
    document.getElementById("recordName").textContent = student.name;
    document.getElementById("recordBirth").textContent = student.birthYear;
    document.getElementById("recordMemorization").textContent = juzLabel(student.memorization);
    document.getElementById("recordTajweed").textContent = student.tajweed;
    renderRoster();
    if (updateHash) history.replaceState(null, "", `#student-${index + 1}`);
  }

  rosterList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-index]");
    if (!button) return;
    showStudent(Number(button.dataset.index));
    if (innerWidth < 760) document.getElementById("studentRecord").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  search.addEventListener("input", () => {
    const query = normalize(search.value);
    visibleIndices = students.map((student, index) => ({ student, index }))
      .filter(({ student }) => normalize(student.name).includes(query))
      .map(({ index }) => index);
    if (visibleIndices.length && !visibleIndices.includes(activeIndex)) showStudent(visibleIndices[0], false);
    else renderRoster();
  });

  document.getElementById("nextStudent").addEventListener("click", () => showStudent((activeIndex + 1) % students.length));
  document.getElementById("previousStudent").addEventListener("click", () => showStudent((activeIndex - 1 + students.length) % students.length));
  document.getElementById("studentsCount").textContent = students.length;

  const hashIndex = Number((location.hash.match(/student-(\d+)/) || [])[1]) - 1;
  showStudent(Number.isInteger(hashIndex) && hashIndex >= 0 && hashIndex < students.length ? hashIndex : 0, false);
})();
