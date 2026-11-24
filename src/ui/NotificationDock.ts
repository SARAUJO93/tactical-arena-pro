import { getAvatar } from '../systems/AvatarCache';

export class NotificationDock {
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly getElement: (id: string) => HTMLElement
  ) {}

  push(
    title: string,
    sub: string,
    color = '#5ac8fa',
    avatarUrl = '',
    user = '',
    glyph = '⚔️',
    tag = 'LIVE',
    durationMs = 2600
  ): void {
    const dock = this.getElement('notificationDock');
    dock.style.setProperty('--notification-accent', color);
    dock.style.setProperty('--notification-duration', `${durationMs}ms`);
    this.getElement('notificationTitle').textContent = title;
    this.getElement('notificationSub').textContent = sub;
    this.getElement('notificationTag').textContent = tag;

    const img = this.getElement('notificationAvatar') as HTMLImageElement;
    const gly = this.getElement('notificationGlyph');
    if (user) {
      img.src = getAvatar(avatarUrl, user).dataUrl;
      img.classList.remove('hidden');
      gly.classList.add('hidden');
    } else {
      img.classList.add('hidden');
      gly.textContent = glyph;
      gly.classList.remove('hidden');
    }

    dock.classList.remove('hidden', 'dock-progress-run');
    void dock.offsetWidth;
    dock.classList.add('dock-progress-run');
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => dock.classList.add('hidden'), durationMs);
  }

  hide(): void {
    if (this.timer) clearTimeout(this.timer);
    this.getElement('notificationDock').classList.add('hidden');
  }
}
