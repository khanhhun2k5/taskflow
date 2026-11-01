"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { signInSchema, type SignInInput } from "@/features/auth/schemas";
import { authClient } from "@/lib/auth-client";
import { FormField } from "./form-field";

export function LoginForm() {
  const t = useTranslations("Auth");
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
        error.status === 429 ? t("errors.tooManyAttempts") : t("errors.invalidCredentials"),
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
        label={t("fields.email")}
        type="email"
        autoComplete="email"
        error={errors.email ? t("errors.emailInvalid") : undefined}
        {...register("email")}
      />
      <FormField
        id="password"
        label={t("fields.password")}
        type="password"
        autoComplete="current-password"
        error={errors.password ? t("errors.passwordRequired") : undefined}
        {...register("password")}
      />
      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}
      <Button type="submit" disabled={isSubmitting} className="h-11 md:h-9">
        {t("login.submit")}
      </Button>
    </form>
  );
}
