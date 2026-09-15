import { EyeController } from './eyes/EyeController.js';
import { AnimationSystem } from './core/AnimationSystem.js';
import { EffectsManager } from './effects/EffectsManager.js';
import { MoodEffects } from './effects/MoodEffects.js';

class RoboEyesApp {
  constructor() {
    this.canvas = document.getElementById('eye-canvas');

    this.resizeCanvas();

    this.eyeController = new EyeController(this.canvas);
    this.animations = new AnimationSystem();
    this.effectsManager = new EffectsManager(this.canvas);
    this.moodEffects = new MoodEffects(
      this.canvas,
      this.effectsManager
    );

    this.lastFrameTime = performance.now();

    window.addEventListener('resize', () => {
      this.resizeCanvas();
    });

    this.setupAnimations();

    this.eyeController.setMood('DEFAULT');
    this.moodEffects.setMood('DEFAULT');
    this.eyeController.open();

    this.animations.start();
  }

  resizeCanvas() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    if (
      this.canvas.width !== width ||
      this.canvas.height !== height
    ) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  setupAnimations() {
    this.animations.add('render', {
      active: true,

      update: () => {
        this.renderComplete();
      }
    });
  }

  renderComplete() {
    const currentTime = performance.now();

    const delta =
      (currentTime - this.lastFrameTime) / 1000;

    this.lastFrameTime = currentTime;

    this.moodEffects.update(delta);
    this.effectsManager.update(delta);

    this.moodEffects.renderBackground();

    this.eyeController.render();

    this.effectsManager.render();
  }

  destroy() {
    this.animations.stop();
    this.eyeController.destroy();
  }
}

const app = new RoboEyesApp();

export default app;
