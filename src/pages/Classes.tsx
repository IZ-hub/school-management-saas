import { PageHeader, PrimaryButton } from '../components/PageHeader'
import { classes } from '../data/mock'

export function Classes() {
  return (
    <>
      <PageHeader title="Classes" description="Timetable and room allocation" action={<PrimaryButton>Create class</PrimaryButton>} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
        {classes.map((schoolClass) => (
          <article key={schoolClass.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <header className="flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">{schoolClass.name}</h2>
              <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{schoolClass.students} students</span>
            </header>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Form teacher</dt>
                <dd className="text-right font-medium text-slate-800">{schoolClass.teacher}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Room</dt>
                <dd className="text-right text-slate-800">{schoolClass.room}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Schedule</dt>
                <dd className="text-right text-slate-800">{schoolClass.schedule}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </>
  )
}
