import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { MIN_AGE, OPERATOR, TERMS_UPDATED } from "@/lib/legal";

export const metadata: Metadata = { title: "Terms of Service", description: "The rules for using Amah." };

const mail = <a href={`mailto:${OPERATOR.email}`} className="underline underline-offset-2">{OPERATOR.email}</a>;

export default function Terms() {
  return (
    <LegalPage
      title="Terms of Service"
      updated={TERMS_UPDATED}
      summary={
        <ul>
          <li>Amah is a private game room for adults: a couple room for two, and friend rooms for up to eight. You must be {MIN_AGE} or older.</li>
          <li>Be kind to the people in your rooms and honest with us. No harassment, no illegal content, no sharing intimate images of anyone without their consent.</li>
          <li>What you create stays yours. You let us store and show it to the people in that room so Amah can work.</li>
          <li>After Dark is optional, adults-only, and opens only when both of you say yes.</li>
          <li>Amah is free for now. If we add paid features, you&apos;ll see the price and terms before you pay.</li>
          <li>Nigerian law applies.</li>
        </ul>
      }
    >
      <p>
        These Terms are an agreement between you and <strong>{OPERATOR.name}</strong> ({OPERATOR.registration}, {OPERATOR.address}) (&ldquo;we&rdquo;,
        &ldquo;us&rdquo;), which runs Amah. By creating an account or using Amah you agree to these Terms and to our{" "}
        <Link href="/privacy" className="underline underline-offset-2">Privacy Policy</Link>. If you don&apos;t agree, please don&apos;t use Amah.
      </p>

      <h2>1. Who can use Amah</h2>
      <ul>
        <li>You must be at least <strong>{MIN_AGE} years old</strong> and able to enter into a binding agreement.</li>
        <li>You may have one account, and you are responsible for keeping access to your email (and Google account, if you use it) secure.</li>
        <li>You must not use Amah if we have suspended or removed your account before, unless we agree.</li>
      </ul>

      <h2>2. Your room</h2>
      <ul>
        <li>There are two kinds of room. A <strong>couple room</strong> is shared by two people; you can be in one at a time. A <strong>friend room</strong> holds up to eight people; you can be in up to five. Anything you share in a room, such as messages, voice notes, notes, photos and answers, can be seen by everyone in that room, except things the app keeps hidden by design (described in the Privacy Policy).</li>
        <li>Friend rooms have an owner: the person who started the room, or whoever it was handed to. The owner can rename the room, share or change its invite code, and remove people. If the owner leaves, they can choose the next owner; otherwise the person who has been in the room longest becomes the owner.</li>
        <li>Friend rooms have games and a group chat only. After Dark and the couple features (such as love notes, Memory Lane and moods) are only ever available in couple rooms.</li>
        <li>Only invite people you trust. You can leave a room at any time in Settings. In a couple room, your partner keeps the room and its shared history, and gets a new invite code. In a friend room, everyone else keeps the room.</li>
        <li>You can block your partner, which removes you from your couple room. In a friend room, blocking someone hides their messages and game invites from you, and nobody has to leave. You can report anything that breaks these Terms.</li>
      </ul>

      <h2>3. Acceptable use</h2>
      <p>You agree not to use Amah to:</p>
      <ul>
        <li>harass, threaten, blackmail, stalk or abuse anyone, or pressure your partner or anyone in your rooms into anything;</li>
        <li>share sexual or intimate images or videos of anyone without their consent, or any sexual content involving a person under 18 (we report this to the authorities);</li>
        <li>share content that is unlawful in Nigeria, including content prohibited by the Cybercrimes (Prohibition, Prevention, etc.) Act 2015, or content that is hateful, or promotes violence or self-harm;</li>
        <li>impersonate someone, or use someone else&apos;s account or email without permission;</li>
        <li>send spam, scams, malware, or advertising;</li>
        <li>break, overload, reverse-engineer, scrape or get around the security of Amah, or access another room&apos;s data;</li>
        <li>use Amah for any commercial purpose without our written permission.</li>
      </ul>
      <p>If you break these rules, we may remove content, limit features, or suspend or delete your account (see section 8).</p>

      <h2>4. After Dark (18+)</h2>
      <ul>
        <li>After Dark contains suggestive content for adults. At the Fire heat level, which both of you must choose, some cards are sexually explicit. It is off by default and opens only when <strong>both</strong> members of a room have each confirmed they are {MIN_AGE}+ and chosen to opt in on their own device.</li>
        <li>Consent matters more than any game. Either of you can skip any card, end any game, or switch After Dark off at any time, and that locks it for both of you. No one is ever required to do anything.</li>
        <li>Content in After Dark is meant for two consenting adults in a relationship. Do not use it to pressure anyone, and do not record or share what happens without your partner&apos;s consent.</li>
        <li>See our <Link href="/adults" className="underline underline-offset-2">18+ notice</Link>.</li>
      </ul>

      <h2>5. Your content</h2>
      <ul>
        <li>You own what you create in Amah, such as messages, voice notes, photos, notes, answers, stickers and custom cards.</li>
        <li>You give us a limited, non-exclusive, royalty-free licence to store, process and display it, and only to run Amah for you and the people in your rooms, including backups and handling reports. This licence ends when your content is deleted, except where we must keep it by law.</li>
        <li>You confirm you have the right to share what you upload. Don&apos;t upload photos, stickers or audio that belong to someone else unless you are allowed to.</li>
        <li>If you send us feedback or suggest questions or cards, we may use them freely to improve Amah, without owing you anything.</li>
      </ul>

      <h2>6. Our content</h2>
      <p>
        The Amah name, design, games, questions, cards and software belong to us or our licensors. You may use them only to enjoy Amah as intended. Don&apos;t copy,
        sell or redistribute them.
      </p>

      <h2>7. Price and changes to Amah</h2>
      <ul>
        <li>Amah is currently free. We may add paid features or subscriptions in the future. You&apos;ll always see the price and any extra terms before you pay, and nothing you&apos;re already using for free will be charged without telling you first.</li>
        <li>We keep improving Amah, so games and features may change, be added, paused or removed. If we plan to close Amah entirely, we&apos;ll give at least 30 days&apos; notice where we reasonably can, so you can save what matters to you.</li>
      </ul>

      <h2>8. Suspension and ending your account</h2>
      <ul>
        <li>You can delete your account at any time in Settings. This deletes what you created, as described in the Privacy Policy.</li>
        <li>We may suspend or delete an account that breaks these Terms, puts others at risk, or where the law requires it. Where it&apos;s safe and lawful, we&apos;ll tell you why. If you think we got it wrong, email {mail}.</li>
      </ul>

      <h2>9. Disclaimers</h2>
      <p>
        We work hard to keep Amah running well, but it is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;. We can&apos;t promise it will always be
        uninterrupted, error-free or available on every device or network. Amah is for fun and connection. It is not relationship counselling, therapy or
        professional advice. Nothing in these Terms limits rights you have under the Federal Competition and Consumer Protection Act 2018 or other laws that can&apos;t
        be excluded.
      </p>

      <h2>10. Limit of our liability</h2>
      <p>
        To the extent the law allows, we are not liable for indirect or consequential losses, or for loss of data, profits or goodwill. Our total liability to you
        for any claim about Amah is limited to the amount you paid us in the 12 months before the claim, or ₦10,000 if you paid nothing. We are not responsible for
        what other users, including your partner and the people in your friend rooms, say or do. Nothing here limits liability for death or personal injury caused by negligence, for fraud, or for
        anything else that can&apos;t be limited by law.
      </p>

      <h2>11. Indemnity</h2>
      <p>
        If you break these Terms or the law while using Amah and that causes a claim against us, you agree to cover our reasonable losses and costs from that
        claim.
      </p>

      <h2>12. Changes to these Terms</h2>
      <p>
        We may update these Terms. If a change matters, we&apos;ll update the date above and ask you to accept the new Terms the next time you open Amah. If you
        don&apos;t accept them, you can delete your account.
      </p>

      <h2>13. Law and disputes</h2>
      <p>
        These Terms are governed by the laws of the Federal Republic of Nigeria. If something goes wrong, please email {mail} first. Most problems can be sorted
        out quickly and informally. If we can&apos;t resolve a dispute within 30 days, the courts of Oyo State, Nigeria, will have jurisdiction, without
        affecting any right you have to bring a complaint before a consumer or data protection regulator.
      </p>

      <h2>14. Contact</h2>
      <p>
        {OPERATOR.name}, {OPERATOR.address}. Email: {mail}.
      </p>
    </LegalPage>
  );
}
