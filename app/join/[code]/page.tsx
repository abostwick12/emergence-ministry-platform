import { StudentJoinForm } from "@/components/student/student-join-form";
import { getPublicStudentInvite } from "@/lib/student/groups";

type JoinPageProps = {
  params: {
    code: string;
  };
};

export default async function StudentJoinPage({ params }: JoinPageProps) {
  const invite = await getPublicStudentInvite(params.code);

  return (
    <main className="student-join-shell">
      <section className="student-join-card">
        {invite.ok ? (
          <>
            <div className="student-join-hero">
              <p className="eyebrow">Lead Emergence</p>
              <h1>Join {invite.groupName}</h1>
              <p>Set up your student access, then start with one honest question and a guided Scripture path while your leader prepares the group conversation.</p>
            </div>
            <div className="student-join-path" aria-label="What happens after joining">
              <div>
                <span>1</span>
                <strong>Ask honestly</strong>
                <p>Bring the question you actually want your group to wrestle with.</p>
              </div>
              <div>
                <span>2</span>
                <strong>Wrestle while you wait</strong>
                <p>Get deeper questions, journal prompts, prayer prompts, and a reading path.</p>
              </div>
              <div>
                <span>3</span>
                <strong>Discuss with care</strong>
                <p>Your leader reviews before anything becomes a group conversation.</p>
              </div>
            </div>
            <StudentJoinForm code={invite.code} expiresAt={invite.expiresAt} groupName={invite.groupName} ministryName={invite.ministryName} />
          </>
        ) : (
          <div className="student-join-hero">
            <p className="eyebrow">Lead Emergence</p>
            <h1>This link is not available.</h1>
            <p>Ask your leader for a fresh student invite link so you can join the right group.</p>
          </div>
        )}
      </section>
    </main>
  );
}
