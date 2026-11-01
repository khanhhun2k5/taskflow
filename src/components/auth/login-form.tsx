"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { signInSchema, type SignInInput } from "@/features/auth/schemas";
import { authClient } from "@/lib/auth-client";
import { FormField } from "./form-field";

// TODO(P0 part c): move display strings to messages/*.json (next-intl).
export function LoginForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({ resolver: zodResolver(signInSchema) });

  async function onSubmit(values: SignInInput) {
    setFormError(null);
    const { error } = await authClient.signIn.email(values);
    if (error) {
      setFormError(
        error.status === 429
          ? "Bạn thử quá nhiều lần. Vui lòng đợi một phút."
          : "Email hoặc mật khẩu không đúng.",
      );
      return;
    }
    router.replace("/today");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <FormField
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        error={errors.email ? "Email không hợp lệ." : undefined}
        {...register("email")}
      />
      <FormField
        id="password"
        label="Mật khẩu"
        type="password"
        autoComplete="current-password"
        error={errors.password ? "Nhập mật khẩu." : undefined}
        {...register("password")}
      />
      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}
      <Button type="submit" disabled={isSubmitting}>
        Đăng nhập
      </Button>
    </form>
  );
}
