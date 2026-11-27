export interface PlatformAdapter {
  readonly isEnabled: boolean;
  connect(target: string): void;
  disconnect(): void;
}