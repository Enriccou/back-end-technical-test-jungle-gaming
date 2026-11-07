import { Injectable } from '@nestjs/common';
import crypto from 'crypto';

@Injectable()
export class IdempotencyService {
  /**
   * Calcula hash SHA-256 do payload para detecção de conflito
   * Usa JSON canonical (chaves ordenadas) para garantir determinismo
   */
  computePayloadHash(payload: any): string {
    const canonical = this.canonicalJSON(payload);
    return crypto.createHash('sha256').update(canonical).digest('hex');
  }

  /**
   * Serializa objeto em JSON canônico (chaves ordenadas, sem espaços)
   */
  private canonicalJSON(obj: any): string {
    if (obj === null || obj === undefined) {
      return JSON.stringify(obj);
    }

    if (typeof obj !== 'object') {
      return JSON.stringify(obj);
    }

    if (Array.isArray(obj)) {
      return `[${obj.map((item) => this.canonicalJSON(item)).join(',')}]`;
    }

    const keys = Object.keys(obj).sort();
    const pairs = keys.map((k) => {
      const v = this.canonicalJSON(obj[k]);
      return `"${k}":${v}`;
    });

    return `{${pairs.join(',')}}`;
  }
}
