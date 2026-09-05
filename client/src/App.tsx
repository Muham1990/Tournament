import { Navigate, Route, Routes } from "react-router-dom";
import { PublicLayout } from "./layouts/PublicLayout";
import { AdminLayout } from "./layouts/AdminLayout";
import { HomePage } from "./pages/HomePage";
import { TournamentsPage } from "./pages/TournamentsPage";
import { TournamentPage } from "./pages/TournamentPage";
import { ContactsPage, PricingPage, LoginPage } from "./pages/StaticPages";
import { AdminGatePage } from "./pages/AdminGatePage";
import { LiveSportsPage } from "./pages/LiveSportsPage";
import {
  AdminDashboard, AdminTournaments, AdminTournamentForm, AdminTournamentHub,
  AdminClubs, AdminCountries, AdminMessages, AdminSettings, AdminAudit, PublicDrawPage,
} from "./pages/admin/AdminPages";

export function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/tournaments" element={<TournamentsPage />} />
        <Route path="/tournament/:id" element={<TournamentPage />} />
        <Route path="/tournament/:id/participants" element={<TournamentPage />} />
        <Route path="/tournament/:id/live" element={<TournamentPage />} />
        <Route path="/tournament/:id/results" element={<TournamentPage />} />
        <Route path="/tournament/:id/draws/:drawId" element={<PublicDrawPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/contacts" element={<ContactsPage />} />
        <Route path="/live" element={<LiveSportsPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/a/:code" element={<AdminGatePage />} />
      </Route>
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="tournaments" element={<AdminTournaments />} />
        <Route path="tournaments/new" element={<AdminTournamentForm />} />
        <Route path="tournaments/:id" element={<AdminTournamentForm />} />
        <Route path="tournament/:id" element={<AdminTournamentHub />} />
        <Route path="tournament/:id/draws" element={<AdminTournamentHub />} />
        <Route path="clubs" element={<AdminClubs />} />
        <Route path="countries" element={<AdminCountries />} />
        <Route path="messages" element={<AdminMessages />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="audit" element={<AdminAudit />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
