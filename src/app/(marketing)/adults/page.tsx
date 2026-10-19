import type { Metadata } from "next";
import { LegalPage, Placeholder } from "@/components/LegalPage";

export const metadata: Metadata = { title: "18+ Notice" };

export default function Adults() {
  return (
    <LegalPage title="18+ notice" updated="pending">
      <p>
        The After Dark section contains suggestive content for adults only. It stays locked until both people in a room
        have separately confirmed they are 18 or older and chosen to opt in. Either person can opt out at any time,
        which locks it again for both.
      </p>
      <Placeholder>the formal 18+ notice and any jurisdiction-specific age-verification language.</Placeholder>
    </LegalPage>
  );
}