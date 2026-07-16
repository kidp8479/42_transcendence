// Privacy policy page (/privacy). Mandatory for 42 subject.
import { createFileRoute } from "@tanstack/react-router";
import {
  LegalPageLayout,
  type Section,
} from "../../components/layout/LegalPageLayout";

export const Route = createFileRoute("/_public/privacy")({
  component: PrivacyPage,
});

const LAST_UPDATED = "July 2026";

const sections: Section[] = [
  {
    heading: "1. Introduction",
    blocks: [
      `42 Project Planner ("we", "our", or "the Platform") is an online collaborative workspace where 42 students organize their school projects, manage tasks, and work together as a team. This Privacy Policy explains what personal data we collect, why we collect it, how we use and protect it, and the rights you have over it.`,
      `42 Project Planner is a non-commercial project developed for educational purposes as part of the 42 curriculum. We only process the data needed to operate the Platform, and we never sell your personal data.`,
      `By creating an account and using the Platform, you acknowledge that you have read and understood this Privacy Policy.`,
    ],
  },
  {
    heading: "2. Data We Collect",
    blocks: [
      `We collect the following categories of personal data:`,
      {
        list: [
          `Account information: your username, display name, email address, and profile picture (avatar). If you register with a password, we store only a securely hashed version of it, never the password itself.`,
          `Authentication data: when you sign in through a third-party provider (such as 42 or Google OAuth), we receive a unique identifier and basic profile information (such as your login, name, and email) from that provider.`,
          `Workspace and project data: the projects you create or join, and the content inside them, such as task titles and descriptions, statuses, priorities, due dates, assignments, checklists, calendar events, and the comments you write.`,
          `Social data: your friends list, the invitations you send or receive, the teams and project groups you belong to, and your online status.`,
          `Activity and notification data: the actions you perform in shared workspaces (for example creating, editing, or completing a task) and the notifications generated from your teammates' activity.`,
          `Technical data: session tokens used to keep you logged in, your IP address, basic browser information, and server logs generated when you use the Platform.`,
        ],
      },
    ],
  },
  {
    heading: "3. How We Use Your Data",
    blocks: [
      `We use your personal data to:`,
      {
        list: [
          `create and manage your account and authenticate you;`,
          `provide the collaboration features of the Platform, such as shared projects, boards, lists, calendars, and checklists;`,
          `display your profile, contributions, and activity to the teammates you share projects with;`,
          `generate and deliver notifications when changes relevant to you are made by your teammates;`,
          `maintain the security and integrity of the Platform and prevent abuse;`,
          `diagnose technical problems and improve the service.`,
        ],
      },
    ],
  },
  {
    heading: "4. Legal Basis for Processing",
    blocks: [
      `Where the General Data Protection Regulation (GDPR) applies, we process your data on the following bases: the performance of our agreement with you (providing the Platform and its features), your consent where we ask for it (for optional features), and our legitimate interest in keeping the Platform secure and functional.`,
    ],
  },
  {
    heading: "5. Cookies and Session Storage",
    blocks: [
      `We use strictly necessary cookies and browser storage to keep you signed in and to maintain your session while you use the Platform. These are essential to the operation of the service and cannot be disabled without affecting your ability to log in. We do not use advertising or third-party tracking cookies.`,
    ],
  },
  {
    heading: "6. Third-Party Services",
    blocks: [
      `The Platform relies on third-party authentication providers (such as 42 and Google) to let you sign in. When you use one of these providers, your interaction with them is governed by their own privacy policies. We only receive the limited profile information described in Section 2 and never have access to your credentials with those providers.`,
    ],
  },
  {
    heading: "7. How We Share Your Data",
    blocks: [
      `We do not sell or rent your personal data. Some information is visible to other users as an inherent part of a collaborative platform: your username, display name, avatar, and online status can be seen by other users, and everything you contribute to a shared project (such as tasks, comments, and activity) is visible to the members of that project.`,
      `Beyond this, we do not share your personal data with third parties, except where strictly required to operate the Platform or to comply with the law.`,
    ],
  },
  {
    heading: "8. Data Retention",
    blocks: [
      `We keep your personal data for as long as your account remains active. When you delete your account, we remove or anonymize your personal data, except where we are required to retain certain information for legitimate technical or legal reasons.`,
      `Content you contributed to shared projects, such as tasks or comments, may be preserved in an anonymized form so that your former teammates do not lose their work.`,
    ],
  },
  {
    heading: "9. Data Security",
    blocks: [
      `We take reasonable technical and organizational measures to protect your data, including hashing passwords, protecting sessions with signed tokens, and restricting access to stored data. However, no method of transmission or storage is completely secure, and we cannot guarantee absolute security.`,
    ],
  },
  {
    heading: "10. Your Rights",
    blocks: [
      `Depending on your location, you may have the right to access the personal data we hold about you, correct inaccurate data, request its deletion, restrict or object to its processing, and receive a copy of your data in a portable format. Where processing is based on consent, you may withdraw that consent at any time.`,
      `You also have the right to lodge a complaint with your local data protection authority (in France, the CNIL). To exercise any of these rights, contact us using the details in Section 13.`,
    ],
  },
  {
    heading: "11. Children's Privacy",
    blocks: [
      `The Platform is not intended for children under the age of 16 (or the minimum age required in your country). We do not knowingly collect personal data from children below this age. If you believe a child has provided us with personal data, please contact us so we can remove it.`,
    ],
  },
  {
    heading: "12. Changes to This Policy",
    blocks: [
      `We may update this Privacy Policy from time to time. When we make significant changes, we will update the "Last updated" date at the top of this page and, where appropriate, notify you within the Platform. Continued use of the Platform after changes take effect means you accept the updated policy.`,
    ],
  },
  {
    heading: "13. Contact Us",
    blocks: [
      `If you have questions about this Privacy Policy or want to exercise any of the rights described in Section 10, reach out to the team via the Contact page of the Platform, or directly on the 42 intranet using any of our logins.`,
    ],
  },
];

function PrivacyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      subtitle={`Last updated: ${LAST_UPDATED}`}
      sections={sections}
    />
  );
}
