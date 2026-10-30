import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ResourceUploadForm from "./resource-upload-form";

export default async function SubjectPage({ params }: { params: Promise<{ subjectId: string }> }) {
  const { subjectId } = await params;
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    include: {
      units: { orderBy: { number: "asc" } },
      resources: { include: { unit: true }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!subject) notFound();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:px-8">
      <Link href="/" className="text-sm text-blue-700 hover:underline">← Back to home</Link>
      <header className="mb-8 mt-5">
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">Subject resources</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{subject.name}</h1>
        {subject.code && <p className="mt-1 text-zinc-600">{subject.code}</p>}
      </header>

      <ResourceUploadForm subjectId={subject.id} units={subject.units.map((unit) => ({
        id: unit.id, name: unit.name, number: unit.number,
      }))} />

      <section className="mt-10" aria-labelledby="resources-heading">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="resources-heading" className="text-xl font-semibold">Uploaded resources</h2>
          <span className="text-sm text-zinc-500">{subject.resources.length} total</span>
        </div>
        {subject.resources.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-zinc-600">
            No resources yet. Upload the first resource for this subject.
          </p>
        ) : (
          <ul className="grid gap-3">
            {subject.resources.map((resource) => (
              <li key={resource.id} className="flex flex-col justify-between gap-3 rounded-xl border border-zinc-200 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0">
                  <h3 className="font-medium">{resource.title}</h3>
                  <p className="mt-1 text-sm text-zinc-500">
                    {resource.type.replaceAll("_", " ")}
                    {resource.unit ? ` · Unit ${resource.unit.number}: ${resource.unit.name}` : ""}
                    {" · "}{new Date(resource.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <a href={resource.fileUrl} target="_blank" rel="noreferrer"
                  className="inline-flex shrink-0 items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700">
                  Open resource
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
