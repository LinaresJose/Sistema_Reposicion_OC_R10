import argon2 from 'argon2';

export class ServicioArgon2id {
  /**
   * Hashea una contrasena en texto plano utilizando Argon2id con parametros recomendados por OWASP
   */
  static async hashearClave(clavePlana: string): Promise<string> {
    return await argon2.hash(clavePlana, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,       // 3 iteraciones
      parallelism: 4     // 4 hilos concurrentes
    });
  }

  /**
   * Verifica de manera constante en tiempo si la contrasena ingresada coincide con el hash
   */
  static async verificarClave(claveHash: string, clavePlana: string): Promise<boolean> {
    try {
      return await argon2.verify(claveHash, clavePlana);
    } catch (error) {
      return false;
    }
  }
}
