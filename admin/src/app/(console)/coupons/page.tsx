import { PLATFORM_PERMISSIONS } from "@taptapsell/constants";
import { apiFetch } from "@/lib/api";
import { can, requirePermission } from "@/lib/me";
import { couponLabel } from "@/lib/billing";
import { setCouponActiveAction } from "@/app/actions";
import {
  Card,
  EmptyState,
  PageHeader,
  SecondaryButton,
  StatusBadge,
  Table,
  Td,
  formatDate,
} from "@/components/ui";
import { CouponForm } from "./CouponForm";

interface Coupon {
  _id: string;
  code: string;
  description?: string;
  percentOff: number | null;
  amountOffPkr: number | null;
  invoices: number;
  planCodes: string[];
  maxRedemptions: number | null;
  redemptions: number;
  expiresAt: string | null;
  active: boolean;
}

export default async function CouponsPage() {
  const me = await requirePermission(PLATFORM_PERMISSIONS.BILLING_VIEW);
  const canManage = can(me.platformRole, PLATFORM_PERMISSIONS.BILLING_MANAGE);
  const coupons = await apiFetch<Coupon[]>("/admin/coupons");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Coupons"
        description="Promotion codes. Owners enter them on their Billing page, or apply one from a business's page. They come off the plan part of invoices, never hardware."
      />
      {canManage ? (
        <Card>
          <CouponForm />
        </Card>
      ) : null}
      {coupons.length === 0 ? (
        <EmptyState>No coupons yet.</EmptyState>
      ) : (
        <Table head={["Code", "Gives", "Plans", "Used", "Expires", "Status", ""]}>
          {coupons.map((c) => (
            <tr key={c._id}>
              <Td>
                <span className="font-mono font-medium">{c.code}</span>
                {c.description ? (
                  <span className="block text-xs text-ink-500">{c.description}</span>
                ) : null}
              </Td>
              <Td>
                {couponLabel(c)} · {c.invoices} invoice{c.invoices === 1 ? "" : "s"}
              </Td>
              <Td>{c.planCodes.length ? c.planCodes.join(", ") : "Any"}</Td>
              <Td>
                {c.redemptions}
                {c.maxRedemptions ? ` of ${c.maxRedemptions}` : ""}
              </Td>
              <Td>{c.expiresAt ? formatDate(c.expiresAt) : "Never"}</Td>
              <Td>
                <StatusBadge status={c.active ? "ACTIVE" : "DISABLED"} />
              </Td>
              <Td>
                {canManage ? (
                  <form action={setCouponActiveAction.bind(null, c._id, !c.active)}>
                    <SecondaryButton type="submit">
                      {c.active ? "Switch off" : "Switch on"}
                    </SecondaryButton>
                  </form>
                ) : null}
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
