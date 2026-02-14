/**
 * SecureBuffer - Wraps sensitive data in a Uint8Array that can be zeroed.
 * Unlike JavaScript strings (immutable), Uint8Array contents can be overwritten.
 */
export class SecureBuffer {
  private _data: Uint8Array;
  private _zeroed = false;

  private constructor(data: Uint8Array) {
    this._data = data;
  }

  static fromString(str: string): SecureBuffer {
    return new SecureBuffer(new TextEncoder().encode(str));
  }

  static fromBytes(bytes: Uint8Array): SecureBuffer {
    const copy = new Uint8Array(bytes.length);
    copy.set(bytes);
    return new SecureBuffer(copy);
  }

  get bytes(): Uint8Array {
    return this._data;
  }

  get byteLength(): number {
    return this._data.length;
  }

  isValid(): boolean {
    return !this._zeroed;
  }

  toString(): string {
    if (this._zeroed) {
      throw new Error("SecureBuffer has been zeroed");
    }
    return new TextDecoder().decode(this._data);
  }

  zero(): void {
    this._data.fill(0);
    this._zeroed = true;
  }
}
