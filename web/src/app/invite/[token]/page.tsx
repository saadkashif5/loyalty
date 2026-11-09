import Link from "next/link";
import { BRAND } from "@taptapsell/brand";
import { AuthShell } from "@taptapsell/brand/auth-shell";
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
    <AuthShell
      area="Business"
      title="You are invited"
      headline="Bring your regulars back."
      blurb="Run your stamp cards, stampers and rewards from one place."
    >
      <Card>{invitation ? <InviteBody token={token} invitation={invitation} /> : <Invalid />}</Card>
    </AuthShell>
  );
}

function Invalid() {
  return (
    <div className="space-y-2 text-sm text-slate-600">
      <p className="font-medium text-slate-900">This invitation link does not work</p>
      <p>
        It may have expired, been replaced by a newer link, or already been used. Ask the{" "}
        {BRAND.name}
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
        You have been invited to manage this business on {BRAND.name} as its owner (
        {invitation.email}
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
          You already have a {BRAND.name} account with this email. Sign in to accept.
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
