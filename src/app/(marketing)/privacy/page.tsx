import type { Metadata } from "next";
import { LegalPage, Placeholder } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="pending">
      <Placeholder>the full privacy policy: what is collected, why, processors (Supabase, hosting, optional analytics), retention, and user rights.</Placeholder>
      <h2>How the product is built</h2>
      <p>
        Every table is protected by row-level security so only the two members of a room can read that room&apos;s data.
        Hidden game information is stored server-side and never sent to the other player. Photos are stored privately
        and served through short-lived signed links. Deleting your account deletes everything you created.
      </p>
      <h2>Analytics</h2>
      <Placeholder>whether analytics are enabled and which provider. The app only ever sends event names, never content.</Placeholder>
    </LegalPage>
  );
}