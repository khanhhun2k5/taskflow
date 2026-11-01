import Link from "next/link";
import { Suspense } from "react";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { RegisterForm } from "@/components/auth/register-form";

// Minimal page; styled in P0 part c. TODO: display strings → messages/*.json.
export default function RegisterPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Đăng ký</h1>
      <RegisterForm />
      <Suspense fallback={null}>
        <GoogleSignIn />
      </Suspense>
      <p className="text-sm text-muted-foreground">
        Đã có tài khoản?{" "}
        <Link href="/login" className="underline">
          Đăng nhập
        </Link>
      </p>
    </main>
  );
}
