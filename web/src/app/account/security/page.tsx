import Link from "next/link";
import { BRAND } from "@taptapsell/brand";
import { apiFetch } from "@/lib/api";
import { revokeOtherSessionsAction, revokeSessionAction } from "@/app/actions/auth";
import { Card, PageHeader } from "@/components/ui";
import { MfaSetup } from "./MfaSetup";

interface MfaStatus {
  enabled: boolean;
  required: boolean;
}

interface Session {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  current: boolean;
}

function describeDevice(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";
  if (/android/i.test(userAgent)) return "Android";
  if (/iphone|ipad/i.test(userAgent)) return "iPhone or iPad";
  if (/windows/i.test(userAgent)) return "Windows";
  if (/mac os/i.test(userAgent)) return "Mac";
  return "Browser";
}

export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { welcome } = await searchParams;
  const [mfa, sessions] = await Promise.all([
    apiFetch<MfaStatus>("/auth/mfa"),
    apiFetch<Session[]>("/auth/sessions"),
  ]);

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <Link href="/businesses" className="text-sm text-ink-500 hover:text-ink-900">
        ← Your businesses
      </Link>
      <PageHeader
        title="Security"
        description="Two-step verification and where you are signed in."
      />

      {welcome && !mfa.enabled ? (
        <Card className="border-brand-500 bg-brand-50 text-sm">
          Welcome to {BRAND.name}. Set up two-step verification below to open your business
          dashboard.
        </Card>
      ) : null}

      <Card>
        <h2 className="mb-3 font-semibold">Two-step verification</h2>
        {mfa.enabled ? (
          <p className="text-sm text-mint-700">
            On. You will be asked for a code from your app each time you sign in.
          </p>
        ) : (
          <MfaSetup />
        )}
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="font-semibold">Where you are signed in</h2>
          {sessions.length > 1 ? (
            <form action={revokeOtherSessionsAction}>
              <button className="text-sm text-red-600 hover:underline">
                Sign out everywhere else
              </button>
            </form>
          ) : null}
        </div>
        <ul className="divide-y divide-ink-100">
          {sessions.map((session) => (
            <li key={session.id} className="flex items-center justify-between gap-4 py-3 text-sm">
              <div>
                <p className="font-medium">
                  {describeDevice(session.userAgent)}
                  {session.current ? (
                    <span className="ml-2 text-xs font-normal text-mint-700">This device</span>
                  ) : null}
                </p>
                <p className="text-ink-500">
                  Signed in{" "}
                  {new Date(session.createdAt).toLocaleString("en-PK", {
                    timeZone: "Asia/Karachi",
                  })}
                  {session.ip ? ` · ${session.ip}` : ""}
                </p>
              </div>
              {session.current ? null : (
                <form action={revokeSessionAction.bind(null, session.id)}>
                  <button className="text-red-600 hover:underline">Sign out</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </main>
  );
}
