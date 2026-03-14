"""
Generate PNG icons for fire-clicker PWA.
Draws a stylized campfire on a dark circular background using Pillow.
Outputs 192x192 and 512x512 PNGs.
"""
from PIL import Image, ImageDraw
import math
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ICONS_DIR = os.path.join(SCRIPT_DIR, "public", "icons")


def lerp_color(c1, c2, t):
    """Linearly interpolate between two RGB(A) colors."""
    return tuple(int(a + (b - a) * t) for a, b in zip(c1, c2))


def draw_radial_gradient_circle(draw, cx, cy, r, inner_color, outer_color, img):
    """Draw a filled circle with a radial gradient using per-pixel alpha."""
    for y_off in range(-r, r + 1):
        for x_off in range(-r, r + 1):
            dist = math.sqrt(x_off * x_off + y_off * y_off)
            if dist <= r:
                t = dist / r
                color = lerp_color(inner_color, outer_color, t)
                px, py = cx + x_off, cy + y_off
                if 0 <= px < img.width and 0 <= py < img.height:
                    img.putpixel((px, py), color)


def draw_flame_shape(draw, points, fill_color):
    """Draw a flame polygon from a list of (x, y) tuples."""
    draw.polygon(points, fill=fill_color)


def bezier_point(p0, p1, p2, t):
    """Quadratic bezier curve point."""
    u = 1 - t
    return (
        u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
        u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
    )


def bezier_points(p0, p1, p2, steps=30):
    """Generate points along a quadratic bezier curve."""
    return [bezier_point(p0, p1, p2, t / steps) for t in range(steps + 1)]


