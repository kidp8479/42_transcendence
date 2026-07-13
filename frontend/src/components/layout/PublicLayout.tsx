// Wrapper for all public pages (no login required).
// Renders: HeaderPublic + <Outlet /> + Footer
import { Outlet } from "@tanstack/react-router";
import { HeaderPublic } from "../navigation/HeaderPublic";
import { Footer } from "../navigation/Footer";

export function PublicLayout() {
  return (
    <>
      {/* Top bar with logo, Sign In and Create Account buttons */}
      <HeaderPublic logoTo="/" />

      {/* The active page (Landing, About, Contact...) renders here */}
      <main>
        <Outlet />
      </main>

      {/* Footer with Privacy, Contact, About, Terms links - required on all pages */}
      <Footer />
    </>
  );
}
