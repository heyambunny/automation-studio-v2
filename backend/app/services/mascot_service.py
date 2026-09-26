"""A tiny procedurally-drawn, looping animated GIF mascot for outgoing
campaign emails - no external image assets, so nothing to license or host.
Each notification email (scheduled / reminder / completed) gets its own
mascot color + expression so the three stay visually distinct even with the
animation removed by a client that doesn't render GIFs."""
import io
import math
from PIL import Image, ImageDraw

_WHITE = (255, 255, 255)
_INK = (30, 30, 30)
_SHADOW = (235, 235, 235)


def generate_bounce_gif(color: tuple, mood: str = "happy", frames: int = 16, size=(120, 100), duration_ms: int = 55) -> bytes:
    """mood: "happy" (smiling arc), "excited" (open circle mouth + sparkle),
    or "alert" (flat mouth, still friendly, used for the failure case)."""
    cx, ground_y = size[0] // 2, size[1] - 22
    base_r = 24
    imgs = []

    for i in range(frames):
        t = i / frames
        bounce = math.sin(t * math.pi)  # 0 at ground, 1 at peak, back to 0
        y_offset = bounce * 20
        near_ground = max(0.0, 1 - bounce * 3)  # only true right near contact
        w = base_r * (1 + 0.22 * near_ground)
        h = base_r * (1 - 0.18 * near_ground)
        cy = ground_y - y_offset

        img = Image.new("RGB", size, _WHITE)
        draw = ImageDraw.Draw(img)

        shadow_w = base_r * (1.05 - 0.5 * bounce)
        draw.ellipse([cx - shadow_w, ground_y + base_r * 0.55, cx + shadow_w, ground_y + base_r * 0.55 + 8], fill=_SHADOW)

        draw.ellipse([cx - w, cy - h, cx + w, cy + h], fill=color)

        eye_dx, eye_y = w * 0.36, cy - h * 0.12
        for dx in (-eye_dx, eye_dx):
            draw.ellipse([cx + dx - 5, eye_y - 5, cx + dx + 5, eye_y + 5], fill=_WHITE)
            pupil_y = eye_y + (1 if mood == "alert" else 0)
            draw.ellipse([cx + dx - 2.5, pupil_y - 2.5, cx + dx + 2.5, pupil_y + 2.5], fill=_INK)

        mouth_y = cy + h * 0.32
        if mood == "excited":
            r = 5 + bounce * 2
            draw.ellipse([cx - r, mouth_y - r, cx + r, mouth_y + r], fill=_INK)
        elif mood == "alert":
            draw.line([cx - w * 0.22, mouth_y, cx + w * 0.22, mouth_y], fill=_INK, width=3)
        else:
            draw.arc([cx - w * 0.32, mouth_y - 8, cx + w * 0.32, mouth_y + 10], start=15, end=165, fill=_INK, width=3)

        imgs.append(img)

    buf = io.BytesIO()
    imgs[0].save(
        buf, format="GIF", save_all=True, append_images=imgs[1:],
        duration=duration_ms, loop=0, optimize=True,
    )
    return buf.getvalue()