def generate_icon(size):
    """Generate a campfire icon at the given size."""
    # We draw at 4x for anti-aliasing, then downscale
    scale = 4
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    cx, cy = s // 2, s // 2
    r = int(s * 0.488)  # circle radius

    # --- Background circle ---
    # Dark purple background
    draw.ellipse(
        [cx - r, cy - r, cx + r, cy + r],
        fill=(26, 14, 46, 255),
        outline=(61, 43, 94, 255),
        width=max(2, s // 80),
    )

    # Inner lighter gradient approximation (concentric circles)
    for i in range(r, 0, -max(1, r // 40)):
        t = 1 - (i / r)
        if t < 0.5:
            c = lerp_color((26, 14, 46), (45, 27, 78), t * 2)
        else:
            c = lerp_color((45, 27, 78), (26, 14, 46), (t - 0.5) * 2)
        draw.ellipse(
            [cx - i, cy - i, cx + i, cy + i],
            fill=(*c, 255),
        )

    # --- Ambient glow under fire ---
    glow_r = int(s * 0.25)
    glow_cy = int(cy + s * 0.08)
    for i in range(glow_r, 0, -max(1, glow_r // 30)):
        t = i / glow_r
        alpha = int(40 * t * t)
        draw.ellipse(
            [cx - i, glow_cy - i // 2, cx + i, glow_cy + i // 2],
            fill=(255, 100, 0, alpha),
        )

    # --- Helper: scale coordinates from 512 space to current space ---
    def sc(x, y):
        return (int(x * s / 512), int(y * s / 512))

    # --- Wood logs ---
    log_y = int(s * 0.745)
    log_w = int(s * 0.30)
    log_h = int(s * 0.035)

    # Shadow ellipse
    draw.ellipse(
        [cx - log_w, log_y + log_h, cx + log_w, log_y + log_h + int(s * 0.02)],
        fill=(30, 15, 5, 100),
    )

    # Log 1 (tilted left)
    log_points_1 = []
    for angle_deg in range(360):
        angle = math.radians(angle_deg)
        lx = cx + int(log_w * 0.78 * math.cos(angle)) - int(s * 0.01)
        ly = log_y + int(log_h * math.sin(angle))
        # Slight rotation
        rx = cx + int((lx - cx) * 0.99 - (ly - log_y) * 0.14)
        ry = log_y + int((lx - cx) * 0.14 + (ly - log_y) * 0.99)
        log_points_1.append((rx, ry))
    draw.polygon(log_points_1, fill=(107, 66, 38, 255))

    # Log 2 (tilted right)
    log_points_2 = []
    for angle_deg in range(360):
        angle = math.radians(angle_deg)
        lx = cx + int(log_w * 0.73 * math.cos(angle)) + int(s * 0.01)
        ly = log_y + int(log_h * 0.9 * math.sin(angle)) + int(s * 0.01)
        rx = cx + int((lx - cx) * 0.98 + (ly - log_y) * 0.17)
        ry = log_y + int(-(lx - cx) * 0.17 + (ly - log_y) * 0.98)
        log_points_2.append((rx, ry))
    draw.polygon(log_points_2, fill=(122, 79, 46, 255))

    # --- Flames ---
    # We'll build flame shapes using bezier curves for smooth outlines

    def flame_polygon(control_points_left, tip, control_points_right, base_y, steps=25):
        """Create a flame shape from bezier control points.
        Left side goes up, tip at top, right side goes down."""
        points = []
        # Left side (bottom to top)
        for i in range(len(control_points_left) - 1):
            seg = bezier_points(control_points_left[i],
                              ((control_points_left[i][0] + control_points_left[i+1][0]) / 2 - s * 0.03,
                               (control_points_left[i][1] + control_points_left[i+1][1]) / 2),
                              control_points_left[i + 1], steps)
            points.extend(seg)
        # Tip
        points.append(tip)
        # Right side (top to bottom)
        for i in range(len(control_points_right) - 1):
            seg = bezier_points(control_points_right[i],
                              ((control_points_right[i][0] + control_points_right[i+1][0]) / 2 + s * 0.03,
                               (control_points_right[i][1] + control_points_right[i+1][1]) / 2),
                              control_points_right[i + 1], steps)
            points.extend(seg)
        return [(int(x), int(y)) for x, y in points]

    # Outer flame (dark red-orange)
    outer_left = [
        (cx - int(s * 0.14), int(s * 0.76)),
        (cx - int(s * 0.20), int(s * 0.58)),
        (cx - int(s * 0.18), int(s * 0.42)),
        (cx - int(s * 0.06), int(s * 0.28)),
    ]
    outer_tip = (cx, int(s * 0.20))
    outer_right = [
        (cx + int(s * 0.06), int(s * 0.28)),
        (cx + int(s * 0.18), int(s * 0.42)),
        (cx + int(s * 0.20), int(s * 0.58)),
        (cx + int(s * 0.14), int(s * 0.76)),
    ]
    outer_poly = flame_polygon(outer_left, outer_tip, outer_right, s * 0.76)
    draw.polygon(outer_poly, fill=(204, 50, 0, 240))

    # Left tongue
    lt_left = [
        (cx - int(s * 0.16), int(s * 0.55)),
        (cx - int(s * 0.22), int(s * 0.44)),
    ]
    lt_tip = (cx - int(s * 0.17), int(s * 0.36))
    lt_right = [
        (cx - int(s * 0.14), int(s * 0.42)),
        (cx - int(s * 0.13), int(s * 0.52)),
    ]
    lt_poly = flame_polygon(lt_left, lt_tip, lt_right, s * 0.55)
    draw.polygon(lt_poly, fill=(255, 80, 0, 180))

    # Right tongue
    rt_left = [
        (cx + int(s * 0.13), int(s * 0.52)),
        (cx + int(s * 0.14), int(s * 0.42)),
    ]
    rt_tip = (cx + int(s * 0.17), int(s * 0.36))
    rt_right = [
        (cx + int(s * 0.22), int(s * 0.44)),
        (cx + int(s * 0.16), int(s * 0.55)),
    ]
    rt_poly = flame_polygon(rt_left, rt_tip, rt_right, s * 0.55)
    draw.polygon(rt_poly, fill=(255, 80, 0, 180))

    # Middle flame (orange)
    mid_left = [
        (cx - int(s * 0.11), int(s * 0.75)),
        (cx - int(s * 0.16), int(s * 0.58)),
        (cx - int(s * 0.14), int(s * 0.44)),
        (cx - int(s * 0.04), int(s * 0.32)),
    ]
    mid_tip = (cx, int(s * 0.26))
    mid_right = [
        (cx + int(s * 0.04), int(s * 0.32)),
        (cx + int(s * 0.14), int(s * 0.44)),
        (cx + int(s * 0.16), int(s * 0.58)),
        (cx + int(s * 0.11), int(s * 0.75)),
    ]
    mid_poly = flame_polygon(mid_left, mid_tip, mid_right, s * 0.75)
    draw.polygon(mid_poly, fill=(255, 120, 0, 230))

    # Inner flame (yellow-orange)
    inn_left = [
        (cx - int(s * 0.07), int(s * 0.74)),
        (cx - int(s * 0.10), int(s * 0.60)),
        (cx - int(s * 0.08), int(s * 0.48)),
        (cx - int(s * 0.02), int(s * 0.38)),
    ]
    inn_tip = (cx, int(s * 0.33))
    inn_right = [
        (cx + int(s * 0.02), int(s * 0.38)),
        (cx + int(s * 0.08), int(s * 0.48)),
        (cx + int(s * 0.10), int(s * 0.60)),
        (cx + int(s * 0.07), int(s * 0.74)),
    ]
    inn_poly = flame_polygon(inn_left, inn_tip, inn_right, s * 0.74)
    draw.polygon(inn_poly, fill=(255, 180, 0, 220))

    # Core flame (bright yellow)
    core_left = [
        (cx - int(s * 0.035), int(s * 0.72)),
        (cx - int(s * 0.05), int(s * 0.62)),
        (cx - int(s * 0.02), int(s * 0.52)),
    ]
    core_tip = (cx, int(s * 0.45))
    core_right = [
        (cx + int(s * 0.02), int(s * 0.52)),
        (cx + int(s * 0.05), int(s * 0.62)),
        (cx + int(s * 0.035), int(s * 0.72)),
    ]
    core_poly = flame_polygon(core_left, core_tip, core_right, s * 0.72)
    draw.polygon(core_poly, fill=(255, 230, 80, 210))

    # Hottest core (white-yellow)
    hot_left = [
        (cx - int(s * 0.018), int(s * 0.70)),
        (cx - int(s * 0.025), int(s * 0.63)),
    ]
    hot_tip = (cx, int(s * 0.56))
    hot_right = [
        (cx + int(s * 0.025), int(s * 0.63)),
        (cx + int(s * 0.018), int(s * 0.70)),
    ]
    hot_poly = flame_polygon(hot_left, hot_tip, hot_right, s * 0.70)
    draw.polygon(hot_poly, fill=(255, 255, 200, 180))

    # --- Sparks ---
    sparks = [
        (cx - int(s * 0.07), int(s * 0.30), int(s * 0.007)),
        (cx + int(s * 0.08), int(s * 0.27), int(s * 0.006)),
        (cx - int(s * 0.03), int(s * 0.24), int(s * 0.005)),
        (cx + int(s * 0.04), int(s * 0.22), int(s * 0.006)),
        (cx + int(s * 0.11), int(s * 0.33), int(s * 0.005)),
        (cx - int(s * 0.11), int(s * 0.34), int(s * 0.005)),
        (cx - int(s * 0.01), int(s * 0.19), int(s * 0.004)),
        (cx + int(s * 0.06), int(s * 0.17), int(s * 0.004)),
    ]
    spark_colors = [
        (255, 204, 0, 200),
        (255, 170, 0, 180),
        (255, 221, 68, 160),
        (255, 204, 0, 180),
        (255, 136, 0, 130),
        (255, 136, 0, 130),
        (255, 238, 100, 150),
        (255, 200, 50, 140),
    ]
    for (sx, sy, sr), sc in zip(sparks, spark_colors):
        draw.ellipse([sx - sr, sy - sr, sx + sr, sy + sr], fill=sc)

    # --- Downscale with anti-aliasing ---
    img = img.resize((size, size), Image.LANCZOS)

    return img


def main():
    os.makedirs(ICONS_DIR, exist_ok=True)

    for size in (192, 512):
        print(f"Generating {size}x{size} icon...")
        icon = generate_icon(size)
        path = os.path.join(ICONS_DIR, f"icon-{size}.png")
        icon.save(path, "PNG")
        print(f"  Saved: {path}")

    print("Done!")


if __name__ == "__main__":
    main()
