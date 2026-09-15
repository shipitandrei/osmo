import { EyeController } from ‘./eyes/EyeController.js’;
import { AnimationSystem } from ‘./core/AnimationSystem.js’;
import { EffectsManager } from ‘./effects/EffectsManager.js’;
import { MoodEffects } from ‘./effects/MoodEffects.js’;

class RoboEyesApp {
constructor() {
this.canvas = document.getElementById(‘eye-canvas’);

```
// Size the canvas to fill the viewport before anything reads canvas.width/height,
// since EyeRenderer captures those values once at construction.
this.resizeCanvas();

this.eyeController = new EyeController(this.canvas);
this.animations = new AnimationSystem();
this.effectsManager = new EffectsManager(this.canvas);
this.moodEffects = new MoodEffects(this.canvas, this.effectsManager);

this.autoblinkEnabled = true;
this.idleEnabled = true;
this.lastFrameTime = performance.now();

this.setupResizeListener();
this.setupAnimations();

this.eyeController.setMood('DEFAULT');
this.moodEffects.setMood('DEFAULT');
this.eyeController.open();
this.eyeController.setAutoblinker(this.autoblinkEnabled);
this.eyeController.setIdleMode(this.idleEnabled);

this.animations.start();
```

}

resizeCanvas() {
// EyeRenderer reads canvas.width/height once at construction and uses
// those raw numbers for all positioning and gradient math (no DPR
// scaling anywhere in its drawing code). To keep that math correct,
// the backing buffer is set 1:1 with CSS pixels rather than scaled by
// devicePixelRatio. This keeps the eyes correctly centered and sized
// on every display; it trades away extra sharpness on high-DPI
// screens, which would otherwise require updating EyeRenderer’s
// drawing calls to account for a DPR transform.
const width = window.innerWidth;
const height = window.innerHeight;

```
this.canvas.style.width = `${width}px`;
this.canvas.style.height = `${height}px`;
this.canvas.width = width;
this.canvas.height = height;
```

}

setupResizeListener() {
window.addEventListener(‘resize’, () => {
this.resizeCanvas();

```
  // EyeRenderer, EffectsManager, and MoodEffects all cache width/height
  // (plus derived values like centerX/centerY and position offsets)
  // from the canvas at construction time. Resync them here rather than
  // recreating the objects, so animation/mood state isn't lost on resize.
  const { width, height } = this.canvas;
  const renderer = this.eyeController.renderer;
  renderer.width = width;
  renderer.height = height;
  renderer.centerX = width / 2;
  renderer.centerY = height / 2;
  renderer.baseMaxOffsetX = width * 0.12;
  renderer.baseMaxOffsetY = height * 0.11;
  renderer.updateMaxOffsets();
  renderer.updatePositions();

  this.effectsManager.width = width;
  this.effectsManager.height = height;
  this.moodEffects.width = width;
  this.moodEffects.height = height;
});
```

}

setupAnimations() {
this.animations.add(‘moodEffects’, {
active: true,
update: () => {
const currentTime = performance.now();
const delta = (currentTime - this.lastFrameTime) / 1000;
this.lastFrameTime = currentTime;

```
    this.moodEffects.update(delta);
    this.effectsManager.update(delta);
  }
});

this.animations.add('renderComplete', {
  active: true,
  update: () => {
    this.renderComplete();
  }
});
```

}

renderComplete() {
// 1. Render background and glow first (bottom layer)
this.moodEffects.renderBackground();

```
// 2. Render eyes
this.eyeController.render();

// 3. Render particle effects last (top layer)
this.effectsManager.render();

// 4. Render special effects for thinking and speaking
this.renderAnimationEffects();
```

}

renderAnimationEffects() {
const ctx = this.canvas.getContext(‘2d’);
const centerX = this.canvas.width / 2;
const centerY = this.canvas.height / 2;
const time = Date.now() * 0.001;

```
// Thinking: render thinking glow
if (this.eyeController.animThinking) {
  ctx.save();
  const pulse = 0.5 + Math.sin(time * 2) * 0.3;
  const gradient = ctx.createRadialGradient(
    centerX, centerY, 0,
    centerX, centerY, 50
  );
  gradient.addColorStop(0, `rgba(150, 200, 255, ${0.2 * pulse})`);
  gradient.addColorStop(1, 'rgba(150, 200, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  ctx.restore();
}

// Speaking: slow ripple diffusion effect
if (this.eyeController.animSpeaking) {
  ctx.save();
  const slowTime = time * 0.5;
  for (let i = 0; i < 3; i++) {
    const rippleTime = slowTime - i * 0.6;
    if (rippleTime < 0) continue;

    const radius = (rippleTime * 40) % 90;
    const alpha = 0.25 * (1 - radius / 90);

    if (alpha > 0) {
      ctx.strokeStyle = `rgba(100, 255, 200, ${alpha})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}
```

}

destroy() {
this.animations.stop();
this.eyeController.destroy();
}
}

const app = new RoboEyesApp();
export default app;
