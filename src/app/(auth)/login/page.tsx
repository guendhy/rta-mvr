"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { useSession } from "@/components/providers/session-provider";
import { Field, Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Flag } from "@/components/ui/layout-bits";
import { appConfig } from "@/lib/config";
import { friendlyError } from "@/lib/errors";
import { DEFAULT_PERMISSIONS, homeRouteFor } from "@/lib/permissions";
import { authService } from "@/services/auth.service";
import { SEED_USERS } from "@/data/mock/users";
import { ROLE_LABELS } from "@/lib/constants";

const schema = z.object({
  email: z.string().trim().min(1, "Enter your email").email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});
type FormValues = z.infer<typeof schema>;

/** Only the eight role demo accounts are offered as quick-fill buttons. */
const DEMO_ACCOUNTS = SEED_USERS.slice(0, 8);

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { login, session, ready } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });

  useEffect(() => {
    if (ready && session) router.replace(params.get("next") || homeRouteFor(DEFAULT_PERMISSIONS, session.activeRole));
  }, [ready, session, router, params]);

  const onSubmit = async (v: FormValues) => {
    setError(null);
    try {
      const s = await login(v.email, v.password);
      toast.success(`Welcome, ${s.user.firstName}`);
      const next = params.get("next");
      router.replace(next && next !== "/" ? next : homeRouteFor(DEFAULT_PERMISSIONS, s.activeRole));
    } catch (e) {
      setError(friendlyError(e));
    }
  };

  return (
    <div className="flex min-h-screen flex-wrap bg-white">
      <section className="relative flex min-h-[340px] flex-[1_1_480px] flex-col justify-between overflow-hidden bg-[#0b0b0f] p-8 text-white sm:p-12">
        <div className="absolute -right-[180px] -bottom-[180px] h-[560px] w-[560px] rounded-full border-[56px] border-[#16161c]" aria-hidden="true" />
        <p className="relative m-0 text-[12px] font-bold tracking-[.14em] text-[#ffd21a]">GOVERNMENT OF PAPUA NEW GUINEA</p>
        <div className="relative my-8 flex max-w-[520px] flex-col gap-6">
          <Image src="/brand/rta-logo.png" alt="Road Traffic Authority Papua New Guinea seal" width={168} height={168} priority className="h-28 w-28 sm:h-[168px] sm:w-[168px]" />
          <div>
            <p className="m-0 text-[15px] font-extrabold tracking-[.12em]">ROAD TRAFFIC AUTHORITY</p>
            <p className="m-0 mt-1 text-[15px] text-[#c4c7d0]">Papua New Guinea</p>
          </div>
          <h1 className="m-0 text-[32px] leading-[1.08] font-extrabold tracking-[-.025em] sm:text-[44px]">Motorcycle Registration &amp; Payment System</h1>
          <div className="max-w-[240px] overflow-hidden rounded-[3px]"><Flag height={6} /></div>
        </div>
        <div className="relative flex flex-col gap-1 text-[12.5px] text-[#9ea2ae]">
          <span>© Papua New Guinea Road Traffic Authority</span>
          <span className="font-semibold text-[#ffd21a]">Demo Prototype</span>
        </div>
      </section>

      <section className="flex flex-[1_1_480px] items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-[420px] flex-col gap-7">
          <div className="flex items-center gap-2.5 rounded-lg border border-[#f2de85] bg-[#fff8d6] px-3.5 py-2.5">
            <Lock size={18} className="text-[#6e5200]" aria-hidden="true" />
            <p className="m-0 text-[13px] font-bold text-[#4d3900]">Authorized RTA Personnel Only</p>
          </div>

          <form className="flex flex-col gap-5" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div>
              <h2 className="h1">Sign in</h2>
              <p className="mut m-0 mt-1.5 text-[14px]">Use your RTA-issued account. All activity is logged.</p>
            </div>
            {error && <div className="alert alert-bad" role="alert"><p className="alert-title">{error}</p></div>}
            <Field label="Email" required htmlFor="email" error={errors.email?.message}>
              <Input id="email" type="email" autoComplete="username" autoFocus invalid={!!errors.email} {...register("email")} />
            </Field>
            <div>
              <div className="flex items-baseline justify-between">
                <label className="lbl" htmlFor="password">Password<span className="req" aria-hidden="true">*</span></label>
                <button type="button" className="text-[13px] font-semibold text-[#1515e8] hover:underline" onClick={() => { setForgot(true); setResetSent(false); }}>Forgot Password?</button>
              </div>
              <Input id="password" type="password" autoComplete="current-password" invalid={!!errors.password} {...register("password")} />
              {errors.password && <p className="err">{errors.password.message}</p>}
            </div>
            <button type="submit" className="btn btn-p btn-lg w-full" disabled={isSubmitting}>
              {isSubmitting && <span className="spin" aria-hidden="true" />}
              {isSubmitting ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <details className="rounded-lg border border-[#e1e4ea] bg-[#f7f8fa] p-3.5" open>
            <summary className="cursor-pointer text-[13px] font-semibold">Demo accounts (password: password123)</summary>
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              {DEMO_ACCOUNTS.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="rounded-md border border-[#c9ced8] bg-white px-2.5 py-2 text-left text-[12.5px] hover:border-[#1515e8] hover:bg-[#f5f5ff]"
                  onClick={() => {
                    setValue("email", u.email, { shouldValidate: true });
                    setValue("password", "password123", { shouldValidate: true });
                  }}
                >
                  <span className="block font-semibold">{ROLE_LABELS[u.role]}</span>
                  <span className="mut block truncate text-[11.5px]">{u.email}</span>
                </button>
              ))}
            </div>
          </details>

          <div className="flex flex-wrap justify-between gap-3 border-t border-[#e1e4ea] pt-4 text-[12.5px] text-[#5a606c]">
            <span className="mono">Version {appConfig.version}</span>
            <span>© Papua New Guinea Road Traffic Authority · Demo Prototype</span>
          </div>
        </div>
      </section>

      <Modal
        open={forgot}
        onClose={() => setForgot(false)}
        title="Reset your password"
        description="Enter your RTA email. In this demo no email is sent."
        size="sm"
        footer={resetSent ? <button type="button" className="btn btn-p" onClick={() => setForgot(false)}>Done</button> : (
          <>
            <button type="button" className="btn btn-s" onClick={() => setForgot(false)}>Cancel</button>
            <button type="button" className="btn btn-p" onClick={async () => {
              try {
                await authService.requestPasswordReset(resetEmail);
                setResetSent(true);
              } catch (e) {
                toast.error(friendlyError(e));
              }
            }}>Send reset link</button>
          </>
        )}
      >
        {resetSent ? (
          <div className="alert alert-ok"><div><p className="alert-title">Reset request recorded</p><p>If {resetEmail} belongs to an RTA account, an IT administrator will contact you. (Simulated — no email service in Phase 1.)</p></div></div>
        ) : (
          <Field label="Email" required htmlFor="reset-email">
            <Input id="reset-email" type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} />
          </Field>
        )}
      </Modal>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0b0b0f]" />}>
      <LoginForm />
    </Suspense>
  );
}
