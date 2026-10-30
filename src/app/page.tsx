import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const subjects = await prisma.subject.findMany({
    include: { semester: { include: { course: true } }, _count: { select: { resources: true } } },
    orderBy: [{ name: "asc" }],
  });

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-12 sm:px-8">
      <header className="mb-10">
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">QuantX Learning</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">Study resources, organized by subject.</h1>
        <p className="mt-3 max-w-2xl text-zinc-600">
          Open a subject to browse existing material or upload notes, presentations, documents, and images.
        </p>
      </header>

      <section aria-labelledby="subjects-heading">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="subjects-heading" className="text-xl font-semibold">Subjects</h2>
          <span className="text-sm text-zinc-500">{subjects.length} available</span>
        </div>
        {subjects.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-zinc-600">
            No subjects have been added yet. Create a course, semester, and subject in the database to get started.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((subject) => (
              <li key={subject.id}>
                <Link href={`/subjects/${subject.id}`}
                  className="block h-full rounded-xl border border-zinc-200 p-5 transition hover:border-blue-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    {subject.semester.course.name} · Semester {subject.semester.number}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold">{subject.name}</h3>
                  {subject.code && <p className="mt-1 text-sm text-zinc-500">{subject.code}</p>}
                  <p className="mt-4 text-sm text-blue-700">
                    {subject._count.resources} {subject._count.resources === 1 ? "resource" : "resources"} · View subject →
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
