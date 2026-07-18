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
import { LayoutContainer } from "./LayoutContainer";

/* Link is TanStack Router's own ready-made link component.
It works, but it renders its own markup — we'd lose the Flowbite FooterLink styling and integration.
CreateLink is a factory function. Instead of giving us a link, it turns another component into a router-aware link.
We hand it Flowbite's FooterLink, and it gives back a new component that keeps Flowbite's
look while gaining TanStack Router's navigation and type-safe to prop. */
const RouterFooterLink = createLink(FooterLink);

export function Footer() {
  return (
    <FlowbiteFooter
      container
      className="w-full !rounded-none !bg-surface-base !p-0 !shadow-none border-t border-surface-border"
    >
      <LayoutContainer className="flex w-full flex-col gap-4 px-4 py-6 md:flex-row md:items-center md:justify-between">
        <FooterCopyright
          className="text-text-secondary"
          by="42 Project Planner"
          year={new Date().getFullYear()}
        />
        <FooterLinkGroup className="flex-wrap gap-x-6 gap-y-2">
          <RouterFooterLink
            className="text-text-secondary hover:text-brand-500"
            to="/about"
          >
            About
          </RouterFooterLink>
          <RouterFooterLink
            className="text-text-secondary hover:text-brand-500"
            to="/privacy"
          >
            Privacy Policy
          </RouterFooterLink>
          <RouterFooterLink
            className="text-text-secondary hover:text-brand-500"
            to="/terms"
          >
            Terms of Service
          </RouterFooterLink>
          <RouterFooterLink
            className="text-text-secondary hover:text-brand-500"
            to="/contact"
          >
            Contact
          </RouterFooterLink>
        </FooterLinkGroup>
      </LayoutContainer>
    </FlowbiteFooter>
  );
}
