import { login } from "./actions";
import { Button, Card, Input } from "@/components/ui";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main
      id="main"
      className="grid min-h-screen place-items-center bg-slate-100 p-4"
    >
      <Card className="w-full max-w-md">
        <p className="text-sm font-semibold text-teal-700">
          CareBridge Jamaica
        </p>
        <h1 className="mt-2 text-2xl font-bold">Secure staff sign in</h1>
        <p className="mt-2 text-sm text-slate-600">
          Authorized medical-assistance review personnel only.
        </p>
        {error ? (
          <div
            role="alert"
            className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800"
          >
            {error}
          </div>
        ) : null}
        <form action={login} className="mt-6 space-y-4">
          <label className="block text-sm font-medium">
            Email
            <Input
              name="email"
              type="email"
              autoComplete="username"
              required
              className="mt-1"
            />
          </label>
          <label className="block text-sm font-medium">
            Password
            <Input
              name="password"
              type="password"
              autoComplete="current-password"
              minLength={10}
              required
              className="mt-1"
            />
          </label>
          <Button className="w-full" type="submit">
            Sign in
          </Button>
        </form>
      </Card>
    </main>
  );
}
