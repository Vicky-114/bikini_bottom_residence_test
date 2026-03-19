# GitHub Pages React/Vite Routing Fix

## Symptom

On GitHub Pages, the site loads but the React UI is mostly blank or appears to show only a background image. There may be no visible browser console errors.

## Root Cause

This happened in a Vite + React Router app deployed to a GitHub Pages project site.

The app used:

- `base: "/<repo-name>/"` in `vite.config.ts`
- `HashRouter basename={import.meta.env.BASE_URL}` in `src/App.tsx`

That combination caused the deployed app to fail to match the initial route correctly on GitHub Pages.

## Correct Fix

Keep the Vite asset base, but remove the React Router basename from `HashRouter`.

### `vite.config.ts`

```ts
export default defineConfig({
  base: "/your-repo-name/",
});
```

### `src/App.tsx`

Use:

```tsx
<HashRouter>
  <Routes>
    <Route path="/" element={<Index />} />
    <Route path="world" element={<World />} />
  </Routes>
</HashRouter>
```

Do not use:

```tsx
<HashRouter basename={import.meta.env.BASE_URL}>
```

## Why

- Vite `base` is needed so built asset URLs point to the correct GitHub Pages project subpath.
- `HashRouter` already avoids GitHub Pages refresh and direct-link 404 problems.
- Adding a `basename` on top of `HashRouter` can prevent route matching on the deployed site.

## Working Rule Of Thumb

For a GitHub Pages project site:

- Keep `base: "/repo-name/"` in Vite.
- Use `HashRouter` without `basename`.
- Avoid hardcoded root links like `href="/"`; use router links instead.

## Optional Related Checks

If the site still looks broken after fixing routing:

- Check for asset paths like `url('/src/assets/...')` in CSS. Those usually break in production.
- Check whether the app depends on environment variables that are missing in the GitHub Pages build.
- Check for hardcoded `/` paths in links, assets, or fetch calls.
