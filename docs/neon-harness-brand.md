# NeonHarness brand foundation

NeonHarness is a focused developer workbench for building, testing, and
deploying AI-powered work. Its visual language is technical and reliable,
with a bright execution signal carried by an otherwise quiet instrument panel.

## Core promise

**Build. Test. Deploy. Reliably.**

The product should feel like a confident tool beside the user's terminal:
clear at a glance, dense only where the work needs density, and visibly alive
when an operation is running.

## Color system

| Token | Hex | Use |
| --- | --- | --- |
| Near black | `#0B0E11` | application canvas and primary chrome |
| Steel | `#171C22` | selected rows, tool surfaces, raised controls |
| Slate | `#2A313B` | stronger borders, overlays, secondary surfaces |
| Cool gray | `#8B949E` | quiet labels, metadata, inactive icon ink |
| White | `#E6E9EE` | primary text and high-contrast marks |
| Acid lime | `#C6FF00` | brand mark, active state, primary action, success |
| Lime soft | `#D8FF58` | hover and emphasis support |
| Amber | `#FFB020` | attention, running checkpoints, warnings |

Lime is a signal, not a background. Use it for the thing that needs attention
or confirmation; keep most surfaces near black or steel.

## Typography

- **Neon Display** — bundled Saira weights, used for the
  NeonHarness wordmark, hero headlines, and high-signal titles.
- **Neon Mono** — bundled JetBrains Mono weights, used for code, command
  output, technical labels, pipeline states, and compact navigation metadata.

The UI should stay readable at normal desktop sizes. Uppercase mono labels are
reserved for navigation or state tags and should use generous tracking.

## Logo

The angular N is an interlocking harness: it represents reliable routes around
an active core. Use the supplied `neon-harness-mark.png` on near-black or steel
surfaces with clear space equal to at least one quarter of the mark's width.

Do not recolor the mark, add a second glow, place it over busy imagery, or use
the wordmark as a decorative replacement for an action label.

## Iconography

Icons should be compact, geometric, and outline-first. Use the existing
primitive icon components for interaction affordances, with currentColor
driving their ink. Lime is reserved for active, live, complete, or primary
states; gray is the resting state; amber is attention; red is destructive or
failed.

## Surfaces and motion

Prefer spacing, alignment, and thin separators over stacked cards. Raised
surfaces use steel rather than a large shadow. Active transitions should be
short and purposeful; reduced-motion settings remain respected.
