# Design

The site is one captured GPU frame, modelled on RenderDoc and PIX. The left rail is an Event Browser: the hero's render passes plus document markers for each section. The first screen pairs a Capture Summary (the intro) with a Texture Viewer. The viewer runs a real ray-marched WebGL scene, and visitors can step through its passes (depth, normals, albedo, AO, HDR lighting, final), toggle R/G/B/A channels, and read pixel values under the cursor. Experience reads like an API inspector's call list, and projects sit in a numbered event table.

## Colour

Dark tool chrome, matching the debuggers graphics engineers use daily. Colour marks state.

| Token | Value | Role |
|---|---|---|
| `--bg` / `--panel` / `--panel-2` | `#15171a` / `#1c1f23` / `#22262b` | Page, panels, panel title bars |
| `--line` / `--line-strong` | `#2d3238` / `#3d434b` | Panel borders, row rules |
| `--ink` / `--text` / `--muted` | `#f2f4f6` / `#d3d8dd` / `#949da6` | Text roles |
| `--current` | `#5ec7c0` | Current event, links, primary button, selected filter |
| `--marker` | `#f08a63` | Debug-marker groups, headline emphasis, argument names, categories |
| `--ch-r/g/b/a` | `#ef5a5f` `#45c07a` `#5b97f5` `#c9ced3` | Channel toggles only |

## Type

- **Geologica** for everything readable. The display line is 800 weight with -0.03em tracking. Section titles are 700 weight at 1.35rem.
- **Fragment Mono** only for identifiers and measurements: EIDs, file names, argument names, tags, resolution, pixel values, frame time.

## Components

- **Panel:** a 4px-radius bordered box with a 34px muted title bar. Large section titles get a 48px bar.
- **Event row:** a mono EID beside a name. The current row gets a teal tint and a teal EID. There's no coloured side stripe.
- **Buttons:** 4px-radius rectangles. The primary button is solid teal with dark text.
- **Filters:** a segmented control. The selected segment is teal.
- **Channel toggles:** small square buttons filled with their channel colour when on.
- **Timeline:** a pass tick strip under the viewer. The current tick is teal, with its EID label.
- **Experience call:** the name, role and badge on one line, then mono argument names (`work`, `api`, `stack`, `engine`) beside values.
- **Event table:** zebra rows with columns EID, Name, Category, Description and Links.

## Motion and rendering

- The scene orbits slowly in real time. It pauses when it's off-screen or the tab is hidden.
- If frame time stays above 45ms, the render resolution drops.
- With reduced motion on, the viewer draws one static frame, and only redraws when you change a pass or channel.
- Without WebGL, the viewer shows a plain message and the rest of the page is unaffected.

## Responsive

- Below 1180px, the summary stacks above the viewer.
- Below 900px, the rail is hidden and the passes become a horizontal tab strip above the image.
- Project rows stack into an EID column next to the content.
