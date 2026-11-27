import { TikFinityClient } from '../../network/TikFinityClient';
import { PlatformAdapter } from './types';

export class TikTokAdapter implements PlatformAdapter {
  constructor(private client: TikFinityClient) {}

  get isEnabled(): boolean {
    return this.client.isEnabled;
  }

  connect(target: string): void {
    this.client.connect(target || 'ws://localhost:21213/');
  }

  disconnect(): void {
    this.client.disconnect();
  }
}