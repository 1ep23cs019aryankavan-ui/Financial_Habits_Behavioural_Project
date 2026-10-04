import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AppNav, MobileHeader } from "@/components/app-nav";
import { LogoutButton } from "@/components/logout-button";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <AppNav />

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader name={user.name} />

        {/* Desktop top bar */}
        <header className="sticky top-0 z-30 hidden h-16 items-center justify-between border-b border-border bg-card/95 px-6 backdrop-blur lg:flex">
          <p className="text-sm text-muted-foreground">
            Signed in as{" "}
            <span className="font-medium text-foreground">{user.name}</span>
          </p>
          <LogoutButton />
        </header>

        {/* pb-20 clears the mobile bottom nav */}
        <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-8 lg:pb-10">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
