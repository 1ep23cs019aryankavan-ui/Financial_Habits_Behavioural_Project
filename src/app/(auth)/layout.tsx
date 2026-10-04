import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Disclaimer } from "@/components/disclaimer";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10">
      <div className="text-center">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
            S
          </div>
          <span className="text-xl font-semibold tracking-tight">Steady</span>
        </Link>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Slow down impulsive financial decisions with cooling-off periods and a
          decision journal.
        </p>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-lg">Welcome</CardTitle>
          <CardDescription>
            Your decisions and reflections stay private to your account.
          </CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>

      <div className="w-full max-w-sm">
        <Disclaimer />
      </div>
    </div>
  );
}
