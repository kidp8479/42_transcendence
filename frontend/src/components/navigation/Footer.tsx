// Footer shown on all pages (public and authenticated).
// Contains: Privacy + Contact + About + Terms links.
// Required on all pages per the 42 subject.
// This is a basic set up to understand how the layout works (if you go to the localhost:8080 you will see the footer live on all pages !)
import { createLink } from "@tanstack/react-router";

// The "as" keyword inside an import renames something as you bring it in. Here it's simply a rename.
import {
  Footer as FlowbiteFooter,
  FooterCopyright,
  FooterLink,
  FooterLinkGroup,
} from "flowbite-react";

/* Link is TanStack Router's own ready-made link component.
It works, but it renders its own markup — we'd lose the Flowbite FooterLink styling and integration.
CreateLink is a factory function. Instead of giving us a link, it turns another component into a router-aware link.
We hand it Flowbite's FooterLink, and it gives back a new component that keeps Flowbite's
look while gaining TanStack Router's navigation and type-safe to prop. */
const RouterFooterLink = createLink(FooterLink);

export function Footer() {
  return (
    <footer>
      <div className="bg-surface-base">
        <FlowbiteFooter
          container
          className="bg-surface-base relative md:justify-start "
        >
          <FooterCopyright
            className="text-text-secondary"
            by="Transcendence Project"
            year={2026}
          />
          <FooterLinkGroup className="justify-center gap-4 md:absolute md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2">
            <RouterFooterLink className="text-text-secondary" to="/about">
              About
            </RouterFooterLink>
            <RouterFooterLink className="text-text-secondary" to="/privacy">
              Privacy Policy
            </RouterFooterLink>
            <RouterFooterLink className="text-text-secondary" to="/terms">
              Terms of Service
            </RouterFooterLink>
            <RouterFooterLink className="text-text-secondary" to="/contact">
              Contact
            </RouterFooterLink>
          </FooterLinkGroup>
        </FlowbiteFooter>
      </div>
    </footer>
  );
}
