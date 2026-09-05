const KEY = "ka_admin_entry";

export function markAdminEntry() {
  localStorage.setItem(KEY, "1");
}

export function isLocalAdminHost() {
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1";
}

export function canSeeAdminEntry() {
  return localStorage.getItem(KEY) === "1" || isLocalAdminHost();
}
