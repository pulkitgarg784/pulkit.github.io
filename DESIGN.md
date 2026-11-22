# Design

The site is a node network editor, modelled on Houdini's network view and parameter pane. Pulkit's work is a graph of real nodes (experience and projects) wired through category merges into one output node, `pulkit_garg`. Selecting a node opens its parameters. Everything below the editor uses the same pane language.

## Colour

Light, cool-grey tool UI, read in daylight at a desk. Colour carries meaning, never decoration.

| Token | Value | Role |
|---|---|---|
| `--canvas` | `#e3e6e9` | Page and network canvas, with a 22px dot grid (`--dot #c3c9cf`) |
| `--pane` | `#f4f5f6` | Panes, bar, status bar |
| `--surface` | `#ffffff` | Nodes, fields, buttons, table rows |
| `--ink` / `--text` / `--muted` | `#1b2127` / `#2b333b` / `#56616b` | Text roles |
| `--display` | `#2b5fc4` | Display flag, the output node, links, emphasis |
| `--select` | `#f0b429` | Selected node outline and bypass stripes, never text |
| `--c-exp` `--c-graphics` `--c-games` `--c-apps` `--c-merge` | `#4b5661` `#c4513a` `#2e8460` `#9a6d17` `#6a5aa8` | Node type chips only |

## Type

- **Archivo** (variable width and weight) for everything readable. The display line is 800 weight at 88% width with -0.025em tracking. Bar and pane titles are 700 weight at 112% width.
- **Martian Mono** only for identifiers and values: node names, the parameter name field, categories, status counts.

## Components

- **Node:** a 200×34 white tile with a 3px radius. Inside are a bypass flag, a coloured type chip with an authored 1.7-stroke icon, a mono label, and a display flag. Ports are 7px circles.
  - Selected: yellow outline and tint.
  - Bypassed: 55% opacity with yellow and black stripes on the bypass flag.
  - Display: the blue end flag.
- **Wire:** a cubic bezier, 1.4px `#6d767e`. Wires connected to the selected node turn ink at 2.2px. Bypassed wires are dashed at 25%.
- **Parameter row:** a right-aligned muted label next to a white bordered field.
- **Button:** a 3px-radius rectangle with a 1px border. The primary button is solid ink and turns display blue on hover. No pill shapes.
- **Filter:** a segmented control. The selected segment is ink.
- **Pane:** a tab heading attached to a bordered `--pane` body, with no shadow.
- **Spreadsheet:** a zebra-striped table with a flag column that shows bypass stripes.

## Motion

There is one authored moment. On load, wires draw in from the leaves to the merges to the output, about 1.7s in total. Then the output's display flag turns blue. The parameter pane eases in on each selection. Both are skipped when the visitor's system is set to reduce motion.

## Interaction

- Nodes can be dragged, and the wires follow live.
- Arrow keys walk the graph: up and down within a column, right to the output, left to the first input.
- Filters bypass project nodes and table rows. Nothing disappears.
- Clicking a table row selects its node in the graph.
- Below 1000px the parameter pane stacks first, and the graph becomes a fixed 760px canvas that scrolls sideways.
