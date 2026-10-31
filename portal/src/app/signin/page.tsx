import { Card } from "@/components/ui";
import { EmailSignIn } from "@/components/EmailSignIn";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-5">
      <div className="text-center">
        <p className="text-2xl font-bold text-brand-600">TapTapSell</p>
        <p className="mt-1 text-slate-600">Sign in or create your account</p>
      </div>
      <Card>
        <EmailSignIn next={next ?? "/cards"} />
      </Card>
    </main>
  );
}
