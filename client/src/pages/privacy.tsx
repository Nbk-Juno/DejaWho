import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background py-[max(2rem,env(safe-area-inset-top))] px-[max(1rem,env(safe-area-inset-right))]">
      <div className="max-w-2xl mx-auto space-y-8">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <div className="space-y-6">
          <h1 className="text-3xl font-bold">Privacy Policy &amp; Terms of Service</h1>
          <p className="text-sm text-muted-foreground">Last updated: June 2026</p>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">What DejaWho is</h2>
            <p className="text-muted-foreground">
              DejaWho is a private memory app that helps you record and search encounters
              with people. It is currently invite-only and operated by an individual, not a
              company. By using it you agree to these terms.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">What data we store</h2>
            <p className="text-muted-foreground">For each encounter you record, we store:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>The person's name, location, date, and your notes</li>
              <li>A numeric embedding (a list of numbers that captures the meaning of your text, used for search)</li>
              <li>Your account email and monthly usage counts</li>
            </ul>
            <p className="text-muted-foreground">
              All data is stored in a secured database. Each user can only see their own
              encounters — this is enforced at both the application and database level.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Signing in with Google</h2>
            <p className="text-muted-foreground">
              If you choose “Continue with Google,” DejaWho uses Google Sign-In (OAuth) to
              authenticate you. This is the <strong>only</strong> way DejaWho interacts with
              Google, and it is used strictly to sign you in. DejaWho does not request or
              access Gmail, Google Drive, Google Calendar, Contacts, or any other Google
              service or data.
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>
                <strong>What we access:</strong> only your basic Google profile — your email
                address, name, and profile picture — via Google's standard sign-in scopes
                (<code>email</code>, <code>profile</code>, <code>openid</code>). We never
                receive your Google password.
              </li>
              <li>
                <strong>How we use it:</strong> your email address signs you in, identifies
                your account, and is checked against our invite allow-list. Your name and
                profile picture, if provided, are used only to show your account within the
                app. We do not use Google user data for any other purpose.
              </li>
              <li>
                <strong>How we store it:</strong> this profile information is held by our
                authentication provider (Supabase) as your account identity, in a secured
                database, for as long as your account exists. When you delete your account it
                is permanently deleted along with the rest of your data.
              </li>
              <li>
                <strong>How we share it:</strong> we do not sell, rent, or share your Google
                user data, and we never use it for advertising. It is not transferred to any
                third party except the infrastructure provider strictly necessary to run
                sign-in (our authentication and database provider, Supabase).
              </li>
            </ul>
            <p className="text-muted-foreground">
              DejaWho's use of information received from Google APIs adheres to the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">What we send to OpenAI</h2>
            <p className="text-muted-foreground">
              DejaWho uses OpenAI's API to power several features. Here is exactly what gets
              sent and why:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>
                <strong>When you save an encounter:</strong> Your text is sent to generate a
                numeric embedding for search. The text is also sent to extract structured
                fields (name, date, location, context).
              </li>
              <li>
                <strong>When you search:</strong> Your search query is sent to generate an
                embedding and, if matches are found, to produce a natural-language summary
                of results.
              </li>
              <li>
                <strong>When you use voice:</strong> Audio is sent to OpenAI Whisper for
                transcription. If you use text-to-speech, the response text is sent for
                audio generation.
              </li>
            </ul>
            <p className="text-muted-foreground">
              OpenAI does <strong>not</strong> use data sent via their API to train their
              models. Per their API data usage policy, inputs and outputs may be retained for
              up to 30 days for abuse monitoring, then deleted.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Your data rights</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>
                <strong>Export:</strong> You can download all of your data at any time as a
                JSON file from the app.
              </li>
              <li>
                <strong>Delete:</strong> You can permanently delete your account and all
                associated data from the app. This is irreversible.
              </li>
              <li>
                <strong>If someone mentioned in an encounter wants their data removed:</strong>{" "}
                Contact the operator by email. We will search for and delete records
                mentioning that person.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Usage limits</h2>
            <p className="text-muted-foreground">
              To manage costs, each user has monthly limits on voice transcriptions,
              text-to-speech, and searches. Your current usage is visible on the home screen.
              Limits reset on the first of each month.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">What we don't do</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>We don't sell your data</li>
              <li>We don't show ads</li>
              <li>We don't share data between users</li>
              <li>We don't log the content of your encounters on our servers</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Terms of Service</h2>
            <p className="text-muted-foreground">
              DejaWho is provided as-is during this invite-only period. The operator
              reserves the right to modify or discontinue the service at any time.
              Don't use it for anything illegal. Don't try to access other users' data.
              The operator is not liable for data loss, though we make reasonable efforts
              to keep things running.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Contact</h2>
            <p className="text-muted-foreground">
              Questions or requests? Email the operator directly. If you're using this
              app, you already know how to reach them.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
