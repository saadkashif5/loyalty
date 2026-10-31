import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/session";
import { logoutAction } from "@/app/actions/auth";
import { Button, Card } from "@/components/ui";
import { AcceptInviteForm } from "./AcceptInviteForm";

interface Invitation {
  business: { name: string; category: string };
  name: string;
  email: string;
  expiresAt: string;
  accountExists: boolean;
}

async function signedInEmail(): Promise<string | null> {
  if (!(await getAccessToken())) return null;
  try {
    const me = await apiFetch<{ email: string }>("/users/me");
    return me.email;
  } catch {
    return null;
  }
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let invitation: Invitation | null = null;
  try {
    invitation = await apiFetch<Invitation>(`/invitations/${encodeURIComponent(token)}`, {
      anonymous: true,
    });
  } catch {
    invitation = null;
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <h1 className="mb-6 text-center text-2xl font-semibold">TapTapSell Loyalty</h1>
        <Card>
          {invitation ? <InviteBody token={token} invitation={invitation} /> : <Invalid />}
        </Card>
      </div>
    </main>
  );
}

function Invalid() {
  return (
    <div className="space-y-2 text-sm text-slate-600">
      <p className="font-medium text-slate-900">This invitation link does not work</p>
      <p>
        It may have expired, been replaced by a newer link, or already been used. Ask the TapTapSell
        team to send you a new one.
      </p>
    </div>
  );
}

async function InviteBody({ token, invitation }: { token: string; invitation: Invitation }) {
  const email = await signedInEmail();
  const invitePath = `/invite/${token}`;

  const intro = (
    <div className="mb-5 space-y-1">
      <p className="text-lg font-semibold">{invitation.business.name}</p>
      <p className="text-sm text-slate-600">
        You have been invited to manage this business on TapTapSell as its owner ({invitation.email}
        ).
      </p>
    </div>
  );

  // Signed in as the invited account: one click.
  if (email === invitation.email) {
    return (
      <>
        {intro}
        <AcceptInviteForm token={token} newAccount={false} defaultName={invitation.name} />
      </>
    );
  }

  // Signed in as someone else: they must switch accounts first.
  if (email) {
    return (
      <>
        {intro}
        <p className="mb-4 text-sm text-slate-600">
          You are signed in as {email}. Sign out, then open this link again.
        </p>
        <form action={logoutAction}>
          <Button type="submit" className="w-full">
            Sign out
          </Button>
        </form>
      </>
    );
  }

  // An account already exists for the invited email: prove it is theirs.
  if (invitation.accountExists) {
    return (
      <>
        {intro}
        <p className="mb-4 text-sm text-slate-600">
          You already have a TapTapSell account with this email. Sign in to accept.
        </p>
        <Link
          href={`/login?next=${encodeURIComponent(invitePath)}`}
          className="block rounded-md bg-brand-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-brand-700"
        >
          Sign in to accept
        </Link>
      </>
    );
  }

  return (
    <>
      {intro}
      <AcceptInviteForm token={token} newAccount defaultName={invitation.name} />
    </>
  );
}
