export interface Adapter {
  available: boolean;
  show: () => Promise<boolean> | boolean;
}