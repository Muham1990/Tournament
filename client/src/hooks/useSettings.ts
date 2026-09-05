import { useEffect, useState } from "react";
import { MiscApi } from "../services/endpoints";
import type { SiteSettings } from "../types";

export function useSettings() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  useEffect(() => {
    MiscApi.settings().then((r) => setSettings(r.data.item)).catch(() => undefined);
  }, []);
  return settings;
}
