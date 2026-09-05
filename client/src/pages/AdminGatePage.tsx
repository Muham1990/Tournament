import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AuthApi } from "../services/endpoints";
import { markAdminEntry } from "../lib/adminGate";
import { Loading } from "../components/Ui";

export function AdminGatePage() {
  const { code = "" } = useParams();
  const nav = useNavigate();

  useEffect(() => {
    AuthApi.openGate(code)
      .then(() => {
        markAdminEntry();
        nav("/login", { replace: true });
      })
      .catch(() => nav("/", { replace: true }));
  }, [code, nav]);

  return <Loading />;
}
