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
            <div>
              <p className="eyebrow">Lead Emergence</p>
              <h1>Join {invite.groupName}</h1>
              <p>Set up your student access so you can ask questions, keep reading, and follow what your group is discussing.</p>
            </div>
            <StudentJoinForm code={invite.code} expiresAt={invite.expiresAt} groupName={invite.groupName} ministryName={invite.ministryName} />
          </>
        ) : (
          <div>
            <p className="eyebrow">Student invite</p>
            <h1>This link is not available.</h1>
            <p>Ask your leader for a fresh student invite link.</p>
          </div>
        )}
      </section>
    </main>
  );
}
