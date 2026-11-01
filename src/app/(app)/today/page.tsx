import { SignOutButton } from "./sign-out-button";

// TODO(P0 next-intl, part c): move display strings to messages/*.json.
export default function TodayPage() {
  return (
    <main className="flex flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Hôm nay</h1>
      <p className="text-muted-foreground">Chưa có việc nào.</p>
      <div>
        <SignOutButton />
      </div>
    </main>
  );
}
