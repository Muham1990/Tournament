import axios from "axios";
import { apiBase } from "../lib/config";

export const api = axios.create({
  baseURL: apiBase(),
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function asForm(data: Record<string, unknown>, file?: File | null, fileField = "photo") {
  const fd = new FormData();
  Object.entries(data).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    if (typeof v === "boolean") fd.append(k, v ? "true" : "false");
    else fd.append(k, String(v));
  });
  if (file) fd.append(fileField, file);
  return fd;
}
