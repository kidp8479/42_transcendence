// Terms of service page (/terms). Mandatory for 42 subject.
import { createFileRoute } from "@tanstack/react-router";
import {
  LegalPageLayout,
  type Section,
} from "../../components/layout/LegalPageLayout";

export const Route = createFileRoute("/_public/terms")({
  component: TermsPage,
});

const LAST_UPDATED = "July 2026";

const sections: Section[] = [
  {
    heading: "1. Acceptance of Terms",
    blocks: [
      `These Terms of Service ("Terms") govern your access to and use of 42 Project Planner (the "Platform"), an online collaborative workspace for 42 students. By creating an account or using the Platform, you agree to be bound by these Terms. If you do not agree, you must not use the Platform.`,
      `42 Project Planner is a non-commercial project developed for educational purposes as part of the 42 curriculum.`,
    ],
  },
  {
    heading: "2. Description of the Service",
    blocks: [
      `The Platform allows registered users to create and join project workspaces, plan and track their work using dashboards, Kanban boards, task lists, calendars, and checklists, add friends, build teams, and collaborate in real time, including through notifications about changes made by other members. Features may change, be added, or be removed as the project evolves.`,
    ],
  },
  {
    heading: "3. Eligibility and Account Registration",
    blocks: [
      `You must be at least 16 years old (or the minimum age required in your country) to use the Platform. To access most features you must create an account, either directly or through a supported third-party authentication provider. You agree to provide accurate information and to keep it up to date.`,
    ],
  },
  {
    heading: "4. Account Security",
    blocks: [
      `You are responsible for maintaining the confidentiality of your account and for all activity that occurs under it. Notify us immediately if you suspect any unauthorized use of your account.`,
    ],
  },
  {
    heading: "5. Acceptable Use",
    blocks: [
      `When using the Platform, you agree not to:`,
      {
        list: [
          `access or attempt to access projects, workspaces, or data belonging to teams you are not a member of;`,
          `harass, threaten, insult, or discriminate against other users;`,
          `post spam or illegal, hateful, sexually explicit, or otherwise inappropriate content in projects, tasks, comments, usernames, or avatars;`,
          `impersonate other users, staff, or third parties;`,
          `attempt to gain unauthorized access to the Platform, other accounts, or its underlying systems;`,
          `disrupt, overload, or interfere with the normal operation of the Platform, including through automated scripts, denial-of-service attacks, or the exploitation of race conditions.`,
        ],
      },
    ],
  },
  {
    heading: "6. User Content",
    blocks: [
      `You are solely responsible for the content you create or share, including projects, tasks, comments, and your profile information (such as your username and avatar). You grant us the right to store and display this content as needed to operate the Platform, including showing it to the members of the workspaces where you share it.`,
      `Content added to a shared project is visible to the other members of that project and may remain available to them, in an anonymized form, even if you later leave the project or delete your account.`,
      `We may review, moderate, or remove any content, and suspend accounts, when content violates these Terms or harms other users.`,
    ],
  },
  {
    heading: "7. Intellectual Property",
    blocks: [
      `The Platform, including its code, design, and original assets, is provided for educational purposes. You must not copy, redistribute, or exploit the Platform for commercial purposes without permission. The content you and your team create on the Platform remains yours, but you are responsible for ensuring you have the right to use anything you share on it.`,
    ],
  },
  {
    heading: "8. Third-Party Authentication",
    blocks: [
      `Signing in through a third-party provider (such as 42 or Google) is subject to that provider's own terms and privacy policies. We are not responsible for the availability or practices of those providers.`,
    ],
  },
  {
    heading: "9. Service Availability",
    blocks: [
      `The Platform is provided on an "as is" and "as available" basis. As an educational project, it may be interrupted, unavailable, reset, or discontinued at any time, and we do not guarantee that it will be error-free or continuously available. We recommend keeping your own copies of any critical information you store on the Platform.`,
    ],
  },
  {
    heading: "10. Suspension and Termination",
    blocks: [
      `We may suspend or terminate your access to the Platform, with or without notice, if you violate these Terms or if we need to protect the Platform or its users. You may stop using the Platform and delete your account at any time.`,
    ],
  },
  {
    heading: "11. Disclaimer of Warranties",
    blocks: [
      `To the fullest extent permitted by law, the Platform is provided without warranties of any kind, whether express or implied, including but not limited to fitness for a particular purpose and non-infringement.`,
    ],
  },
  {
    heading: "12. Limitation of Liability",
    blocks: [
      `To the fullest extent permitted by law, we shall not be liable for any indirect, incidental, or consequential damages, or for any loss of data, arising from your use of or inability to use the Platform.`,
    ],
  },
  {
    heading: "13. Changes to the Terms",
    blocks: [
      `We may update these Terms from time to time. When we make significant changes, we will update the "Last updated" date at the top of this page. Continued use of the Platform after changes take effect means you accept the updated Terms.`,
    ],
  },
  {
    heading: "14. Governing Law",
    blocks: [
      `These Terms are governed by the laws of the jurisdiction in which the project is operated, without regard to conflict-of-law principles.`,
    ],
  },
];

export function TermsPage() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      subtitle={`Last updated: ${LAST_UPDATED}`}
      sections={sections}
    />
  );
}
