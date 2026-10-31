import { logoutAction } from "@/app/actions";
import { Card, SecondaryButton } from "@/components/ui";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const { denied } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">TapTapSell Admin</h1>
          <p className="text-sm text-slate-500">Platform console for the TapTapSell team</p>
        </div>

        {denied ? (
          <Card className="space-y-3 text-sm">
            <p>This account is not on the TapTapSell team.</p>
            <form action={logoutAction}>
              <SecondaryButton type="submit" className="w-full">
                Sign out
              </SecondaryButton>
            </form>
          </Card>
        ) : (
          <LoginForm />
        )}
      </div>
    </main>
  );
}
