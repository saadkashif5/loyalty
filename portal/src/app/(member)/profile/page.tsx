import { apiFetch } from "@/lib/api";
import { signOutAction } from "@/app/actions";
import { Card } from "@/components/ui";

export default async function ProfilePage() {
  const me = await apiFetch<{ name: string; email: string }>("/users/me");

  return (
    <>
      <h1 className="text-lg font-semibold">Me</h1>
      <Card className="space-y-1">
        <p className="font-semibold">{me.name}</p>
        <p className="text-sm text-slate-500">{me.email}</p>
      </Card>
      <form action={signOutAction}>
        <button className="w-full rounded-xl border border-slate-300 bg-white py-3 font-medium text-slate-700">
          Sign out
        </button>
      </form>
    </>
  );
}
