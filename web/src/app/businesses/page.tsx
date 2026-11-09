import Link from "next/link";
import { redirect } from "next/navigation";
import { BRAND } from "@taptapsell/brand";
import { Logo } from "@taptapsell/brand/logo";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { acceptStaffInviteAction, declineStaffInviteAction } from "@/app/actions/business";
import {
  Button,
  Card,
  EmptyState,
  LinkButton,
  PageHeader,
  SecondaryButton,
  StatusBadge,
} from "@/components/ui";

interface Membership {
  role: string;
  supportView?: { expiresAt: string };
  business: {
    _id: string;
    name: string;
    category: string;
    status: string;
  } | null;
}

interface PendingInvitation {
  business: { _id: string; name: string };
  role: string;
}

export default async function BusinessesPage() {
  let memberships: Membership[];
  let invitations: PendingInvitation[];

  try {
    [memberships, invitations] = await Promise.all([
      apiFetch<Membership[]>("/businesses"),
      apiFetch<PendingInvitation[]>("/businesses/invitations"),
    ]);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) redirect("/login");
    throw error;
  }

  const valid = memberships.filter((m) => m.business);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-8">
        <Logo suffix="Business" />
      </div>
      <PageHeader
        title="Your businesses"
        description="Pick a business to manage its loyalty programs, stampers and rewards."
        action={<LinkButton href="/account/security">Security</LinkButton>}
      />

      {invitations.length > 0 ? (
        <section className="mb-6 space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Invitations</h2>
          {invitations.map((inv) => (
            <Card
              key={inv.business._id}
              className="flex flex-wrap items-center justify-between gap-4"
            >
              <p className="text-sm">
                <span className="font-medium">{inv.business.name}</span> invited you to join as{" "}
                {inv.role.toLowerCase()}.
              </p>
              <div className="flex gap-2">
                <form action={acceptStaffInviteAction.bind(null, inv.business._id)}>
                  <Button type="submit">Accept</Button>
                </form>
                <form action={declineStaffInviteAction.bind(null, inv.business._id)}>
                  <SecondaryButton type="submit">Decline</SecondaryButton>
                </form>
              </div>
            </Card>
          ))}
        </section>
      ) : null}

      {valid.length === 0 && invitations.length === 0 ? (
        <EmptyState>
          You do not manage a business yet. Businesses join {BRAND.name} by invitation: open the
          link in the invitation you received, or ask the business owner to add you as staff.
        </EmptyState>
      ) : valid.length === 0 ? null : (
        <ul className="space-y-3">
          {valid.map((m) => (
            <li key={m.business!._id}>
              <Link href={`/b/${m.business!._id}`} className="block">
                <Card className="transition hover:border-brand-500">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium">{m.business!.name}</p>
                      <p className="text-sm text-slate-500">
                        {m.business!.category} ·{" "}
                        {m.supportView ? "support view (read-only)" : `your role: ${m.role}`}
                      </p>
                    </div>
                    <StatusBadge status={m.business!.status} />
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
