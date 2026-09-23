import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { homeFor } from "@/lib/session";
import LoginForm from "@/components/LoginForm";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect(homeFor(session.user.roles));

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-1 text-2xl font-semibold text-emerald-400">Media Analysis</h1>
      <p className="mb-6 text-sm text-slate-400">
        Sign in with the credentials provided by your administrator.
      </p>
      <LoginForm />
    </div>
  );
}