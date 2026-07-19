import { PlatformRegistrationForm } from "@/components/platform-registration-form";
import { getPublicPlatformRegistrationInvite } from "@/lib/platform/registration";

type RegisterPageProps = {
  params: {
    code: string;
  };
};

export default async function PlatformRegisterPage({ params }: RegisterPageProps) {
  const invite = await getPublicPlatformRegistrationInvite(params.code);

  return (
    <main className="student-join-shell">
      <section className="student-join-card">
        {invite.ok ? (
          <>
            <div className="student-join-hero">
              <p className="eyebrow">Lead Emergence</p>
              <h1>Create your account</h1>
              <p>Use this registration link to set up your own password and open the platform with the access your administrator prepared.</p>
            </div>
            <div className="student-join-path" aria-label="What happens after registration">
              <div>
                <span>1</span>
                <strong>Create access</strong>
                <p>Use your name, email, and a password only you know.</p>
              </div>
              <div>
                <span>2</span>
                <strong>Open the platform</strong>
                <p>Your account lands in the right role for this link.</p>
              </div>
              <div>
                <span>3</span>
                <strong>Work safely</strong>
                <p>An administrator can adjust page access later from Settings.</p>
              </div>
            </div>
            <PlatformRegistrationForm
              code={invite.code}
              expiresAt={invite.expiresAt}
              label={invite.label}
              ministryName={invite.ministryName}
              role={invite.role}
            />
          </>
        ) : (
          <div className="student-join-hero">
            <p className="eyebrow">Lead Emergence</p>
            <h1>This link is not available.</h1>
            <p>Ask an administrator for a fresh registration link.</p>
          </div>
        )}
      </section>
    </main>
  );
}
