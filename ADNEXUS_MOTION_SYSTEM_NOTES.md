# Sprint 3 Notes - Motion System

## Implemented
- Header top motion frame uses lightweight CSS animation.
- Product scenes rely on CSS/DOM mockups, not heavy GIF assets.
- Global reduced-motion rules disable animation for users who request it.

## Motion Rules
- Motion must explain product state, not decorate random elements.
- No CPU-heavy infinite loops.
- No fake KPI animation.
- No animation may hide stale/error state.
