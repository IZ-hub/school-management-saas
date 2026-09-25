# school-management-saas

A mobile-first school management dashboard: students, teachers, classes, attendance and fees.

## Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS v4
- React Router

## Getting started

```bash
npm install
npm run dev
```

Other scripts:

```bash
npm run lint       # oxlint
npm run typecheck  # tsc
npm run build      # production build
npm run preview    # serve the production build
```

## Responsive behaviour

The UI is designed mobile-first and verified from 320px upwards.

- Navigation is an off-canvas drawer below `lg` and a fixed sidebar from `lg` up.
- Data tables render as stacked cards below `md` and as real tables from `md` up.
- Stat grids, forms and filters collapse to a single column on small screens.
