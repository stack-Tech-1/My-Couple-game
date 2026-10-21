import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { MIN_AGE, OPERATOR, TERMS_UPDATED } from "@/lib/legal";

export const metadata: Metadata = { title: "18+ Notice", description: "How Amah's adults-only After Dark section works, and how consent is protected." };

export default function Adults() {
  return (
    <LegalPage title="18+ notice" updated={TERMS_UPDATED}>
      <p>
        Amah is for adults only: everyone must be {MIN_AGE} or older to use it. Inside Amah, the optional <strong>After Dark</strong> section contains suggestive,
        flirty games for couples. It is never explicit or graphic, but it is not for everyone, and that&apos;s fine.
      </p>

      <h2>How it stays locked</h2>
      <ul>
        <li>After Dark is closed by default. It opens only when <strong>both</strong> people in a room have, each on their own phone, confirmed they are {MIN_AGE} or older and chosen to opt in.</li>
        <li>Opting in is also your explicit consent for Amah to store your After Dark choices. These can reveal information about your sex life, which Nigerian data protection law treats as sensitive. See our <Link href="/privacy" className="underline underline-offset-2">Privacy Policy</Link>.</li>
        <li>Each of you can set a PIN, so the section stays closed if someone else picks up your phone. Discreet mode blurs the screen when you look away, and quick exit leaves instantly.</li>
        <li>Each of you sets a heat limit. Games only use cards up to the lower of your two limits.</li>
      </ul>

      <h2>Consent, always</h2>
      <ul>
        <li>Either of you can skip any card, end any game or switch After Dark off at any time, with no reason needed. Switching it off locks it for both of you.</li>
        <li>No one should ever feel pressured. If something makes you uncomfortable, stop, and you can report it to us from the app.</li>
        <li>Never record, screenshot or share anything from After Dark without your partner&apos;s clear consent. Sharing intimate content without consent may be a crime.</li>
      </ul>

      <h2>Under 18?</h2>
      <p>
        Please don&apos;t use Amah. If you know someone under {MIN_AGE} is using it, tell us at{" "}
        <a href={`mailto:${OPERATOR.email}`} className="underline underline-offset-2">{OPERATOR.email}</a> and we will remove the account.
      </p>
    </LegalPage>
  );
}
