def shadow_lift(pixel, strength):
    """Teaching operator, strength is an integer from 0 to 100."""
    delta = ((255 - pixel) ** 2 * strength + 12750) // 25500
    return min(255, pixel + delta)
