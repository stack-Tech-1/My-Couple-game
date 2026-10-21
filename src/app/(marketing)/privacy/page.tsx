import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { MIN_AGE, OPERATOR, TERMS_UPDATED } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy Policy", description: "How Amah collects, uses and protects your personal data." };

const mail = <a href={`mailto:${OPERATOR.email}`} className="underline underline-offset-2">{OPERATOR.email}</a>;

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated={TERMS_UPDATED}
      summary={
        <ul>
          <li>Amah is run by {OPERATOR.name}, a registered Nigerian business. We are the data controller.</li>
          <li>We collect what the app needs to work: your email, the name and avatar you choose, your room, and what you create and play inside it.</li>
          <li>What you share in a room is visible only to the people in that room: your partner in a couple room, or the members of a friend room. Our team does not read your messages, notes, answers, photos or voice notes, except when you report something to us or the law requires it.</li>
          <li>We never sell your data and we don&apos;t show ads.</li>
          <li>After Dark choices can reveal information about your sex life, which the law treats as sensitive. We only process it with your explicit consent, and you can withdraw it at any time.</li>
          <li>You can see, download, correct or delete your data. Deleting your account deletes what you created.</li>
          <li>Amah is for people aged {MIN_AGE} and over.</li>
        </ul>
      }
    >
      <p>
        This policy explains what personal data Amah (&ldquo;Amah&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) collects, why, who we share it with, how long we keep it and the
        rights you have. It is written to meet the Nigeria Data Protection Act 2023 (&ldquo;NDPA&rdquo;) and the Nigeria Data Protection Commission&apos;s General
        Application and Implementation Directive 2025 (&ldquo;GAID&rdquo;). Where people outside Nigeria use Amah, we apply the same protections.
      </p>

      <h2>1. Who we are</h2>
      <p>
        Amah is operated by <strong>{OPERATOR.name}</strong>, {OPERATOR.registration}, of {OPERATOR.address}. We decide why and how your personal data is
        processed, so we are the &ldquo;data controller&rdquo; under the NDPA. For anything about your data, email us at {mail}.
      </p>

      <h2>2. What we collect</h2>
      <h3>Information you give us</h3>
      <ul>
        <li><strong>Account:</strong> your email address, used to sign you in with a one-time link, or the name and email Google shares if you sign in with Google.</li>
        <li><strong>Profile:</strong> the display name, avatar and colour you choose, and your confirmation that you are {MIN_AGE} or older.</li>
        <li><strong>Your rooms:</strong> each room&apos;s name and kind, who is in it (and, for friend rooms, who owns it), invite codes, room settings (like house rules), the room you opened last, and anyone you have blocked.</li>
        <li>
          <strong>What you create and play:</strong> game moves and results, Daily Question answers, chat messages, voice notes, stickers you make, love notes,
          Memory Lane photos and captions, bucket-list items and similar content.
        </li>
        <li>
          <strong>After Dark (optional, 18+):</strong> your age confirmation and opt-in, your heat limit, a hashed (scrambled) PIN, custom cards you write and your
          Fantasy Match picks. See section 5.
        </li>
        <li><strong>Feedback, reports and support:</strong> what you send us, and when you report a message, a copy of that message.</li>
        <li><strong>Preferences:</strong> theme, sounds, data-saver mode, announcement emails and notification settings.</li>
      </ul>
      <h3>Information collected automatically</h3>
      <ul>
        <li><strong>Technical data:</strong> IP address, browser and device type, and timestamps, which our hosting providers record in their logs to keep the service running and secure.</li>
        <li><strong>Error reports:</strong> when something breaks, a report of the error (what failed, the page, browser and device). We configure this to leave out the content of your messages and your email address.</li>
        <li><strong>Push notifications:</strong> if you turn them on, a technical address your browser gives us so we can send notifications to that device.</li>
        <li><strong>Usage counts:</strong> we count things like sign-ups, active days and games played, to understand how Amah is used. These are totals, not a record of what you said.</li>
      </ul>
      <p>We do not use advertising trackers, and we do not buy data about you from anyone.</p>

      <h2>3. Why we use it, and our lawful basis</h2>
      <table>
        <thead>
          <tr>
            <th>Purpose</th>
            <th>Lawful basis (NDPA s. 25)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Creating your account, signing you in, running your room, games, chat and other features</td>
            <td>Performing our contract with you (the Terms of Service)</td>
          </tr>
          <tr>
            <td>After Dark</td>
            <td>Your explicit consent (NDPA s. 30), which you can withdraw at any time</td>
          </tr>
          <tr>
            <td>Push notifications</td>
            <td>Your consent, given when you turn them on</td>
          </tr>
          <tr>
            <td>Announcement emails about new games and important news</td>
            <td>Our legitimate interest in telling you about the service, with an unsubscribe link in every email and a switch in your settings</td>
          </tr>
          <tr>
            <td>Keeping Amah safe: preventing abuse and spam, handling reports, suspending accounts that break the rules, and fixing errors</td>
            <td>Our legitimate interests, and yours, in a safe and working service</td>
          </tr>
          <tr>
            <td>Usage totals and improving Amah</td>
            <td>Our legitimate interest in understanding and improving the product</td>
          </tr>
          <tr>
            <td>Meeting legal obligations and responding to lawful requests</td>
            <td>Legal obligation</td>
          </tr>
        </tbody>
      </table>
      <p>We do not make decisions about you based solely on automated processing that have legal or similarly significant effects.</p>

      <h2>4. Who can see what</h2>
      <ul>
        <li><strong>People in your friend rooms</strong> see your name and avatar, your messages, voice notes and stickers in that room&apos;s chat, the games you play there and their results. They never see anything from your couple room.</li>
        <li><strong>Your partner</strong> sees what you share in your couple room: your name and avatar, your moves, messages, voice notes, notes and photos. That is the point of Amah. Some things stay hidden from them by design, such as your Daily Question answer until they answer too, your hand in card games, sealed notes before their date, and Fantasy Match picks that don&apos;t match.</li>
        <li><strong>Our team</strong> can see account facts (email, name, sign-up date, last activity, whether you are paired), counts and anything you send us directly. Our tools are built so that we do not see your room&apos;s content. The exceptions are a message you report (we see that message and its context) and where the law requires access.</li>
        <li><strong>No one else</strong> in Amah can see your room.</li>
      </ul>

      <h2>5. After Dark and sensitive data</h2>
      <p>
        After Dark is an optional section for adults. Your choices there (opting in, your heat limit, custom cards and Fantasy Match picks) can reveal information
        about your sex life, which the NDPA treats as <strong>sensitive personal data</strong>. We process it only with your explicit consent, which you give
        when you opt in on your own phone. You can withdraw consent at any time by switching After Dark off. That locks it for both of you. Your custom cards and
        picks stay stored privately so they are there if you both opt in again, and you can delete them yourself or ask us to.
      </p>
      <p>
        Fantasy Match is designed so your partner only ever sees the items you <em>both</em> picked. Your other picks are never shown to them, and they are not
        shown to our team either.
      </p>

      <h2>6. Who we share data with</h2>
      <p>We share personal data only with service providers who process it for us under contract, and only as needed to run Amah:</p>
      <table>
        <thead>
          <tr>
            <th>Provider</th>
            <th>What for</th>
            <th>Where</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Supabase</td>
            <td>Database, sign-in, file storage and real-time updates</td>
            <td>Ireland (EU)</td>
          </tr>
          <tr>
            <td>Vercel</td>
            <td>Hosting the app and its servers</td>
            <td>Ireland (EU) and a global network</td>
          </tr>
          <tr>
            <td>Google</td>
            <td>Sending emails (sign-in links, announcements), and Google sign-in if you choose it</td>
            <td>Global</td>
          </tr>
          <tr>
            <td>Sentry</td>
            <td>Error reports, so we can fix problems</td>
            <td>Germany (EU)</td>
          </tr>
          <tr>
            <td>Your browser&apos;s push service (Google, Apple, Mozilla or Microsoft)</td>
            <td>Delivering notifications you&apos;ve turned on</td>
            <td>Global</td>
          </tr>
        </tbody>
      </table>
      <p>
        We may also disclose data if the law requires it, to protect someone from serious harm, or as part of a sale or reorganisation of our business. In that
        case we will tell you, and this policy will continue to protect your data. <strong>We never sell your personal data.</strong>
      </p>

      <h2>7. International transfers</h2>
      <p>
        Our providers store and process data outside Nigeria, mainly in the European Union, and in some cases the United States. Under the NDPA (Part VIII), we only transfer
        personal data abroad where the destination provides adequate protection or where appropriate safeguards are in place. These include our providers&apos;
        data processing agreements and standard contractual clauses, together with their security certifications. You can ask us for more detail at {mail}.
      </p>

      <h2>8. How long we keep it</h2>
      <ul>
        <li><strong>Account and profile:</strong> until you delete your account.</li>
        <li><strong>Room content</strong> (messages, voice notes, notes, photos, answers, game history): while your room exists. If you leave a couple room, your partner keeps the room and its shared history. If you leave a friend room, the others keep it, including messages you sent there. When the last person leaves any room, the room and its content are deleted. If you delete your account, what you created is deleted.</li>
        <li><strong>Reports and feedback:</strong> up to 2 years, so we can handle repeat problems, then deleted.</li>
        <li><strong>Error reports:</strong> up to 90 days.</li>
        <li><strong>Server logs</strong> kept by our hosting providers: usually up to 30 days.</li>
        <li><strong>Suspended accounts:</strong> kept while the suspension is in force, so the person can&apos;t simply sign up again to continue the abuse.</li>
      </ul>
      <p>We may keep information longer only where the law requires it.</p>

      <h2>9. Your rights</h2>
      <p>Under the NDPA you have the right to:</p>
      <ul>
        <li><strong>be informed</strong> about how your data is used (this policy);</li>
        <li><strong>access</strong> your data and get a copy of it in a common electronic format (portability);</li>
        <li><strong>correct</strong> data that is wrong or incomplete;</li>
        <li><strong>delete</strong> your data. You can delete your account yourself in Settings, or ask us;</li>
        <li><strong>restrict</strong> or <strong>object</strong> to processing based on our legitimate interests, including announcement emails;</li>
        <li><strong>withdraw consent</strong> at any time (for example, switching off After Dark or notifications), without affecting processing that happened before;</li>
        <li>not be subject to decisions based solely on <strong>automated processing</strong>; and</li>
        <li><strong>complain</strong> to the Nigeria Data Protection Commission (ndpc.gov.ng).</li>
      </ul>
      <p>
        To use any of these rights, email {mail} from the address on your account. We may ask you to confirm it&apos;s you. We will respond within 30 days and
        free of charge, unless a request is clearly unfounded or excessive.
      </p>

      <h2>10. How we protect your data</h2>
      <ul>
        <li>Every database table is locked by row-level security, so only the two members of a room can read that room&apos;s data.</li>
        <li>Hidden game information (like the other player&apos;s cards) stays on our servers and is never sent to your partner&apos;s phone.</li>
        <li>Photos and voice notes are stored privately and opened through short-lived signed links.</li>
        <li>Your After Dark PIN is stored only as a scrambled hash.</li>
        <li>All traffic is encrypted in transit (HTTPS), and our providers encrypt stored data.</li>
        <li>Admin access is limited, checked on every action, and never includes room content.</li>
      </ul>
      <p>
        No system is perfectly secure. If a personal data breach is likely to put your rights at risk, we will notify the Nigeria Data Protection Commission within
        72 hours of becoming aware of it. Where the risk to you is high, we will also tell you directly and explain what to do.
      </p>

      <h2>11. Age limit</h2>
      <p>
        Amah is only for people aged <strong>{MIN_AGE} or over</strong>, and everyone confirms this when they set up their profile. We do not knowingly collect data
        from anyone younger. If we learn that an account belongs to someone under {MIN_AGE}, we will delete it. If you believe a child is using Amah, tell us at {mail}.
      </p>

      <h2>12. Cookies and on-device storage</h2>
      <p>
        We use only what the app needs: a sign-in cookie to keep you logged in, and your browser&apos;s local storage for conveniences like your theme, recent
        stickers and dismissed announcements. Amah also stores some files on your device so it opens quickly and works offline. We do not use advertising or
        cross-site tracking cookies.
      </p>

      <h2>13. Changes to this policy</h2>
      <p>
        If we change this policy in a way that matters, we will update the date above and ask you to review and accept it the next time you open Amah. Small
        corrections may be made without notice.
      </p>

      <h2>14. Contact</h2>
      <p>
        {OPERATOR.name}, {OPERATOR.address}. Email: {mail}. See also our <Link href="/terms" className="underline underline-offset-2">Terms of Service</Link> and{" "}
        <Link href="/adults" className="underline underline-offset-2">18+ notice</Link>.
      </p>
    </LegalPage>
  );
}
