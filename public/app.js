const form = document.getElementById("estimate-form");
const statusEl = document.getElementById("form-status");
const confirmation = document.getElementById("confirmation");
const timestampField = document.getElementById("submission_timestamp");
const appVersionField = document.getElementById("app_version");

const APP_VERSION = "1.0.0";
appVersionField.value = APP_VERSION;

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  statusEl.textContent = "";

  const formData = new FormData(form);
  const services = formData.getAll("services_requested");
  if (services.length === 0) {
    statusEl.textContent = "Please select at least one service.";
    return;
  }

  timestampField.value = new Date().toISOString();

  const payload = Object.fromEntries(formData.entries());
  payload.services_requested = services;

  toggleForm(true);

  try {
    const response = await fetch("/api/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error("Submission failed.");
    }

    form.classList.add("hidden");
    confirmation.classList.remove("hidden");
  } catch (error) {
    statusEl.textContent = "Submission failed. Please try again.";
    toggleForm(false);
  }
});

function toggleForm(isSubmitting) {
  form.querySelectorAll("input, select, textarea, button").forEach((el) => {
    el.disabled = isSubmitting;
  });
}
