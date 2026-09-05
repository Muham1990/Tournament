import { Outlet } from "react-router-dom";
import { Header } from "../components/Header";
import { Footer } from "../components/Header";

export function PublicLayout() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Header />
      <main style={{ flex: 1 }}><Outlet /></main>
      <Footer />
    </div>
  );
}
