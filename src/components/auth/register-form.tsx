"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { PASSWORD_MIN_LENGTH, signUpSchema, type SignUpInput } from "@/features/auth/schemas";
import { authClient } from "@/lib/auth-client";
import { FormField } from "./form-field";

// TODO(P0 part c): move display strings to messages/*.json (next-intl).
export function RegisterForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({ resolver: zodResolver(signUpSchema) });

  async function onSubmit(values: SignUpInput) {
    setFormError(null);
    const { error } = await authClient.signUp.email(values);
    if (error) {
      // US-01: duplicate email must show a clear message.
      setFormError(
        error.code === "USER_ALREADY_EXISTS" ||
          error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
          ? "Email này đã được đăng ký."
          : "Không đăng ký được. Vui lòng thử lại.",
      );
      return;
    }
    router.replace("/today"); // US-01: straight to Today
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <FormField
        id="name"
        label="Tên"
        autoComplete="name"
        error={errors.name ? "Nhập tên (tối đa 100 ký tự)." : undefined}
        {...register("name")}
      />
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
        autoComplete="new-password"
        error={errors.password ? `Mật khẩu cần ít nhất ${PASSWORD_MIN_LENGTH} ký tự.` : undefined}
        {...register("password")}
      />
      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}
      <Button type="submit" disabled={isSubmitting}>
        Đăng ký
      </Button>
    </form>
  );
}
