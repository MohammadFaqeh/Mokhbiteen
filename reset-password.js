(function () {
  "use strict";

  const config = window.MOKHBITEEN_SUPABASE;
  const form = document.getElementById("resetPasswordForm");
  const passwordInput = document.getElementById("newPassword");
  const confirmInput = document.getElementById("confirmPassword");
  const message = document.getElementById("resetMessage");
  const client = config && window.supabase
    ? window.supabase.createClient(config.url, config.publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: true }
      })
    : null;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!client) {
      message.textContent = "تعذر الاتصال بخدمة استعادة كلمة المرور.";
      return;
    }
    if (passwordInput.value.length < 8) {
      message.textContent = "يجب أن تتكون كلمة المرور من 8 أحرف أو أرقام على الأقل.";
      return;
    }
    if (passwordInput.value !== confirmInput.value) {
      message.textContent = "كلمتا المرور غير متطابقتين.";
      return;
    }
    const button = form.querySelector("button[type='submit']");
    button.disabled = true;
    button.textContent = "جاري الحفظ...";
    const { error } = await client.auth.updateUser({ password: passwordInput.value });
    if (error) {
      message.classList.remove("reset-success");
      message.textContent = "الرابط غير صالح أو انتهت صلاحيته. اطلب رابطًا جديدًا من صفحة الدخول.";
      button.disabled = false;
      button.textContent = "حفظ كلمة المرور الجديدة";
      return;
    }
    await client.auth.signOut({ scope: "local" });
    form.style.display = "none";
    message.classList.add("reset-success");
    message.textContent = "تم تغيير كلمة المرور بنجاح. ارجع إلى لوحة التحكم وسجّل الدخول.";
  });
})();
