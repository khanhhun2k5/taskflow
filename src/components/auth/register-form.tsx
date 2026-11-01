"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { PASSWORD_MIN_LENGTH, signUpSchema, type SignUpInput } from "@/features/auth/schemas";
import { NAME_MAX_LENGTH } from "@/features/users/schemas";
import { authClient } from "@/lib/auth-client";
import { FormField } from "./form-field";

export function RegisterForm() {
  const t = useTranslations("Auth");
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
      const taken =
        error.code === "USER_ALREADY_EXISTS" ||
        error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL";
      if (taken) setFormError(t("errors.emailTaken"));
      else if (error.status === 429) setFormError(t("errors.tooManyAttempts"));
      else setFormError(t("errors.registerFailed"));
      return;
    }
    router.replace("/today"); // US-01: straight to Today
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <FormField
        id="name"
        label={t("fields.name")}
        autoComplete="name"
        error={errors.name ? t("errors.nameInvalid", { max: NAME_MAX_LENGTH }) : undefined}
        {...register("name")}
      />
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
        autoComplete="new-password"
        error={
          errors.password ? t("errors.passwordTooShort", { min: PASSWORD_MIN_LENGTH }) : undefined
        }
        {...register("password")}
      />
      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}
      <Button type="submit" disabled={isSubmitting} className="h-11 md:h-9">
        {t("register.submit")}
      </Button>
    </form>
  );
}
