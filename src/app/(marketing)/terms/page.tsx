import type { Metadata } from "next";
import { LegalPage, Placeholder } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms of Service" };

export default function Terms() {
  return (
    <LegalPage title="Terms of Service" updated="pending">
      <Placeholder>the full terms of service. Cover eligibility, accounts, acceptable use, user content, termination, disclaimers and governing law.</Placeholder>
      <h2>Content you create</h2>
      <Placeholder>ownership and licence for notes, photos, custom cards and answers players create inside a room.</Placeholder>
      <h2>Adult content</h2>
      <Placeholder>terms specific to the opt-in 18+ section. See also the 18+ notice.</Placeholder>
    </LegalPage>
  );
}