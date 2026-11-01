import Link from "next/link";
import { Suspense } from "react";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { LoginForm } from "@/components/auth/login-form";

// Minimal page; styled in P0 part c. TODO: display strings → messages/*.json.
export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Đăng nhập</h1>
      <LoginForm />
      <Suspense fallback={null}>
        <GoogleSignIn />
      </Suspense>
      <p className="text-sm text-muted-foreground">
        Chưa có tài khoản?{" "}
        <Link href="/register" className="underline">
          Đăng ký
        </Link>
      </p>
    </main>
  );
}
