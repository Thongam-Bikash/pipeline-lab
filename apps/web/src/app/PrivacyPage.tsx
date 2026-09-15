import { Link } from 'react-router'

const link = 'text-signal underline underline-offset-4'
const heading = 'mt-8 text-xl font-semibold'

// Must match what the API really stores: apps/api/src/schema.ts and auth-schema.ts.
export function PrivacyPage() {
  return (
    <article className="max-w-[68ch]">
      <h1 className="text-3xl font-bold">How your data is handled</h1>
      <p className="mt-2 text-sm text-muted">Last updated 15 September 2026.</p>

      <h2 className={heading}>You do not need an account</h2>
      <p className="mt-2">
        Every lesson, scenario and the Playground work without one. As a guest, your progress, saved projects and theme stay in this browser&apos;s
        local storage and are not sent anywhere.
      </p>

      <h2 className={heading}>What an account stores</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>Your email address, whether you have confirmed it, and when you created the account.</li>
        <li>A hash of your password, never the password itself.</li>
        <li>If you sign in with Google: your Google account ID and the sign-in tokens Google issues.</li>
        <li>The lessons you finished and the scenarios you passed, when, your quiz scores, and how many hints you used.</li>
        <li>Your saved Playground projects: their names and workflows.</li>
        <li>A record of each signed-in session: when it started and expires, and the IP address and browser it came from.</li>
      </ul>
      <p className="mt-2">Your theme is not stored. It stays with each device.</p>

      <h2 className={heading}>Why</h2>
      <p className="mt-2">
        To sign you in, and to keep your progress and projects in step across the devices you use. Nothing else: no advertising, no analytics, no
        tracking, and nothing is sold or shared.
      </p>

      <h2 className={heading}>Cookies</h2>
      <p className="mt-2">Cookies are set only when you sign in, and only to keep you signed in. There are no analytics or third-party cookies.</p>

      <h2 className={heading}>Who else sees it</h2>
      <p className="mt-2">
        No one, with two exceptions. Google, if you choose to sign in with Google. And the email service that delivers your confirmation and
        password reset messages, which receives your address in order to send them.
      </p>

      <h2 className={heading}>How long it is kept</h2>
      <p className="mt-2">
        For as long as the account exists. Deleting the account removes it immediately, with every session, progress record and saved project.
        Backups taken before then still contain it until they expire, which takes up to 30 days.
      </p>
      <p className="mt-2">
        Deleting one project removes its name and workflow at once. A record that it existed, holding only its ID and when it was deleted, is kept so
        that another of your devices cannot bring it back.
      </p>

      <h2 className={heading}>Getting your data, or deleting it</h2>
      <p className="mt-2">
        From your{' '}
        <Link to="/account" className={link}>
          account page
        </Link>{' '}
        you can download everything the account stores, or delete the account. There is no request to send and nothing to wait for.
      </p>

      <h2 className={heading}>A known limitation</h2>
      <p className="mt-2">
        Creating an account with an address that already has one gives a different answer than a new address does, so the sign-up form can reveal
        whether an address is registered. The password reset form gives the same answer either way.
      </p>

      <h2 className={heading}>Questions</h2>
      <p className="mt-2">
        Open an issue on the{' '}
        <a href="https://github.com/Thongam-Bikash/pipeline-lab" className={link}>
          project&apos;s GitHub repository
        </a>
        .
      </p>
    </article>
  )
}
