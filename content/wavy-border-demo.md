+++
title = "Wavy Border Demo"
path = "wavy-border-demo"
+++

# Wavy Border Demo

This page demonstrates the wavy/scalloped border utility available in the site.

## Basic Usage

Add the `wavy-border` class to any element:

<div class="wavy-border" style="background-color: var(--yellow); color: var(--bg); margin: 2rem 0;">
  <h2 style="color: var(--bg); margin-top: 0;">Basic Wavy Border</h2>
  <p style="color: var(--bg);">This box has a scalloped edge all around it. The border automatically scales to any size container.</p>
</div>

```html
<div class="wavy-border" style="background-color: var(--yellow);">
  <h2>Your Title</h2>
  <p>Your content here</p>
</div>
```

## With Shadow

Use `wavy-border-shadow` for a subtle drop shadow effect:

<div class="wavy-border-shadow" style="background-color: var(--aqua); color: var(--bg); margin: 2rem 0;">
  <h2 style="color: var(--bg); margin-top: 0;">With Shadow</h2>
  <p style="color: var(--bg);">This version includes a subtle shadow for more depth.</p>
</div>

```html
<div class="wavy-border-shadow" style="background-color: var(--aqua);">
  <h2>Your Title</h2>
  <p>Your content here</p>
</div>
```

## Different Colors

The border works with any background color:

<div class="wavy-border" style="background-color: var(--purple); color: var(--fg); margin: 2rem 0;">
  <h3 style="color: var(--fg); margin-top: 0;">Purple Frame</h3>
  <p>Using var(--purple) from the theme</p>
</div>

<div class="wavy-border" style="background-color: var(--green); color: var(--bg); margin: 2rem 0;">
  <h3 style="color: var(--bg); margin-top: 0;">Green Frame</h3>
  <p style="color: var(--bg);">Using var(--green) from the theme</p>
</div>

<div class="wavy-border" style="background-color: var(--orange); color: var(--bg); margin: 2rem 0;">
  <h3 style="color: var(--bg); margin-top: 0;">Orange Frame</h3>
  <p style="color: var(--bg);">Using var(--orange) from the theme</p>
</div>

```html
<div class="wavy-border" style="background-color: var(--purple);">
  <h3>Purple Frame</h3>
  <p>Content</p>
</div>
```

## Nested Content

The wavy border works with any content inside:

<div class="wavy-border-shadow" style="background-color: var(--blue); color: var(--bg); margin: 2rem 0;">
  <h3 style="color: var(--bg); margin-top: 0;">Feature List</h3>
  <ul style="color: var(--bg);">
    <li>Automatic scaling</li>
    <li>Works with any background color</li>
    <li>CSS-only implementation</li>
    <li>No JavaScript required</li>
  </ul>
  <pre style="background-color: var(--bg); color: var(--fg); padding: 1rem; border-radius: 4px;"><code>const example = "code blocks work too";</code></pre>
</div>

## Technical Details

The wavy border is implemented using SVG clip paths defined in the base template.
The path is defined once and reused via CSS for efficiency.

Available CSS classes:
- `wavy-border` - Basic scalloped border
- `wavy-border-shadow` - Scalloped border with drop shadow

Both classes include 2rem of padding by default. Adjust in the CSS if needed.

## Color Variables

Use these theme variables for consistent styling:
- `var(--bg)` - Background color
- `var(--fg)` - Foreground color
- `var(--red)`
- `var(--green)`
- `var(--yellow)`
- `var(--blue)`
- `var(--purple)`
- `var(--aqua)`
- `var(--orange)`
- `var(--gray)`
