# portfolio-inner-site provenance

The OS chrome in this directory is derived from Henry Heffernan's
[`portfolio-inner-site`](https://github.com/henryjeff/portfolio-inner-site) at
commit `23cf84acd5c76d2c719e1d04c3d976dc4b0b49f8`.

Reused source:

- `components/os/{Button,DesktopShortcut,DragIndicator,ResizeIndicator,Window,Toolbar,Desktop}.tsx`
- `components/general/Icon.tsx`
- `constants/colors.ts`
- the required OS icons and local fonts under `assets/`

`Desktop.tsx` and `Toolbar.tsx` are adapted only to register Cofounder's two
applications and product-specific Start actions. The questionnaire placeholder
and Credits content are local Cofounder components rendered inside the reused
window chrome.

The upstream repository does not currently include a license. Do not publish
or redistribute these files until the project has written permission from
Henry Heffernan and has checked the bundled fonts and Windows-derived artwork.
